import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { ConformidadModel } from '../models/Conformidad.js';
import { UsuarioModel } from '../models/Usuario.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../middleware/error.middleware.js';
import { deriveCodigoActa } from '../services/codigoActa.service.js';
import { escapeRegExp } from '../utils/regex.js';
import { pushConformidadToTicket, verifyTicketExists, OdooError } from '../services/odoo.service.js';
import { notificarEstadoVisita } from '../services/telegram.service.js';
import { cerrarVisitaLoteSiTodoResuelto } from '../services/loteVisita.service.js';
import { buildConformidadPdfBuffer as renderConformidadPdf } from '../services/pdf.service.js';
import { decryptSecret } from '../utils/secretBox.js';
import {
  isSubtaskAssignedToTechnician,
  isTaskAssignedToTechnician,
  markTaskStageHecho,
  markTaskStateHecho,
  markParentStageHechoIfAllChildrenResolved,
} from '../services/calendarTask.service.js';
import type {
  CreateConformidadInput,
  PatchConformidadInput,
  ListConformidadesQuery,
  AltaConformidadInput,
  CambioEquipoParejaInput,
  RetirosPendientesQuery,
  EquipoActualQuery,
  CambioEquipoPorSubtareaQuery,
} from '../schemas/conformidad.schema.js';

interface OwnableRecord {
  tecnicoId?: unknown;
  tipoServicio?: string | null;
  status?: string;
  tareaOdoo?: { id: number } | null;
  subtareaOdoo?: { id: number } | null;
}

// Handoff de una hoja cambio_equipo pendiente de POST: el técnico que hizo el
// PRE puede dejarla en pendiente_post y que la termine otro técnico distinto,
// si Odoo le asignó la subtarea (o la tarea, si no hay lote) a él — ver plan
// "Flujo cambio de equipo". Deliberadamente acotado a cambio_equipo +
// pendiente_post: no es un cambio general al modelo de ownership del resto de
// los tipos de servicio. Se prioriza subtareaOdoo sobre tareaOdoo porque dos
// unidades de un mismo lote pueden estar asignadas a técnicos distintos —
// compartir la tarea padre no alcanza para destrabar el acceso.
async function isAssignedToPendingSwap(req: Request, record: OwnableRecord): Promise<boolean> {
  if (record.tipoServicio !== 'cambio_equipo' || record.status !== 'pendiente_post') return false;

  const usuario = await UsuarioModel.findById(req.user!.usuarioId).select('odooUserId');
  if (!usuario?.odooUserId) return false;

  if (record.subtareaOdoo?.id) return isSubtaskAssignedToTechnician(record.subtareaOdoo.id, usuario.odooUserId);
  if (record.tareaOdoo?.id) return isTaskAssignedToTechnician(record.tareaOdoo.id, usuario.odooUserId);
  return false;
}

export async function assertOwnedByRequester(req: Request, record: OwnableRecord) {
  if (req.user!.role !== 'tecnico') return;
  if (String(record.tecnicoId) === String(req.user!.usuarioId)) return;
  if (await isAssignedToPendingSwap(req, record)) return;
  throw new HttpError(403, 'You can only access your own records');
}

