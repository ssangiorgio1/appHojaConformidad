import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../middleware/error.middleware.js';
import { SubtareaIncidenciaModel } from '../models/SubtareaIncidencia.js';
import { UsuarioModel } from '../models/Usuario.js';
import { decryptSecret } from '../utils/secretBox.js';
import { postSubtareaNoEncontrada } from '../services/odoo.service.js';
import { cerrarVisitaLoteSiTodoResuelto } from '../services/loteVisita.service.js';
import { odooTaskUrl } from '../services/calendarTask.service.js';
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
    tecnicoId: req.user!.usuarioId,
    fecha: body.fecha,
    motivo: body.motivo,
  });

  const usuario = await UsuarioModel.findById(req.user!.usuarioId);
  if (usuario?.odoo) {
    try {
      const bodyHtml = `<p><b>Unidad no encontrada en el lugar</b> — reportado por ${esc(usuario.nombre || usuario.email)} el ${esc(body.fecha)}.</p>${
        body.motivo ? `<p>Motivo: ${esc(body.motivo)}</p>` : ''
      }`;
      await postSubtareaNoEncontrada({
        subtareaOdooId: body.subtareaOdooId,
        bodyHtml,
        as: { login: usuario.odoo.login, password: decryptSecret(usuario.odoo.passwordEnc) },
      });
    } catch (err) {
      console.error('SUBTAREA_INCIDENCIA_ODOO_NOTE_FAILED', body.subtareaOdooId, err);
    }
  }

  // Reportar "no encontrada" también resuelve la unidad a los fines de la
  // visita del lote (ver cerrarVisitaLoteSiTodoResuelto) — sin esto, un lote
  // donde la última unidad pendiente se reporta como no encontrada (en vez de
  // completarse) nunca disparaba el cierre automático.
  await cerrarVisitaLoteSiTodoResuelto(body.tareaOdooId, req.user!.usuarioId);

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

export const resolveSubtareaIncidencia = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as ResolveSubtareaIncidenciaInput;
  const incidencia = await SubtareaIncidenciaModel.findById(req.params.id);
  if (!incidencia) throw new HttpError(404, 'Incidencia not found');

  incidencia.estado = body.estado;
  incidencia.resueltaPor = req.user!.usuarioId;
  incidencia.resueltaAt = new Date();
  await incidencia.save();

  res.json(incidencia);
});
