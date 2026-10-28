import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { env } from '../config/env.js';
import { HttpError } from '../middleware/error.middleware.js';
import { SubtareaIncidenciaModel } from '../models/SubtareaIncidencia.js';
import { UsuarioModel } from '../models/Usuario.js';
import { VisitaNotificacionModel } from '../models/VisitaNotificacion.js';
import { clasificarLlegada, constanciaYaEnviada, enviaConstanciaAlReportar } from '../services/clasificarIncidencia.js';
import { IncidenciaDestinatarioModel } from '../models/IncidenciaDestinatario.js';
import { decryptSecret } from '../utils/secretBox.js';
import { postSubtareaNoEncontrada, postTicketNote, pushReprogramacionToTicket, scheduleSubtareaReprogramarActivity } from '../services/odoo.service.js';
import { buildReprogramacionPdfBuffer, buildConstanciaVisitaFallidaPdfBuffer, buildReprogramacionClientePdfBuffer } from '../services/pdf.service.js';
import { buildIncidenciaFirmaKey, uploadBuffer } from '../services/r2.service.js';
import { formatoFechaHora } from '../services/reprogramacionPdf.js';
import {
  odooTaskUrl,
  markTaskWaiting,
  markTaskStageVisitaFallida,
  markParentStageVisitaFallidaIfAllChildrenFailed,
  moveCalendarTask,
  reopenTask,
  reopenParentIfVisitaFallida,
  reassignTaskTechnician,
  moveParentDateIfSafe,
  verificarTareaCoincide,
} from '../services/calendarTask.service.js';
import type {
  CreateSubtareaIncidenciaInput,
  ListSubtareaIncidenciasQuery,
  ResolveSubtareaIncidenciaInput,
} from '../schemas/subtareaIncidencia.schema.js';

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function formatoArgentina(d: Date): string {
  return new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'short', timeStyle: 'short' }).format(d);
}

