import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../middleware/error.middleware.js';
import { SubtareaIncidenciaModel } from '../models/SubtareaIncidencia.js';
import { UsuarioModel } from '../models/Usuario.js';
import { IncidenciaDestinatarioModel } from '../models/IncidenciaDestinatario.js';
import { decryptSecret } from '../utils/secretBox.js';
import { postSubtareaNoEncontrada, scheduleSubtareaReprogramarActivity } from '../services/odoo.service.js';
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

// El técnico marca, desde la agenda de la PWA, que una unidad del lote no
// estaba físicamente en el lugar — no hay Conformidad que generar (ver
// ALCANCE_BACKOFFICE.md §14), pero coordinación necesita verlo para
// reprogramar esa unidad puntual. La incidencia en Mongo es la fuente de
// verdad para el panel web; el comentario en Odoo es un plus best-effort (si
// el técnico no tiene su cuenta de Odoo vinculada, o Odoo falla, la
// incidencia se guarda igual).
export const createSubtareaIncidencia = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as CreateSubtareaIncidenciaInput;

  const incidencia = await SubtareaIncidenciaModel.create({
    tareaOdooId: body.tareaOdooId,
    subtareaOdooId: body.subtareaOdooId,
    subtareaNombre: body.subtareaNombre ?? '',
    mergedTaskIds: body.mergedTaskIds,
    tecnicoId: req.user!.usuarioId,
    fecha: body.fecha,
    motivo: body.motivo,
  });

  const usuario = await UsuarioModel.findById(req.user!.usuarioId);
  const bodyHtml = `<p><b>Unidad no encontrada en el lugar</b> — reportado por ${esc(usuario?.nombre || usuario?.email || 'un técnico')} el ${esc(body.fecha)}.</p>${
    body.motivo ? `<p>Motivo: ${esc(body.motivo)}</p>` : ''
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
        summary: 'Reprogramar visita — unidad no encontrada',
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
  if (query.estado) filter.estado = query.estado;
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

  incidencia.estado = body.estado;
  incidencia.resueltaPor = req.user!.usuarioId;
  incidencia.resueltaAt = new Date();
  await incidencia.save();

  res.json({ ...incidencia.toObject(), parentDateMoved });
});