// Vincula las 2 hojas de un cambio_equipo (retiro + instalación) escribiendo
// cambioEquipo.parejaId cruzado en ambos documentos — no hay backref
// automático de Mongoose para esto, así que hay que mantener los 2 lados a
// mano. Reusado por createConformidad (emparejado en el momento, si el
// técnico de instalación encontró el retiro) y por el endpoint de
// vinculación manual (cuando no se pudo emparejar en el momento y alguien lo
// hace después desde el panel web).
async function linkCambioEquipoPareja(id: string, parejaId: string) {
  if (id === parejaId) throw new HttpError(400, 'Una hoja no puede vincularse consigo misma.');

  const [a, b] = await Promise.all([
    ConformidadModel.findOne({ _id: id, deletedAt: null }),
    ConformidadModel.findOne({ _id: parejaId, deletedAt: null }),
  ]);
  if (!a || !b) throw new HttpError(404, 'Alguna de las 2 hojas no existe.');
  if (a.tipoServicio !== 'cambio_equipo' || b.tipoServicio !== 'cambio_equipo') {
    throw new HttpError(400, 'Las 2 hojas tienen que ser de tipo cambio_equipo.');
  }
  if (!a.cambioEquipo?.rol || !b.cambioEquipo?.rol || a.cambioEquipo.rol === b.cambioEquipo.rol) {
    throw new HttpError(400, 'Las 2 hojas tienen que tener roles opuestos (retiro + instalación).');
  }
  if (a.cambioEquipo.parejaId || b.cambioEquipo.parejaId) {
    throw new HttpError(409, 'Alguna de las 2 hojas ya está vinculada a otra.');
  }

  await Promise.all([
    ConformidadModel.updateOne({ _id: a._id }, { $set: { 'cambioEquipo.parejaId': b._id } }),
    ConformidadModel.updateOne({ _id: b._id }, { $set: { 'cambioEquipo.parejaId': a._id } }),
  ]);
}

export const createConformidad = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as CreateConformidadInput;

  const existing = await ConformidadModel.findOne({ clientId: body.clientId, deletedAt: null });
  if (existing) {
    res.status(200).json(existing);
    return;
  }

  const codigoActa = deriveCodigoActa(body.clientId, body.fecha);

  const record = await ConformidadModel.create({
    clientId: body.clientId,
    codigoActa,
    tipoServicio: body.tipoServicio ?? null,
    numero: body.numero,
    cliente: body.cliente,
    fecha: body.fecha,
    hora: body.hora,
    matricula: body.matricula,
    instalador: body.instalador,
    responsableEmpresa: body.responsableEmpresa,
    status: 'pendiente_post',
    tecnicoId: req.user!.usuarioId,
    pre: body.pre,
    ticketOdoo: body.ticketOdoo,
    tareaOdoo: body.tareaOdoo,
    subtareaOdoo: body.subtareaOdoo,
    cambioEquipo: body.cambioEquipo ? { rol: body.cambioEquipo.rol } : undefined,
  });

  // El emparejamiento en el momento de creación es "best effort": si la
  // pareja ya no está disponible (alguien más la vinculó, o el id vino mal),
  // la hoja igual se crea — el técnico puede seguir y vincularla después
  // desde el panel web, no tiene sentido perder el trabajo de campo por esto.
  if (body.cambioEquipo?.parejaId) {
    try {
      await linkCambioEquipoPareja(String(record._id), body.cambioEquipo.parejaId);
      record.cambioEquipo!.parejaId = new Types.ObjectId(body.cambioEquipo.parejaId);
    } catch (err) {
      console.error('CAMBIO_EQUIPO_LINK_AT_CREATE_FAILED', record._id, body.cambioEquipo.parejaId, err);
    }
  }

  res.status(201).json(record);
});

// Vinculación manual (o de respaldo, si no se pudo en el momento de crear la
// hoja) entre las 2 hojas de un cambio_equipo — ver linkCambioEquipoPareja.
export const linkCambioEquipoParejaHandler = asyncHandler(async (req: Request, res: Response) => {
  const { parejaId } = req.body as CambioEquipoParejaInput;
  await linkCambioEquipoPareja(String(req.params.id), parejaId);
  const record = await ConformidadModel.findById(req.params.id);
  res.json(record);
});

// Endpoint acotado y deliberadamente sin el filtro por tecnicoId que aplica
// listConformidades para el rol 'tecnico' (conformidades.controller.ts más
// abajo) — el punto de esta feature es justo que un técnico DISTINTO al que
// hizo el retiro pueda encontrar esa hoja para vincularla (ver plan: "otro
// técnico, otro día"). Solo expone lo mínimo necesario para elegir la hoja
// correcta, no el registro completo.
export const getRetirosPendientes = asyncHandler(async (req: Request, res: Response) => {
  const { matricula, rol } = req.query as unknown as RetirosPendientesQuery;

  const data = await ConformidadModel.find(
    {
      deletedAt: null,
      tipoServicio: 'cambio_equipo',
      'cambioEquipo.rol': rol,
      'cambioEquipo.parejaId': null,
      matricula: new RegExp(escapeRegExp(matricula), 'i'),
    },
    { numero: 1, codigoActa: 1, cliente: 1, matricula: 1, fecha: 1 },
  )
    .sort({ fechaHora: -1 })
    .limit(20);

  res.json({ data });
});