// Formato de fecha de Odoo: "YYYY-MM-DD HH:mm:ss" en UTC.
function aFechaOdoo(d: Date): string {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

// El técnico marca, desde la agenda de la PWA, que una unidad del lote no
// estaba físicamente en el lugar — no hay Conformidad que generar (ver
// ALCANCE_BACKOFFICE.md §14), pero coordinación necesita verlo para
// reprogramar esa unidad puntual. La incidencia en Mongo es la fuente de
// verdad para el panel web; el comentario en Odoo es un plus best-effort (si
// el técnico no tiene su cuenta de Odoo vinculada, o Odoo falla, la
// incidencia se guarda igual).
export const createSubtareaIncidencia = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as CreateSubtareaIncidenciaInput;

  // Idempotencia: si este reporte ya llegó (el cliente reintenta tras un timeout), se devuelve el existente sin
  // repetir la nota en Odoo ni los avisos.
  if (body.clientId) {
    const existente = await SubtareaIncidenciaModel.findOne({ clientId: body.clientId, tecnicoId: req.user!.usuarioId });
    if (existente) {
      res.status(200).json(existente.toObject());
      return;
    }
  }

  // Momento real del reporte (offline): se acepta si no es futuro y tiene menos de 72 h; si no, hora del servidor.
  const ocurrio = body.ocurrioAt ? new Date(body.ocurrioAt) : null;
  const ahora = Date.now();
  const createdAt = ocurrio && ocurrio.getTime() <= ahora && ahora - ocurrio.getTime() < 72 * 3_600_000 ? ocurrio : undefined;

  const propuesta = body.propuestaInicio && body.propuestaFin ? { inicio: new Date(body.propuestaInicio), fin: new Date(body.propuestaFin) } : null;

  // Rango horario: las visitas se agendan por rango (ej. 12:00 a 13:00) y el técnico puede llegar en cualquier momento de
  // él. Solo si marcó "llegué" DESPUÉS de que terminó el rango, la visita es en parte culpa de WARA (sin cargo para el
  // cliente); si no, es visita fallida. Sin el fin del rango o sin "llegué" marcado no se decide (queda como visita
  // fallida). El tipo que reportó el técnico NO se cambia: lo que cambia es `fueraDeRango`.
  const horaAgendada = body.horaAgendada ? new Date(body.horaAgendada) : null;
  const horaFinAgendada = body.horaFinAgendada ? new Date(body.horaFinAgendada) : null;
  const viaje = await VisitaNotificacionModel.findOne({ tareaOdooId: body.tareaOdooId, tecnicoId: req.user!.usuarioId, fecha: body.fecha })
    .sort({ createdAt: -1 })
    .select('enSitioAt');
  const llegadaAt: Date | null = viaje?.enSitioAt ?? null;
  const tipoSugerido = clasificarLlegada(horaFinAgendada, llegadaAt);
  const fueraDeRango = tipoSugerido === 'llegada_tarde';

  // Firma del cliente: la API sube el PNG a R2 (en Mongo queda la URL, no la imagen). Si la subida falla el reporte
  // no se guarda y el cliente reintenta con el mismo clientId, así nunca queda una constancia sin su firma.
  let firmaCliente: { url: string; nombre: string; dni: string; sinFirma: boolean; motivoSinFirma: string } | undefined;
  if (body.firma || body.sinFirma) {
    if (body.firma) {
      const png = Buffer.from(body.firma.png.slice('data:image/png;base64,'.length), 'base64');
      const localId = body.clientId ?? `${body.subtareaOdooId}-${body.fecha}-${Date.now()}`;
      const { publicUrl } = await uploadBuffer(buildIncidenciaFirmaKey(localId, body.fecha), png, 'image/png');
      firmaCliente = { url: publicUrl, nombre: body.firma.nombre, dni: body.firma.dni, sinFirma: false, motivoSinFirma: '' };
    } else {
      firmaCliente = { url: '', nombre: '', dni: '', sinFirma: true, motivoSinFirma: body.sinFirma?.motivo ?? '' };
    }
  }

  const incidencia = await SubtareaIncidenciaModel.create({
    clientId: body.clientId,
    tipo: body.tipo,
    horaAgendada,
    horaFinAgendada,
    fueraDeRango,
    llegadaAt,
    tipoSugerido,
    ...(firmaCliente ? { firmaCliente } : {}),
    ...(propuesta ? { estado: 'propuesta_pendiente', propuestaInicio: propuesta.inicio, propuestaFin: propuesta.fin } : {}),
    ...(createdAt ? { createdAt } : {}),
    tareaOdooId: body.tareaOdooId,
    subtareaOdooId: body.subtareaOdooId,
    subtareaNombre: body.subtareaNombre ?? '',
    ticketOdooId: body.ticketOdooId ?? null,
    clienteNombre: body.clienteNombre ?? '',
    mergedTaskIds: body.mergedTaskIds,
    tecnicoId: req.user!.usuarioId,
    fecha: body.fecha,
    motivo: body.motivo,
  });

  const usuario = await UsuarioModel.findById(req.user!.usuarioId);
  const titulo =
    body.tipo === 'reprogramado_cliente'
      ? 'El cliente pidió reprogramar la visita'
      : body.tipo === 'pre_cancelado'
      ? 'PRE cancelado por el técnico'
      : 'Unidad no encontrada en el lugar';
  const bodyHtml = `<p><b>${titulo}</b> — reportado por ${esc(usuario?.nombre || usuario?.email || 'un técnico')} el ${esc(body.fecha)}.</p>${
    body.motivo ? `<p>Motivo: ${esc(body.motivo)}</p>` : ''
  }${fueraDeRango ? '<p>El técnico llegó fuera del rango horario agendado: reprogramación sin cargo para el cliente.</p>' : ''}${
    propuesta
      ? body.tipo === 'reprogramado_cliente'
        ? `<p>Fecha elegida por el cliente: <b>${esc(formatoArgentina(propuesta.inicio))}</b> a ${esc(formatoArgentina(propuesta.fin))}. ${body.firma ? `Firmó ${esc(body.firma.nombre)}.` : `Sin firma: ${esc(body.sinFirma?.motivo ?? '')}.`} Coordinación puede aceptar, cambiar la hora o rechazar.</p>`
        : `<p>Reprogramación propuesta: <b>${esc(formatoArgentina(propuesta.inicio))}</b> a ${esc(formatoArgentina(propuesta.fin))}. Pendiente de aceptación por coordinación.</p>`
      : ''
  }`;

  if (usuario?.odoo) {
    try {
      await postSubtareaNoEncontrada({
        subtareaOdooId: body.subtareaOdooId,
        bodyHtml,
        as: { login: usuario.odoo.login, password: decryptSecret(usuario.odoo.passwordEnc) },
      });
    } catch (err) {
      console.error('SUBTAREA_INCIDENCIA_ODOO_NOTE_FAILED', body.subtareaOdooId, err);
    }
  }

  // Recordatorio para coordinación (mail.activity) — corre con la cuenta de
  // servicio, no la del técnico (ver scheduleSubtareaReprogramarActivity en
  // odoo.service.ts), así que llega siempre que haya destinatarios
  // configurados, sin depender de si el técnico vinculó su propia cuenta de
  // Odoo. Convive con el comentario de arriba a propósito, no lo reemplaza.
  try {
    const destinatarios = await IncidenciaDestinatarioModel.find();
    if (destinatarios.length) {
      await scheduleSubtareaReprogramarActivity({
        subtareaOdooId: body.subtareaOdooId,
        summary: body.tipo === 'reprogramado_cliente'
          ? 'Confirmar reprogramación pedida por el cliente'
          : propuesta
          ? 'Responder propuesta de reprogramación del técnico'
          : body.tipo === 'pre_cancelado'
            ? 'Reprogramar visita — PRE cancelado'
            : 'Reprogramar visita — unidad no encontrada',
        note: bodyHtml,
        userIds: destinatarios.map((d) => d.odooUserId),
      });
    }
  } catch (err) {
    console.error('SUBTAREA_INCIDENCIA_ODOO_ACTIVITY_FAILED', body.subtareaOdooId, err);
  }

  // Deja la subtarea en "En espera" (state) y mueve su tarjeta a "Visita
  // fallida" (stage_id, la columna del Kanban que coordinación efectivamente
  // mira) — mismo criterio que patchConformidad para "Hecho": la actividad de
  // arriba (scheduleSubtareaReprogramarActivity) ya avisa puntualmente a
  // quien corresponda, esto además la hace visible de un vistazo en el
  // Kanban. Best-effort, con su propio try/catch interno — nunca depende de
  // si el técnico vinculó su cuenta de Odoo, corre con la cuenta de servicio.
  await markTaskWaiting(body.subtareaOdooId);
  await markTaskStageVisitaFallida(body.subtareaOdooId);
  // Unidad colapsada de 2+ project.task reales (§15.9b) — cada una necesita
  // su propio `state`/`stage_id`.
  for (const mergedId of body.mergedTaskIds ?? []) {
    await markTaskWaiting(mergedId);
    await markTaskStageVisitaFallida(mergedId);
  }
  // Si esta era la última unidad del lote sin resolver y TODAS terminaron en
  // "Visita fallida" (ninguna se completó), la tarea padre también pasa a esa
  // etapa — ver markParentStageVisitaFallidaIfAllChildrenFailed. Un lote con
  // un mix (alguna Hecho, alguna fallida) queda sin tocar a propósito.
  await markParentStageVisitaFallidaIfAllChildrenFailed(body.tareaOdooId);

  // Reprogramación a pedido del cliente: el PDF con su firma sale ahora (la fecha ya está acordada con él), no
  // cuando coordinación responda. Best-effort, igual que el resto: si falla queda el error en la incidencia.
  if (body.tipo === 'reprogramado_cliente' && propuesta && body.ticketOdooId && firmaCliente) {
    try {
      const nombre = (body.subtareaNombre || body.subtareaOdooId).toString();
      const pdfBuffer = await buildReprogramacionClientePdfBuffer({
        subtareaNombre: body.subtareaNombre ?? '',
        clienteNombre: body.clienteNombre ?? '',
        ticketNumero: body.ticketOdooId,
        tecnicoNombre: usuario?.nombre || usuario?.email || '',
        horaAgendada,
        horaFinAgendada,
        fueraDeRango,
        llegadaAt,
        reportadaAt: createdAt ?? new Date(),
        motivo: body.motivo,
        nuevaInicio: propuesta.inicio,
        nuevaFin: propuesta.fin,
        firma: body.firma ? { src: body.firma.png, nombre: body.firma.nombre, dni: body.firma.dni } : null,
        motivoSinFirma: firmaCliente.motivoSinFirma,
      });
      await pushReprogramacionToTicket({
        ticketId: body.ticketOdooId,
        pdfBuffer,
        fileName: `reprogramacion_cliente_${nombre.replace(/[^\w.-]+/g, '_')}.pdf`,
        resumenHtml: `<p><b>Reprogramación a pedido del cliente</b> — ${esc(body.subtareaNombre)} (${esc(body.clienteNombre)}). El técnico se presentó en el lugar y el cliente pidió cambiar la visita.</p><p>Nueva fecha y hora elegida por el cliente: <b>${esc(formatoFechaHora(propuesta.inicio))}</b>.</p>`,
        as: usuario?.odoo ? { login: usuario.odoo.login, password: decryptSecret(usuario.odoo.passwordEnc) } : undefined,
      });
      incidencia.pdfReprogramacionAt = new Date();
      incidencia.pdfReprogramacionError = '';
    } catch (err) {
      console.error('SUBTAREA_INCIDENCIA_PDF_CLIENTE_FAILED', incidencia.id, err);
      incidencia.pdfReprogramacionError = err instanceof Error ? err.message.slice(0, 300) : 'Error al enviar el PDF';
    }
    await incidencia.save();
  }

  // "No está en el lugar" dentro del rango horario: la constancia de visita fallida sale AHORA, en el momento en que el
  // técnico confirma, para que el ticket quede con la prueba de que fue al lugar sin esperar a coordinación. Si llegó
  // fuera del rango no sale todavía (va la reprogramación sin cargo, que necesita la fecha nueva, al resolver). La fecha
  // nueva se agrega después con una nota en el ticket. Best-effort: si falla, queda el error y al resolver se reintenta.
  // APAGADO por defecto (env.CONSTANCIA_AL_REPORTAR): por ahora el reporte no manda nada a Odoo.
  if (env.CONSTANCIA_AL_REPORTAR && enviaConstanciaAlReportar({ tipo: body.tipo, fueraDeRango, ticketOdooId: body.ticketOdooId })) {
    try {
      const nombre = (body.subtareaNombre || body.subtareaOdooId).toString();
      const pdfBuffer = await buildConstanciaVisitaFallidaPdfBuffer({
        subtareaNombre: body.subtareaNombre ?? '',
        clienteNombre: body.clienteNombre ?? '',
        ticketNumero: body.ticketOdooId!,
        tecnicoNombre: usuario?.nombre || usuario?.email || '',
        horaAgendada,
        horaFinAgendada,
        tipo: 'no_encontrada',
        llegadaAt,
        reportadaAt: createdAt ?? new Date(),
        motivo: body.motivo,
        nuevaInicio: propuesta?.inicio ?? null,
      });
      await pushReprogramacionToTicket({
        ticketId: body.ticketOdooId!,
        pdfBuffer,
        fileName: `visita_fallida_${nombre.replace(/[^\w.-]+/g, '_')}.pdf`,
        resumenHtml: `<p><b>Visita fallida</b> — ${esc(body.subtareaNombre)} (${esc(body.clienteNombre)}). El técnico se presentó en el lugar y la unidad no se encontraba.</p>`,
        as: usuario?.odoo ? { login: usuario.odoo.login, password: decryptSecret(usuario.odoo.passwordEnc) } : undefined,
      });
      incidencia.pdfReprogramacionAt = new Date();
      incidencia.pdfReprogramacionError = '';
    } catch (err) {
      console.error('SUBTAREA_INCIDENCIA_CONSTANCIA_AL_REPORTAR_FAILED', incidencia.id, err);
      incidencia.pdfReprogramacionError = err instanceof Error ? err.message.slice(0, 300) : 'Error al enviar el PDF';
    }
    await incidencia.save();
  }

  // A propósito NO se cierra la visita automáticamente acá aunque esta haya
  // sido la última unidad pendiente (a diferencia de patchConformidad, que sí
  // cierra sola al completar la última hoja por POST) — reportar "no está" es
  // una acción del técnico mientras sigue ahí mismo en la ficha, así que la
  // PWA le pide confirmación explícita y recién ahí llama a
  // /visitas/:id/finalizar (ver enviarNoEncontrada en AgendaTaskSheet.tsx).
  // Antes esto cerraba en silencio (cerrarVisitaLoteSiTodoResuelto), lo que
  // terminaba la visita sin que el técnico llegara a confirmarlo.
  res.status(201).json(incidencia);
});

