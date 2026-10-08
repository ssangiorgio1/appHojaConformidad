import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../middleware/error.middleware.js';
import { RetiroEquipoModel } from '../models/RetiroEquipo.js';
import { UsuarioModel } from '../models/Usuario.js';
import { decryptSecret } from '../utils/secretBox.js';
import { pushReprogramacionToTicket } from '../services/odoo.service.js';
import { buildRetiroEquipoPdfBuffer } from '../services/pdf.service.js';
import { formatoFechaHora } from '../services/reprogramacionPdf.js';
import { cerrarVisitaLoteSiTodoResuelto } from '../services/loteVisita.service.js';
import { notificarEstadoVisita } from '../services/telegram.service.js';
import { markParentStageHechoIfAllChildrenResolved, markTaskStageHecho, markTaskStateHecho } from '../services/calendarTask.service.js';
import type { CreateRetiroEquipoInput, ListRetirosEquipoQuery } from '../schemas/retiroEquipo.schema.js';

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

// El técnico registra desde la PWA que recibió el equipo (o que el cliente lo dejó para retirar). No se interviene la
// unidad: no hay hoja de conformidad. Se genera el acta, se adjunta al ticket de Odoo y la tarea queda en "Hecho".
// El acta en Mongo es la fuente de verdad; el PDF y el cierre en Odoo son best-effort (si Odoo falla, el acta se
// guarda igual y el error queda anotado).
export const createRetiroEquipo = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as CreateRetiroEquipoInput;
  const tecnicoId = req.user!.usuarioId;

  // Idempotencia: un reintento tras un timeout (o el envío encolado sin señal) no repite el acta ni el cierre.
  if (body.clientId) {
    const existente = await RetiroEquipoModel.findOne({ clientId: body.clientId, tecnicoId });
    if (existente) {
      res.status(200).json(existente.toObject());
      return;
    }
  }

  // Momento real del toque (offline): se acepta si no es futuro y tiene menos de 72 h; si no, hora del servidor.
  const ocurrio = body.ocurrioAt ? new Date(body.ocurrioAt) : null;
  const ahora = Date.now();
  const createdAt = ocurrio && ocurrio.getTime() <= ahora && ahora - ocurrio.getTime() < 72 * 3_600_000 ? ocurrio : undefined;

  const acta = await RetiroEquipoModel.create({
    clientId: body.clientId,
    ...(createdAt ? { createdAt } : {}),
    tareaOdooId: body.tareaOdooId,
    subtareaOdooId: body.subtareaOdooId ?? null,
    mergedTaskIds: body.mergedTaskIds,
    subtareaNombre: body.subtareaNombre ?? '',
    ticketOdooId: body.ticketOdooId ?? null,
    clienteNombre: body.clienteNombre ?? '',
    tecnicoId,
    fecha: body.fecha,
    modalidad: body.modalidad,
    equipo: body.equipo ?? {},
    adicionales: body.adicionales ?? [],
    entrega: body.entrega ?? {},
    observaciones: body.observaciones ?? '',
    firma: body.firma ?? null,
  });

  const tecnico = await UsuarioModel.findById(tecnicoId);

  // PDF al ticket. Con la cuenta de Odoo del técnico si la vinculó; si no, con la de servicio.
  if (acta.ticketOdooId) {
    try {
      const fechaHora = (acta as unknown as { createdAt: Date }).createdAt;
      const pdfBuffer = await buildRetiroEquipoPdfBuffer({
        subtareaNombre: acta.subtareaNombre,
        clienteNombre: acta.clienteNombre,
        ticketNumero: acta.ticketOdooId,
        tecnicoNombre: tecnico?.nombre || tecnico?.email || '',
        modalidad: acta.modalidad,
        fechaHora,
        equipo: acta.equipo ?? {},
        adicionales: acta.adicionales,
        entrega: acta.entrega ?? {},
        observaciones: acta.observaciones,
        firma: acta.firma,
      });
      const nombre = (acta.subtareaNombre || acta.tareaOdooId).toString().replace(/[^\w.-]+/g, '_');
      await pushReprogramacionToTicket({
        ticketId: acta.ticketOdooId,
        pdfBuffer,
        fileName: `retiro_equipo_${nombre}.pdf`,
        resumenHtml: `<p><b>${acta.modalidad === 'entrega' ? 'Equipo entregado por el cliente' : 'Equipo dejado para retirar'}</b> — ${esc(acta.subtareaNombre)} (${esc(acta.clienteNombre)}).</p><p>${esc(formatoFechaHora(fechaHora))}. Se adjunta el acta.</p>`,
        as: tecnico?.odoo ? { login: tecnico.odoo.login, password: decryptSecret(tecnico.odoo.passwordEnc) } : undefined,
      });
      acta.pdfAt = new Date();
      acta.pdfError = '';
    } catch (err) {
      console.error('RETIRO_EQUIPO_PDF_FAILED', acta.id, err);
      acta.pdfError = err instanceof Error ? err.message.slice(0, 300) : 'Error al enviar el PDF';
    }
    await acta.save();
  }

  // Cierre en Odoo: igual que una hoja de conformidad completa (subtarea o tarea a "Hecho"; el lote, si era la última
  // unidad). Cada llamada es best-effort: el acta ya quedó guardada.
  try {
    const taskId = acta.subtareaOdooId ?? acta.tareaOdooId;
    await markTaskStageHecho(taskId);
    await markTaskStateHecho(taskId);
    for (const mergedId of acta.mergedTaskIds ?? []) {
      await markTaskStageHecho(mergedId);
      await markTaskStateHecho(mergedId);
    }
    if (acta.subtareaOdooId) {
      await markParentStageHechoIfAllChildrenResolved(acta.tareaOdooId);
      await cerrarVisitaLoteSiTodoResuelto(acta.tareaOdooId, tecnicoId, acta.fecha, body.ocurrioAt);
    } else {
      await notificarEstadoVisita(acta.tareaOdooId, 'completo', tecnicoId, acta.fecha, body.ocurrioAt);
    }
  } catch (err) {
    console.error('RETIRO_EQUIPO_CIERRE_ODOO_FAILED', acta.id, err);
  }

  res.status(201).json(acta.toObject());
});