// Prellenado de equipo para reparación — busca de forma automática, no por
// búsqueda manual como retiros-pendientes: matrícula EXACTA (no regex
// parcial) y un solo resultado, la última hoja 'completo' de esa unidad, que
// es la que describe qué equipo hay instalado hoy. excludeId cubre el caso
// (no debería darse en el flujo normal) de que la propia hoja en edición ya
// esté en 'completo' al momento de buscar.
export const getEquipoActual = asyncHandler(async (req: Request, res: Response) => {
  const { matricula, excludeId } = req.query as unknown as EquipoActualQuery;

  const filter: Record<string, unknown> = {
    deletedAt: null,
    status: 'completo',
    matricula: new RegExp(`^${escapeRegExp(matricula)}$`, 'i'),
  };
  if (excludeId) filter._id = { $ne: excludeId };

  const record = await ConformidadModel.findOne(filter, { numero: 1, codigoActa: 1, cliente: 1, fecha: 1, equipo: 1 }).sort({
    fechaHora: -1,
  });

  res.json({ data: record });
});

export const patchConformidad = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as PatchConformidadInput;

  const record = await ConformidadModel.findOne({ _id: req.params.id, deletedAt: null });
  if (!record) throw new HttpError(404, 'Conformidad not found');

  await assertOwnedByRequester(req, record);

  // Handoff cross-técnico (ver isAssignedToPendingSwap): si quien está
  // completando el POST no es el técnico que dejó la hoja en pendiente_post,
  // se registra en tecnicoIdPost — no pisa tecnicoId, es solo auditoría.
  if (body.post && String(record.tecnicoId) !== String(req.user!.usuarioId)) {
    record.tecnicoIdPost = req.user!.usuarioId as unknown as typeof record.tecnicoIdPost;
  }

  // Capturado antes de tocar el record — así el aviso de "trabajo finalizado"
  // solo sale la primera vez que se cruza a 'completo', no en cada PATCH
  // posterior (ej. el técnico reintenta subir una foto después de firmado).
  const wasCompleto = record.status === 'completo';

  if (body.post && record.status === 'borrador_pre') {
    throw new HttpError(400, 'PRE must be finished before submitting POST data');
  }

  const topLevel = ['numero', 'cliente', 'fecha', 'hora', 'matricula', 'instalador', 'responsableEmpresa', 'tipoServicio'] as const;
  for (const key of topLevel) {
    if (body[key] !== undefined) (record as unknown as Record<string, unknown>)[key] = body[key];
  }

  if (body.ticketOdoo !== undefined) record.ticketOdoo = body.ticketOdoo as typeof record.ticketOdoo;

  if (body.pre) {
    if (body.pre.checklist) Object.assign(record.pre.checklist, body.pre.checklist);
    if (body.pre.observaciones !== undefined) record.pre.observaciones = body.pre.observaciones;
    if (body.pre.fotos !== undefined) record.pre.fotos = body.pre.fotos as typeof record.pre.fotos;
    if (body.pre.firma !== undefined) record.pre.firma = body.pre.firma as typeof record.pre.firma;
  }

  if (body.post) {
    if (body.post.checklist) Object.assign(record.post.checklist, body.post.checklist);
    if (body.post.observaciones !== undefined) record.post.observaciones = body.post.observaciones;
    if (body.post.fotos !== undefined) record.post.fotos = body.post.fotos as typeof record.post.fotos;
    if (body.post.firma !== undefined) record.post.firma = body.post.firma as typeof record.post.firma;

    // A client who refused to sign has no firma.url, but the job is still
    // finished — without the satisfaccion check, that case would leave the
    // record stuck at 'pendiente_post' forever server-side (even though the
    // técnico's own device already moved on).
    if (record.post.firma?.url || record.post.firma?.satisfaccion || record.post.firma?.clienteAusente) {
      record.status = 'completo';
    }
  }

  if (body.equipo) Object.assign(record.equipo, body.equipo);
  if (body.verificacionEquipo) {
    record.verificacionEquipo = { ...body.verificacionEquipo, at: new Date(body.verificacionEquipo.at) } as typeof record.verificacionEquipo;
  }

  await record.save();

  // Decoupled del guardado a propósito, mismo criterio que syncConformidadToOdoo
  // más abajo: si Telegram está caído o el cliente nunca hizo opt-in, eso
  // nunca debe impedir que el PATCH del técnico se guarde — notificarEstadoVisita
  // ya loguea y no tira.
  //
  // subtareaOdoo separa dos casos: sin lote, terminar ESTA hoja es terminar
  // la visita, directo. Con lote (subtareaOdoo seteado), esta unidad puede no
  // ser la última — cerrarVisitaLoteSiTodoResuelto revisa contra Odoo si ya
  // no le queda ninguna unidad PROPIA del técnico sin resolver (completa o
  // "no encontrada") y recién ahí cierra. Antes esto no se chequeaba nunca acá
  // y dependía 100% de que el técnico volviera a tocar "Finalizar visita" a
  // mano — si la tarea se reasignaba en el medio, esa ficha podía volverse
  // inalcanzable y el banner quedaba pegado para siempre.
  if (!wasCompleto && record.status === 'completo' && record.tareaOdoo?.id) {
    // Mueve la subtarea (o la tarea, si no hay lote) a la columna "Hecho" del
    // Kanban de Odoo Y pone su `state` (el circulito) en "Hecha" — ver
    // markTaskStageHecho/markTaskStateHecho. A diferencia de `stage_id` del
    // PADRE (ver markParentStageHechoIfAllChildrenResolved abajo), acá no hay
    // paso de aprobación pendiente: coordinación revisa después y mueve la
    // tarjeta a "Hecho con Producto" a mano, pero eso es una etapa de Kanban
    // más allá de "Hecho", no algo que dependa de reabrir `state`. Excepción:
    // la mitad "retiro" de un cambio_equipo partido en 2 hojas (ver
    // CambioEquipoSchema) comparte la MISMA subtarea que su pareja
    // "instalacion" — si se marcara acá, quedaría "Hecho"/"Hecha" con el
    // equipo nuevo todavía sin instalar. La mitad "instalacion" (o una hoja
    // sin cambioEquipo.rol, que es el caso normal) sí dispara el marcado.
    if (record.cambioEquipo?.rol !== 'retiro') {
      const taskId = record.subtareaOdoo?.id ?? record.tareaOdoo.id;
      await markTaskStageHecho(taskId);
      await markTaskStateHecho(taskId);
      // Unidad colapsada de 2+ project.task reales (§15.9b) — cada una
      // necesita su propio `stage_id`/`state`, Odoo no sabe que son "la
      // misma unidad".
      for (const mergedId of record.subtareaOdoo?.mergedTaskIds ?? []) {
        await markTaskStageHecho(mergedId);
        await markTaskStateHecho(mergedId);
      }
      // Si esta era la última subtarea del lote sin resolver, la tarea padre
      // (el lote en sí) también pasa a Hecho — ver
      // markParentStageHechoIfAllChildrenResolved. No aplica a una hoja
      // suelta (sin subtareaOdoo): ahí taskId ya ES la tarea, no tiene hijos.
      if (record.subtareaOdoo) {
        await markParentStageHechoIfAllChildrenResolved(record.tareaOdoo.id);
      }
    }

    if (!record.subtareaOdoo) {
      if (record.tecnicoId) await notificarEstadoVisita(record.tareaOdoo.id, 'completo', record.tecnicoId, record.fecha, body.completadoAt);
    } else {
      // req.user!.usuarioId, no record.tecnicoId: en un handoff cross-técnico
      // (ver isAssignedToPendingSwap) quien está cerrando esta unidad ahora
      // es quien tiene la visita abierta y las subtareas propias en curso —
      // no el técnico original que dejó la hoja en pendiente_post.
      await cerrarVisitaLoteSiTodoResuelto(record.tareaOdoo.id, req.user!.usuarioId, record.fecha, body.completadoAt);
    }
  }

  res.json(record);
});

