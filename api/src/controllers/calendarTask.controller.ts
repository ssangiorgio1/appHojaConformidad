import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../middleware/error.middleware.js';
import { listCalendarTasks, listTechnicians, moveCalendarTask } from '../services/calendarTask.service.js';
import { getTaskNotes } from '../services/taskNotes.service.js';
import { OdooError } from '../services/odooErrors.js';
import { UsuarioModel } from '../models/Usuario.js';
import type { ListCalendarTasksQuery, MoveCalendarTaskInput, TaskNotesQuery } from '../schemas/calendarTask.schema.js';

function toHttpError(err: unknown): HttpError {
  if (err instanceof OdooError) {
    if (err.code === 'AUTH_FAILED') return new HttpError(400, err.message);
    return new HttpError(502, err.message);
  }
  return new HttpError(502, 'Error inesperado hablando con Odoo.');
}

export const getCalendarTasks = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListCalendarTasksQuery;

  // Un técnico solo puede ver SU propia agenda — a diferencia de
  // coordinación/mesa_ayuda/admin, nunca se respeta un technicianIds que
  // venga en la query para este rol, se lo pisa siempre server-side con su
  // propio odooUserId (el mismo vínculo que ya usa el panel web para
  // filtrar el calendario por técnico).
  if (req.user!.role === 'tecnico') {
    const usuario = await UsuarioModel.findById(req.user!.usuarioId);
    if (!usuario?.odooUserId) {
      throw new HttpError(400, 'Tu cuenta no está vinculada a Field Service en Odoo. Pedile a un admin que la vincule.');
    }
    query.technicianIds = [usuario.odooUserId];
  }

  try {
    const data = await listCalendarTasks(query);
    res.json({ data });
  } catch (err) {
    throw toHttpError(err);
  }
});

export const getCalendarTechnicians = asyncHandler(async (_req: Request, res: Response) => {
  try {
    const data = await listTechnicians();
    res.json({ data });
  } catch (err) {
    throw toHttpError(err);
  }
});

// Notas internas (mesa de ayuda sobre el ticket, coordinación sobre la
// tarea) — ver fixesVarios.md punto 5. Cualquier rol que ya puede ver la
// tarea puede ver esto (mismos TASKS_VIEW_ROLES de la ruta); un técnico solo
// pide esto de tareas que ya están en SU agenda, no hace falta re-validar
// pertenencia acá.
export const getTaskNotesHandler = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as unknown as { id: number };
  const { ticketId } = req.query as unknown as TaskNotesQuery;
  try {
    const data = await getTaskNotes(id, ticketId ?? null);
    res.json(data);
  } catch (err) {
    throw toHttpError(err);
  }
});

export const moveCalendarTaskHandler = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as unknown as { id: number };
  const body = req.body as MoveCalendarTaskInput;
  try {
    await moveCalendarTask(id, body);
    res.status(204).end();
  } catch (err) {
    throw toHttpError(err);
  }
});