export const listRetirosEquipo = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListRetirosEquipoQuery;
  const filter: Record<string, unknown> = {};
  if (query.fecha) filter.fecha = query.fecha;
  // Un técnico solo ve lo suyo; coordinación, mesa de ayuda y admin ven todo.
  if (req.user!.role === 'tecnico') filter.tecnicoId = req.user!.usuarioId;

  const skip = (query.page - 1) * query.pageSize;
  const [data, total] = await Promise.all([
    RetiroEquipoModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.pageSize).populate('tecnicoId', 'nombre email'),
    RetiroEquipoModel.countDocuments(filter),
  ]);
  res.json({ data, page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) });
});

// PDF del acta para verla o descargarla desde el panel.
export const getRetiroEquipoPdf = asyncHandler(async (req: Request, res: Response) => {
  const acta = await RetiroEquipoModel.findById(req.params.id);
  if (!acta) throw new HttpError(404, 'Acta not found');
  if (req.user!.role === 'tecnico' && String(acta.tecnicoId) !== String(req.user!.usuarioId)) {
    throw new HttpError(403, 'You can only access your own records');
  }
  const tecnico = await UsuarioModel.findById(acta.tecnicoId);
  const pdf = await buildRetiroEquipoPdfBuffer({
    subtareaNombre: acta.subtareaNombre,
    clienteNombre: acta.clienteNombre,
    ticketNumero: acta.ticketOdooId ?? null,
    tecnicoNombre: tecnico?.nombre || tecnico?.email || '',
    modalidad: acta.modalidad,
    fechaHora: (acta as unknown as { createdAt: Date }).createdAt,
    equipo: acta.equipo ?? {},
    adicionales: acta.adicionales,
    entrega: acta.entrega ?? {},
    observaciones: acta.observaciones,
    firma: acta.firma,
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="retiro_equipo_${acta.id}.pdf"`);
  res.send(pdf);
});