// Separate from patchConformidad on purpose — this writes audit fields
// (quién y cuándo) as a side effect and is gated by area-vs-role, not by
// ownership like the técnico-facing PATCH.
export const setAltaConformidad = asyncHandler(async (req: Request, res: Response) => {
  const { area, checked } = req.body as AltaConformidadInput;

  const role = req.user!.role;
  const allowedArea = role === 'mesa_ayuda' ? 'mesaAyuda' : role === 'coordinacion' ? 'coordinacion' : null;
  if (allowedArea && area !== allowedArea) {
    throw new HttpError(403, `Tu rol solo puede marcar el check de ${allowedArea === 'mesaAyuda' ? 'mesa de ayuda' : 'coordinación'}`);
  }

  const record = await ConformidadModel.findOne({ _id: req.params.id, deletedAt: null });
  if (!record) throw new HttpError(404, 'Conformidad not found');

  record.altaEquipo[area] = checked
    ? { checked: true, usuarioId: req.user!.usuarioId, fecha: new Date() }
    : { checked: false, usuarioId: null, fecha: null };

  await record.save();
  res.json(record);
});

export const listConformidades = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListConformidadesQuery;

  const filter: Record<string, unknown> = { deletedAt: null };

  if (req.user!.role === 'tecnico') {
    filter.tecnicoId = req.user!.usuarioId;
  } else if (query.tecnicoId) {
    filter.tecnicoId = query.tecnicoId;
  }

  if (query.status) filter.status = query.status;
  if (query.tipoServicio) filter.tipoServicio = query.tipoServicio;
  if (query.cambioEquipoPendiente) {
    filter.tipoServicio = 'cambio_equipo';
    filter['cambioEquipo.rol'] = { $ne: null };
    filter['cambioEquipo.parejaId'] = null;
  }
  if (query.verificacionEquipo === 'bajo_responsabilidad') filter['verificacionEquipo.avanzoBajoResponsabilidad'] = true;
  else if (query.verificacionEquipo) filter['verificacionEquipo.estado'] = query.verificacionEquipo;
  if (query.altaMesaAyuda) filter['altaEquipo.mesaAyuda.checked'] = query.altaMesaAyuda === 'hecho';
  if (query.altaCoordinacion) filter['altaEquipo.coordinacion.checked'] = query.altaCoordinacion === 'hecho';
  if (query.matricula) filter.matricula = new RegExp(escapeRegExp(query.matricula), 'i');
  if (query.imei) filter['equipo.imei'] = new RegExp(escapeRegExp(query.imei), 'i');
  if (query.numero) filter.numero = new RegExp(escapeRegExp(query.numero), 'i');

  if (query.fechaDesde || query.fechaHasta) {
    const range: Record<string, Date> = {};
    if (query.fechaDesde) range.$gte = new Date(query.fechaDesde);
    if (query.fechaHasta) range.$lte = new Date(query.fechaHasta);
    filter.fechaHora = range;
  }

  if (query.search) {
    const re = new RegExp(escapeRegExp(query.search), 'i');
    filter.$or = [{ cliente: re }, { matricula: re }, { instalador: re }, { numero: re }, { 'equipo.imei': re }];
  }

  // Cuando se pide "altaMesaAyuda=hecho"/"altaCoordinacion=hecho" el caso de
  // uso es ver las últimas altas dadas — eso quiere decir ordenar por cuándo
  // se marcó el check, no por la fecha del servicio (fechaHora, el default).
  const sort: Record<string, 1 | -1> =
    query.altaMesaAyuda === 'hecho'
      ? { 'altaEquipo.mesaAyuda.fecha': -1 }
      : query.altaCoordinacion === 'hecho'
        ? { 'altaEquipo.coordinacion.fecha': -1 }
        : { fechaHora: -1 };

  const skip = (query.page - 1) * query.pageSize;
  const [data, total] = await Promise.all([
    ConformidadModel.find(filter).sort(sort).skip(skip).limit(query.pageSize),
    ConformidadModel.countDocuments(filter),
  ]);

  res.json({
    data,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.ceil(total / query.pageSize),
  });
});

