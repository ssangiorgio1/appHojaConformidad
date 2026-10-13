import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../middleware/error.middleware.js';
import { SubtareaIncidenciaModel } from '../models/SubtareaIncidencia.js';
import { UsuarioModel } from '../models/Usuario.js';
import { VisitaNotificacionModel } from '../models/VisitaNotificacion.js';
import { clasificarLlegada } from '../services/clasificarIncidencia.js';
import { IncidenciaDestinatarioModel } from '../models/IncidenciaDestinatario.js';
import { decryptSecret } from '../utils/secretBox.js';
import { postSubtareaNoEncontrada, pushReprogramacionToTicket, scheduleSubtareaReprogramarActivity } from '../services/odoo.service.js';
import { buildReprogramacionPdfBuffer, buildConstanciaVisitaFallidaPdfBuffer } from '../services/pdf.service.js';
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

  // Sugerencia de tipo: si el técnico marcó "llegué" pasada la tolerancia de la hora agendada, la unidad no estaba
  // por su demora (llegada_tarde) y no es una visita fallida. Solo aplica a "no encontrada"; coordinación puede
  // corregirlo al resolver. Sin hora agendada o sin llegada marcada no se decide.
  const horaAgendada = body.horaAgendada ? new Date(body.horaAgendada) : null;
  let llegadaAt: Date | null = null;
  let tipoSugerido: 'no_encontrada' | 'llegada_tarde' | null = null;
  if (body.tipo === 'no_encontrada') {
    const viaje = await VisitaNotificacionModel.findOne({ tareaOdooId: body.tareaOdooId, tecnicoId: req.user!.usuarioId, fecha: body.fecha })
      .sort({ createdAt: -1 })
      .select('enSitioAt');
    llegadaAt = viaje?.enSitioAt ?? null;
    tipoSugerido = clasificarLlegada(horaAgendada, llegadaAt);
  }

  const incidencia = await SubtareaIncidenciaModel.create({
    clientId: body.clientId,
    tipo: tipoSugerido ?? body.tipo,
    horaAgendada,
    llegadaAt,
    tipoSugerido,
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
    body.tipo === 'pre_cancelado'
      ? 'PRE cancelado por el técnico'
      : tipoSugerido === 'llegada_tarde'
        ? 'Unidad no encontrada — el técnico llegó tarde (a revisar por coordinación)'
        : 'Unidad no encontrada en el lugar';
  const bodyHtml = `<p><b>${titulo}</b> — reportado por ${esc(usuario?.nombre || usuario?.email || 'un técnico')} el ${esc(body.fecha)}.</p>${
    body.motivo ? `<p>Motivo: ${esc(body.motivo)}</p>` : ''
  }${propuesta ? `<p>Reprogramación propuesta: <b>${esc(formatoArgentina(propuesta.inicio))}</b> a ${esc(formatoArgentina(propuesta.fin))}. Pendiente de aceptación por coordinación.</p>` : ''}`;

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
        summary: propuesta
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

  // Coordinación corrige el tipo sugerido (visita fallida vs. llegada tarde) antes de que salga el PDF.
  if (body.tipo && incidencia.tipo !== 'pre_cancelado' && body.tipo !== incidencia.tipo) {
    if (!REPROGRAMAR_ROLES.has(req.user!.role)) throw new HttpError(403, 'Tu rol no puede cambiar el tipo de la incidencia.');
    incidencia.tipo = body.tipo;
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

  // PDF al ticket, con el nombre de la subtarea. Visita fallida (el técnico llegó a tiempo) → constancia, que sale
  // aunque todavía no haya fecha nueva; el resto → PDF de reprogramación (sin cargo si fue llegada tarde), que
  // necesita la fecha nueva. Best-effort: la reprogramación ya se hizo en Odoo, así que si esto falla se anota el
  // error en la incidencia y no se corta la respuesta.
  const esConstancia = incidencia.tipo === 'no_encontrada';
  // Una derivación (la visita ya se hizo y tiene su propia hoja en el ticket) no genera constancia ni PDF de reprogramación.
  if (incidencia.tipo !== 'requiere_otro_tecnico' && incidencia.ticketOdooId && ((body.start && body.end) || esConstancia)) {
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
            tipo: incidencia.tipo,
            horaAgendada: incidencia.horaAgendada,
            llegadaAt: incidencia.llegadaAt,
            propuestaOriginal,
          });
      await pushReprogramacionToTicket({
        ticketId: incidencia.ticketOdooId,
        pdfBuffer,
        fileName: `${esConstancia ? 'visita_fallida' : 'reprogramacion'}_${nombre.replace(/[^\w.-]+/g, '_')}.pdf`,
        resumenHtml: esConstancia
          ? `<p><b>Visita fallida</b> — ${esc(incidencia.subtareaNombre)} (${esc(incidencia.clienteNombre)}). La unidad no se encontraba en el lugar.</p>${nuevaInicio ? `<p>Nueva fecha y hora: <b>${esc(formatoFechaHora(nuevaInicio))}</b>.</p>` : ''}`
          : `<p><b>Visita reprogramada${incidencia.tipo === 'llegada_tarde' ? ' por demora del técnico (sin cargo)' : ''}</b> — ${esc(incidencia.subtareaNombre)} (${esc(incidencia.clienteNombre)}).</p><p>Nueva fecha y hora: <b>${esc(formatoFechaHora(nuevaInicio!))}</b>.</p>`,
        as: tecnico?.odoo ? { login: tecnico.odoo.login, password: decryptSecret(tecnico.odoo.passwordEnc) } : undefined,
      });
      incidencia.pdfReprogramacionAt = new Date();
      incidencia.pdfReprogramacionError = '';
    } catch (err) {
      console.error('SUBTAREA_INCIDENCIA_PDF_REPROGRAMACION_FAILED', incidencia.id, err);
      incidencia.pdfReprogramacionError = err instanceof Error ? err.message.slice(0, 300) : 'Error al enviar el PDF';
    }
  }
  await incidencia.save();

  res.json({ ...incidencia.toObject(), parentDateMoved });
});