export const listSubtareaIncidencias = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListSubtareaIncidenciasQuery;
  const filter: Record<string, unknown> = {};
  if (query.estado) filter.estado = query.estado.length === 1 ? query.estado[0] : { $in: query.estado };
  if (query.fecha) filter.fecha = query.fecha;
  // Mismo criterio que el resto de los endpoints scopeados por rol: un
  // técnico solo ve lo suyo, coordinación/mesa_ayuda/admin ven todo.
  if (req.user!.role === 'tecnico') filter.tecnicoId = req.user!.usuarioId;

  // Populado con nombre/email del técnico — el panel web necesita mostrar
  // quién reportó cada incidencia sin pedirle al front que cruce contra
  // /api/auth/usuarios (que mesa_ayuda ni siquiera puede ver).
  const skip = (query.page - 1) * query.pageSize;
  const [rows, total] = await Promise.all([
    SubtareaIncidenciaModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.pageSize)
      .populate('tecnicoId', 'nombre email'),
    SubtareaIncidenciaModel.countDocuments(filter),
  ]);

  // El panel necesita poder ir directo a la subtarea (la unidad puntual a
  // reprogramar) en Odoo, no solo a la tarea/lote padre — mismo link
  // "universal" que ya arma el calendario (ver calendarTask.service.ts).
  const data = rows.map((r) => ({
    ...r.toObject(),
    subtareaOdooUrl: odooTaskUrl(r.subtareaOdooId),
    tareaOdooUrl: odooTaskUrl(r.tareaOdooId),
  }));
  res.json({
    data,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.ceil(total / query.pageSize),
  });
});