export const getConformidadById = asyncHandler(async (req: Request, res: Response) => {
  const record = await ConformidadModel.findOne({ _id: req.params.id, deletedAt: null });
  if (!record) throw new HttpError(404, 'Conformidad not found');
  await assertOwnedByRequester(req, record);
  res.json(record);
});

// Handoff de cambio_equipo: el técnico al que Odoo le acaba de asignar una
// subtarea (o tarea, si no hay lote) puede traer a su agenda la hoja que otro
// técnico dejó en pendiente_post para esa misma unidad — reemplaza la
// búsqueda manual por patente para este caso. Devuelve la hoja completa (a
// diferencia de getRetirosPendientes, acá el objetivo es seguir trabajándola,
// no solo elegirla para vincular).
export const getCambioEquipoPorSubtarea = asyncHandler(async (req: Request, res: Response) => {
  const { subtareaOdooId, tareaOdooId } = req.query as unknown as CambioEquipoPorSubtareaQuery;

  const filter: Record<string, unknown> = {
    deletedAt: null,
    tipoServicio: 'cambio_equipo',
    status: 'pendiente_post',
  };
  if (subtareaOdooId) filter['subtareaOdoo.id'] = subtareaOdooId;
  else filter['tareaOdoo.id'] = tareaOdooId;

  const record = await ConformidadModel.findOne(filter).sort({ fechaHora: -1 });
  if (!record) {
    res.json({ data: null });
    return;
  }

  await assertOwnedByRequester(req, record);
  res.json({ data: record });
});

