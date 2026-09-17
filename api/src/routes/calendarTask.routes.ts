import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { calendarMutationLimiter } from '../middleware/rateLimit.middleware.js';
import {
  listCalendarTasksQuerySchema,
  moveCalendarTaskSchema,
  taskIdParamSchema,
  taskNotesQuerySchema,
} from '../schemas/calendarTask.schema.js';
import {
  getCalendarTasks,
  getCalendarTechnicians,
  getTaskNotesHandler,
  moveCalendarTaskHandler,
} from '../controllers/calendarTask.controller.js';

export const calendarTaskRouter = Router();

calendarTaskRouter.use(requireAuth);

// tecnico está bloqueado del panel web entero, pero SÍ puede ver /tasks
// desde la PWA (su propia agenda — el controller fuerza el filtro a su
// propio odooUserId, nunca confía en el technicianIds que mande la query).
// /technicians es el dropdown de coordinación para filtrar por cualquier
// técnico — eso sigue sin tener sentido para un técnico individual.
const VIEW_ROLES = ['coordinacion', 'admin', 'superadmin', 'mesa_ayuda'] as const;
const TASKS_VIEW_ROLES = [...VIEW_ROLES, 'tecnico'] as const;
const WRITE_ROLES = ['coordinacion', 'admin', 'superadmin'] as const;

calendarTaskRouter.get('/tasks', requireRole([...TASKS_VIEW_ROLES]), validate(listCalendarTasksQuerySchema, 'query'), getCalendarTasks);
calendarTaskRouter.get('/technicians', requireRole([...VIEW_ROLES]), getCalendarTechnicians);
calendarTaskRouter.get(
  '/tasks/:id/notas',
  requireRole([...TASKS_VIEW_ROLES]),
  validate(taskIdParamSchema, 'params'),
  validate(taskNotesQuerySchema, 'query'),
  getTaskNotesHandler,
);

calendarTaskRouter.patch(
  '/tasks/:id/move',
  requireRole([...WRITE_ROLES]),
  calendarMutationLimiter,
  validate(taskIdParamSchema, 'params'),
  validate(moveCalendarTaskSchema, 'body'),
  moveCalendarTaskHandler,
);
