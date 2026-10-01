import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { calendarMutationLimiter } from '../middleware/rateLimit.middleware.js';
import {
  createSubtareaIncidenciaSchema,
  listSubtareaIncidenciasQuerySchema,
  resolveSubtareaIncidenciaSchema,
} from '../schemas/subtareaIncidencia.schema.js';
import {
  createSubtareaIncidencia,
  listSubtareaIncidencias,
  resolveSubtareaIncidencia,
} from '../controllers/subtareaIncidencia.controller.js';

export const subtareaIncidenciaRouter = Router();

subtareaIncidenciaRouter.use(requireAuth);

// El técnico reporta desde la PWA al llegar y encontrar la unidad faltante;
// coordinación/mesa_ayuda/admin la ven y la resuelven desde el panel web —
// mismo reparto de roles que ya usa el calendario (calendarTask.routes.ts).
const VIEW_ROLES = ['coordinacion', 'admin', 'superadmin', 'mesa_ayuda'] as const;

subtareaIncidenciaRouter.post('/', requireRole(['tecnico']), validate(createSubtareaIncidenciaSchema, 'body'), createSubtareaIncidencia);
subtareaIncidenciaRouter.get(
  '/',
  requireRole([...VIEW_ROLES, 'tecnico']),
  validate(listSubtareaIncidenciasQuerySchema, 'query'),
  listSubtareaIncidencias,
);
subtareaIncidenciaRouter.patch(
  '/:id',
  requireRole([...VIEW_ROLES]),
  calendarMutationLimiter,
  validate(resolveSubtareaIncidenciaSchema, 'body'),
  resolveSubtareaIncidencia,
);