// Genera el PDF de la conformidad en memoria con Puppeteer y lo devuelve como
// stream binario (application/pdf). No se guarda en R2 ni en MongoDB — el PDF
// se produce bajo demanda cada vez. Esto elimina el almacenamiento en R2 y
// garantiza que el PDF siempre refleja el estado actual del registro.
export const generateConformidadPdf = asyncHandler(async (req: Request, res: Response) => {
  const record = await ConformidadModel.findOne({ _id: req.params.id, deletedAt: null });
  if (!record) throw new HttpError(404, 'Conformidad not found');
  await assertOwnedByRequester(req, record);

  const pdfBuffer = await renderConformidadPdf(record.toObject() as unknown as Parameters<typeof renderConformidadPdf>[0]);

  const filename = `Conformidad-${record.numero || record.id}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('Content-Length', pdfBuffer.length);
  res.send(pdfBuffer);
});

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

// record.fecha llega como 'YYYY-MM-DD' (ver src/shared/types.ts de la PWA) —
// se parsea a mano en vez de con `new Date()` para no arrastrar corrimiento
// de timezone, y se muestra como DD/MM/YYYY (formato ar) en vez del ISO tal
// cual, que en el mensaje del ticket se leía al revés.
function formatFechaArg(fecha: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : fecha;
}

const SATISFACCION_LABELS: Record<string, string> = {
  satisfecho: 'Firma conforme',
  insatisfecho: 'Firma disconforme',
  no_firma_insatisfecho: 'No firma por disconformidad',
};

// Decoupled from patchConformidad on purpose — Odoo being slow or down must
// never block the técnico's normal save. Mobile calls this right after a
// successful patch (and retries it independently if it fails).
export const syncConformidadToOdoo = asyncHandler(async (req: Request, res: Response) => {
  const record = await ConformidadModel.findOne({ _id: req.params.id, deletedAt: null });
  if (!record) throw new HttpError(404, 'Conformidad not found');
  await assertOwnedByRequester(req, record);

  if (!record.ticketOdoo?.numero) throw new HttpError(400, 'This record has no ticket de Odoo linked');

  // The PDF is posted to Odoo as the técnico, not a shared service account —
  // they must have linked their own Odoo login from the profile screen first.
  const usuario = await UsuarioModel.findById(req.user!.usuarioId);
  if (!usuario?.odoo) throw new HttpError(400, 'Vinculá tu cuenta de Odoo en tu perfil antes de enviar.');

  // TEMP — QA only: `?force=1` bypasses the idempotency guard below so a
  // record that already synced can be resent while testing the printHtml
  // PDF layout fix. Remove this query check once QA is done.
  if (record.odooSync?.status === 'SYNCED' && req.query.force !== '1') {
    res.json({ odooSync: record.odooSync });
    return;
  }

  const ticketId = record.ticketOdoo.odooId ?? Number(record.ticketOdoo.numero);
  if (!Number.isFinite(ticketId)) {
    record.odooSync = {
      status: 'FAILED',
      attempts: (record.odooSync?.attempts ?? 0) + 1,
      lastError: 'Ticket sin id numérico válido',
      lastAttemptAt: new Date(),
    };
    await record.save();
    res.json({ odooSync: record.odooSync });
    return;
  }

  // ticketOdoo llega del PATCH general (el técnico lo tipea/elige al vincular
  // el ticket) y nunca se re-valida contra Odoo después de eso — sin este
  // chequeo, un id manipulado o simplemente viejo/borrado terminaba
  // intentando adjuntar el PDF a un ticket que ya no existe, o a uno
  // cualquiera con solo ese número.
  const ticket = await verifyTicketExists(ticketId);
  if (!ticket) {
    record.odooSync = {
      status: 'FAILED',
      attempts: (record.odooSync?.attempts ?? 0) + 1,
      lastError: 'El ticket de Odoo vinculado ya no existe',
      lastAttemptAt: new Date(),
    };
    await record.save();
    res.json({ odooSync: record.odooSync });
    return;
  }

  const satisfaccion = record.post.firma?.satisfaccion;
  const motivo = record.post.firma?.motivo;
  const preFalla = record.pre?.fallaDetalle ? `<p><b>Falla notificada (PRE):</b> ${esc(record.pre.fallaDetalle)}</p>` : '';
  const postFalla = record.post?.fallaDetalle ? `<p><b>Falla notificada (POST):</b> ${esc(record.post.fallaDetalle)}</p>` : '';
  const preAirbag = record.pre?.item6AirbagDetalle ? `<p><b>Luz de airbag (PRE):</b> ${esc(record.pre.item6AirbagDetalle)}</p>` : '';
  const postAirbag = record.post?.item6AirbagDetalle ? `<p><b>Luz de airbag (POST):</b> ${esc(record.post.item6AirbagDetalle)}</p>` : '';
  const preGuine = record.pre?.item6GuineDetalle ? `<p><b>Luces de guiñe (PRE):</b> ${esc(record.pre.item6GuineDetalle)}</p>` : '';
  const postGuine = record.post?.item6GuineDetalle ? `<p><b>Luces de guiñe (POST):</b> ${esc(record.post.item6GuineDetalle)}</p>` : '';
  const preAlternador = record.pre?.item6AlternadorDetalle ? `<p><b>Luz de alternador (PRE):</b> ${esc(record.pre.item6AlternadorDetalle)}</p>` : '';
  const postAlternador = record.post?.item6AlternadorDetalle ? `<p><b>Luz de alternador (POST):</b> ${esc(record.post.item6AlternadorDetalle)}</p>` : '';
  const prePresion = record.pre?.item6PresionDetalle ? `<p><b>Luz de presión de aceite (PRE):</b> ${esc(record.pre.item6PresionDetalle)}</p>` : '';
  const postPresion = record.post?.item6PresionDetalle ? `<p><b>Luz de presión de aceite (POST):</b> ${esc(record.post.item6PresionDetalle)}</p>` : '';
  const preTemp = record.pre?.item6TempDetalle ? `<p><b>Luz de temperatura (PRE):</b> ${esc(record.pre.item6TempDetalle)}</p>` : '';
  const postTemp = record.post?.item6TempDetalle ? `<p><b>Luz de temperatura (POST):</b> ${esc(record.post.item6TempDetalle)}</p>` : '';
  const preItem7 = record.pre?.item7Detalle ? `<p><b>Tornillos de panel/tablero (PRE):</b> ${esc(record.pre.item7Detalle)}</p>` : '';
  const postItem7 = record.post?.item7Detalle ? `<p><b>Tornillos de panel/tablero (POST):</b> ${esc(record.post.item7Detalle)}</p>` : '';
  const preItem8 = record.pre?.item8Detalle ? `<p><b>Tapizados (PRE):</b> ${esc(record.pre.item8Detalle)}</p>` : '';
  const postItem8 = record.post?.item8Detalle ? `<p><b>Tapizados (POST):</b> ${esc(record.post.item8Detalle)}</p>` : '';
  const resumenHtml = `<p><b>Hoja de conformidad completada</b> — ${esc(record.cliente)} (${esc(record.matricula)})</p>
    <p>Fecha: ${esc(formatFechaArg(record.fecha))} ${esc(record.hora)}<br>Técnico: ${esc(record.instalador)}</p>
    ${satisfaccion ? `<p>Estado de firma: ${esc(SATISFACCION_LABELS[satisfaccion] ?? satisfaccion)}</p>` : ''}
    ${motivo ? `<p>Motivo: ${esc(motivo)}</p>` : ''}
    ${record.post.firma?.clienteAusente ? '<p>Cliente ausente</p>' : ''}
    ${preFalla}
    ${postFalla}
    ${preAirbag}
    ${postAirbag}
    ${preGuine}
    ${postGuine}
    ${preAlternador}
    ${postAlternador}
    ${prePresion}
    ${postPresion}
    ${preTemp}
    ${postTemp}
    ${preItem7}
    ${postItem7}
    ${preItem8}
    ${postItem8}`;

  try {
    // Generar el PDF en memoria para adjuntarlo a Odoo — no se guarda en R2.
    const pdfBuffer = await renderConformidadPdf(record.toObject() as unknown as Parameters<typeof renderConformidadPdf>[0]);
    await pushConformidadToTicket({
      ticketId,
      pdfBuffer,
      fileName: `hoja_conformidad_${record.codigoActa}.pdf`,
      resumenHtml,
      as: { login: usuario.odoo.login, password: decryptSecret(usuario.odoo.passwordEnc) },
    });
    record.odooSync = {
      status: 'SYNCED',
      attempts: (record.odooSync?.attempts ?? 0) + 1,
      syncedAt: new Date(),
      lastError: '',
      lastAttemptAt: new Date(),
    };
  } catch (err) {
    const message = err instanceof OdooError ? `${err.code}: ${err.message}` : err instanceof Error ? err.message : String(err);
    console.error('ODOO_SYNC_FAILURE', record.id, message);
    record.odooSync = {
      status: 'FAILED',
      attempts: (record.odooSync?.attempts ?? 0) + 1,
      lastError: message,
      lastAttemptAt: new Date(),
    };
  }

  await record.save();
  res.json({ odooSync: record.odooSync });
});

export const deleteConformidad = asyncHandler(async (req: Request, res: Response) => {
  const record = await ConformidadModel.findOneAndUpdate(
    { _id: req.params.id, deletedAt: null },
    { $set: { deletedAt: new Date() } },
    { new: true },
  );
  if (!record) throw new HttpError(404, 'Conformidad not found');
  res.status(204).send();
});