// Con start/end, este PATCH además reprograma de verdad la subtarea en Odoo
// (fecha nueva + la reabre de "Visita fallida"/"En espera" a "Nuevo"/"En
// progreso" + técnico opcional) antes de marcar la incidencia resuelta — ver
// plan "Reprogramar visita fallida desde el panel". Sin start/end, se
// comporta igual que antes (coordinación que ya reprogramó a mano en Odoo y
// solo quiere tildar el check).
const REPROGRAMAR_ROLES = new Set(['coordinacion', 'admin', 'superadmin']);

export const resolveSubtareaIncidencia = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as ResolveSubtareaIncidenciaInput;
  const incidencia = await SubtareaIncidenciaModel.findById(req.params.id);
  if (!incidencia) throw new HttpError(404, 'Incidencia not found');

  // Rechazo de la propuesta del técnico: no toca Odoo (la unidad ya está "En espera"), solo deja el motivo y la
  // incidencia queda para reprogramar por el camino de siempre. Lo decide coordinación, no mesa de ayuda.
  if (body.estado === 'rechazada') {
    if (!REPROGRAMAR_ROLES.has(req.user!.role)) throw new HttpError(403, 'Tu rol no puede responder propuestas de reprogramación.');
    if (incidencia.estado !== 'propuesta_pendiente') throw new HttpError(409, 'La incidencia no tiene una propuesta pendiente.');
    incidencia.estado = 'rechazada';
    incidencia.motivoRechazo = body.motivoRechazo ?? '';
    incidencia.resueltaPor = req.user!.usuarioId;
    incidencia.resueltaAt = new Date();
    await incidencia.save();
    res.json(incidencia.toObject());
    return;
  }

  // Aceptar la propuesta tal cual: sin start/end en el body se usa la hora que propuso el técnico; con
  // start/end coordinación la cambia al aceptar.
  if (!body.start && incidencia.estado === 'propuesta_pendiente' && incidencia.propuestaInicio && incidencia.propuestaFin) {
    body.start = aFechaOdoo(incidencia.propuestaInicio);
    body.end = aFechaOdoo(incidencia.propuestaFin);
  }

  // Coordinación corrige si fue visita fallida o llegada fuera del rango (sin cargo) antes de que salga el PDF.
  // Una incidencia vieja con tipo 'llegada_tarde' ya es sin cargo.
  const sinCargoActual = incidencia.fueraDeRango === true || incidencia.tipo === 'llegada_tarde';
  if (body.tipo && incidencia.tipo !== 'requiere_otro_tecnico' && incidencia.tipo !== 'reprogramado_cliente' && (body.tipo === 'llegada_tarde') !== sinCargoActual) {
    if (!REPROGRAMAR_ROLES.has(req.user!.role)) throw new HttpError(403, 'Tu rol no puede cambiar el tipo de la incidencia.');
    incidencia.fueraDeRango = body.tipo === 'llegada_tarde';
    if (incidencia.tipo === 'llegada_tarde' && body.tipo === 'no_encontrada') incidencia.tipo = 'no_encontrada';
    incidencia.tipoCorregidoPor = req.user!.usuarioId;
  }

  // Solo tiene sentido cuando se reprograma de verdad (body.start/body.end) —
  // undefined en la respuesta para el camino viejo ("marcar resuelta" nomás).
  let parentDateMoved: boolean | undefined;

  if (body.start && body.end) {
    // Escritura real a Odoo (fecha + reabrir etapa/estado + reasignar
    // técnico) — no solo un flag en Mongo, así que exige un rol con permiso
    // de escritura (mismo criterio que /calendar/tasks/:id/move), a
    // diferencia del simple "marcar resuelta" de abajo, disponible también
    // para mesa_ayuda.
    if (!REPROGRAMAR_ROLES.has(req.user!.role)) {
      throw new HttpError(403, 'Tu rol no puede reprogramar la visita en Odoo, solo marcar la incidencia como resuelta.');
    }

    const ids = [incidencia.subtareaOdooId, ...(incidencia.mergedTaskIds ?? [])];
    // ANTES de escribir nada: cada tarea tiene que ser la que se reportó (mismo nombre y mismo padre) y no estar cerrada.
    // Si el registro se creó contra otro Odoo (pruebas vs. producción) o la tarea cambió, el mismo id apunta a una tarea
    // ajena: se rechaza con un aviso claro y no se toca nada en Odoo ni en la incidencia.
    for (const id of ids) {
      const verificacion = await verificarTareaCoincide(id, {
        nombre: incidencia.subtareaNombre,
        parentId: incidencia.tareaOdooId !== incidencia.subtareaOdooId ? incidencia.tareaOdooId : null,
        ticketId: incidencia.ticketOdooId ?? null,
      });
      if (!verificacion.ok) throw new HttpError(409, verificacion.motivo);
    }
    // Sin try/catch a propósito: si Odoo falla, el error se propaga como
    // error HTTP y la incidencia NO se marca reprogramada — a diferencia del
    // resto de este archivo (best-effort), acá marcarla resuelta sin que Odoo
    // se haya movido de verdad dejaría la unidad perdida de la agenda del
    // técnico sin que nadie se entere.
    for (const id of ids) {
      await moveCalendarTask(id, { start: body.start, end: body.end });
      await reopenTask(id);
      if (body.technicianId) await reassignTaskTechnician(id, body.technicianId);
    }
    // El técnico ya ve esta unidad en su agenda el día correcto sin esto
    // (listCalendarTasks arma una entrada por cada fecha real distinta entre
    // las subtareas de un lote, ver calendarTask.service.ts) — esto es solo
    // prolijidad: cuando es seguro, fusiona la unidad reprogramada de vuelta
    // en la misma entrada que el resto del lote en vez de dejarla aparte. Se
    // salta a propósito si el lote tiene otra unidad todavía activa en otra
    // fecha (ver parentDateIsSafeToMove) — esa unidad simplemente sigue
    // viéndose en su propia entrada.
    parentDateMoved = await moveParentDateIfSafe(incidencia.tareaOdooId, ids, { start: body.start, end: body.end });
    await reopenParentIfVisitaFallida(incidencia.tareaOdooId);
  }

  const propuestaOriginal =
    incidencia.estado === 'propuesta_pendiente' && incidencia.propuestaInicio && incidencia.propuestaFin
      ? { inicio: incidencia.propuestaInicio, fin: incidencia.propuestaFin }
      : null;
  incidencia.estado = body.estado;
  incidencia.resueltaPor = req.user!.usuarioId;
  incidencia.resueltaAt = new Date();
  // `start` viene como string UTC de Odoo ("YYYY-MM-DD HH:mm:ss").
  if (body.start) {
    const para = new Date(`${body.start.replace(' ', 'T')}Z`);
    if (!Number.isNaN(para.getTime())) incidencia.reprogramadaPara = para;
  }

  // PDF al ticket, con el nombre de la subtarea. Si el técnico llegó dentro del rango horario → constancia de visita
  // fallida (facturable), que sale aunque todavía no haya fecha nueva. Si llegó DESPUÉS de que terminó el rango → PDF de
  // reprogramación sin cargo, que necesita la fecha nueva. Best-effort: la reprogramación ya se hizo en Odoo, así que si
  // esto falla se anota el error en la incidencia y no se corta la respuesta.
  const sinCargo = incidencia.fueraDeRango === true || incidencia.tipo === 'llegada_tarde';
  const esConstancia = !sinCargo;
  // Si la constancia ya salió al reportar no se manda otra: con fecha nueva alcanza una nota en el ticket (más abajo).
  const yaEnviada = esConstancia && constanciaYaEnviada(incidencia);
  // Una derivación (la visita ya se hizo y tiene su propia hoja en el ticket) no genera constancia ni PDF de reprogramación.
  if (!yaEnviada && incidencia.tipo !== 'requiere_otro_tecnico' && incidencia.tipo !== 'reprogramado_cliente' && incidencia.ticketOdooId && ((body.start && body.end) || esConstancia)) {
    try {
      const tecnico = await UsuarioModel.findById(incidencia.tecnicoId);
      const nuevaInicio = body.start ? new Date(`${body.start.replace(' ', 'T')}Z`) : null;
      const nuevaFin = body.end ? new Date(`${body.end.replace(' ', 'T')}Z`) : null;
      const reportadaAt = (incidencia as unknown as { createdAt: Date }).createdAt;
      const tecnicoNombre = tecnico?.nombre || tecnico?.email || '';
      const nombre = (incidencia.subtareaNombre || incidencia.subtareaOdooId).toString();
      const pdfBuffer = esConstancia
        ? await buildConstanciaVisitaFallidaPdfBuffer({
            subtareaNombre: incidencia.subtareaNombre,
            clienteNombre: incidencia.clienteNombre,
            ticketNumero: incidencia.ticketOdooId,
            tecnicoNombre,
            horaAgendada: incidencia.horaAgendada,
            horaFinAgendada: incidencia.horaFinAgendada,
            tipo: incidencia.tipo === 'pre_cancelado' ? 'pre_cancelado' : 'no_encontrada',
            llegadaAt: incidencia.llegadaAt,
            reportadaAt,
            motivo: incidencia.motivo,
            nuevaInicio,
          })
        : await buildReprogramacionPdfBuffer({
            subtareaNombre: incidencia.subtareaNombre,
            clienteNombre: incidencia.clienteNombre,
            ticketNumero: incidencia.ticketOdooId,
            tecnicoNombre,
            reportadaAt,
            nuevaInicio: nuevaInicio!,
            nuevaFin: nuevaFin!,
            motivo: incidencia.motivo,
            tipo: 'llegada_tarde',
            horaAgendada: incidencia.horaAgendada,
            horaFinAgendada: incidencia.horaFinAgendada,
            llegadaAt: incidencia.llegadaAt,
            propuestaOriginal,
          });
      await pushReprogramacionToTicket({
        ticketId: incidencia.ticketOdooId,
        pdfBuffer,
        fileName: `${esConstancia ? 'visita_fallida' : 'reprogramacion'}_${nombre.replace(/[^\w.-]+/g, '_')}.pdf`,
        resumenHtml: esConstancia
          ? `<p><b>Visita fallida</b> — ${esc(incidencia.subtareaNombre)} (${esc(incidencia.clienteNombre)}). ${incidencia.tipo === 'pre_cancelado' ? 'El técnico se presentó dentro del rango horario y la visita no pudo completarse.' : 'La unidad no se encontraba en el lugar.'}</p>${nuevaInicio ? `<p>Nueva fecha y hora: <b>${esc(formatoFechaHora(nuevaInicio))}</b>.</p>` : ''}`
          : `<p><b>Visita reprogramada (sin cargo)</b> — ${esc(incidencia.subtareaNombre)} (${esc(incidencia.clienteNombre)}). El técnico llegó fuera del rango horario agendado.</p><p>Nueva fecha y hora: <b>${esc(formatoFechaHora(nuevaInicio!))}</b>.</p>`,
        as: tecnico?.odoo ? { login: tecnico.odoo.login, password: decryptSecret(tecnico.odoo.passwordEnc) } : undefined,
      });
      incidencia.pdfReprogramacionAt = new Date();
      incidencia.pdfReprogramacionError = '';
    } catch (err) {
      console.error('SUBTAREA_INCIDENCIA_PDF_REPROGRAMACION_FAILED', incidencia.id, err);
      incidencia.pdfReprogramacionError = err instanceof Error ? err.message.slice(0, 300) : 'Error al enviar el PDF';
    }
  }
  // La constancia de visita fallida ya está en el ticket (salió al reportar): al reprogramar se deja solo la fecha nueva.
  if (yaEnviada && incidencia.ticketOdooId && body.start) {
    try {
      const tecnico = await UsuarioModel.findById(incidencia.tecnicoId);
      await postTicketNote({
        ticketId: incidencia.ticketOdooId,
        bodyHtml: `<p><b>Visita reprogramada</b> — ${esc(incidencia.subtareaNombre)} (${esc(incidencia.clienteNombre)}). Nueva fecha y hora: <b>${esc(formatoFechaHora(new Date(`${body.start.replace(' ', 'T')}Z`)))}</b>.</p>`,
        as: tecnico?.odoo ? { login: tecnico.odoo.login, password: decryptSecret(tecnico.odoo.passwordEnc) } : undefined,
      });
    } catch (err) {
      console.error('SUBTAREA_INCIDENCIA_NOTA_FECHA_NUEVA_FAILED', incidencia.id, err);
    }
  }

  // Reprogramación a pedido del cliente: el PDF ya salió con la fecha que eligió el cliente. Si coordinación puso
  // otra, alcanza con una nota en el ticket (no hay segundo PDF).
  if (incidencia.tipo === 'reprogramado_cliente' && incidencia.ticketOdooId && body.start && propuestaOriginal) {
    const elegida = new Date(`${body.start.replace(' ', 'T')}Z`);
    if (elegida.getTime() !== propuestaOriginal.inicio.getTime()) {
      try {
        const tecnico = await UsuarioModel.findById(incidencia.tecnicoId);
        await postTicketNote({
          ticketId: incidencia.ticketOdooId,
          bodyHtml: `<p><b>Reprogramación ajustada por coordinación</b> — ${esc(incidencia.subtareaNombre)}. El cliente había elegido el <b>${esc(formatoFechaHora(propuestaOriginal.inicio))}</b>; la visita queda para el <b>${esc(formatoFechaHora(elegida))}</b>.</p>`,
          as: tecnico?.odoo ? { login: tecnico.odoo.login, password: decryptSecret(tecnico.odoo.passwordEnc) } : undefined,
        });
      } catch (err) {
        console.error('SUBTAREA_INCIDENCIA_NOTA_AJUSTE_FAILED', incidencia.id, err);
      }
    }
  }
  await incidencia.save();

  res.json({ ...incidencia.toObject(), parentDateMoved });
});
