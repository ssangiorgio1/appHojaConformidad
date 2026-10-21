import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  tareaIdParamSchema,
  estadoVisitaSchema,
  fechaQuerySchema,
  finalizarVisitaSchema,
  suspenderVisitaSchema,
  reanudarVisitaSchema,
} from '../schemas/visita.schema.js';
import {
  setEstadoVisita,
  getVisita,
  getVisitaActiva,
  cancelarVisita,
  finalizarVisitaLote,
  suspenderVisita,
  reanudarVisita,
} from '../controllers/visitas.controller.js';

export const visitasRouter = Router();

visitasRouter.use(requireAuth);

// Antes de '/:tareaOdooId' — si no, "activa" matchea ahí como si fuera un id.
visitasRouter.get('/activa', getVisitaActiva);
visitasRouter.get(
  '/:tareaOdooId',
  validate(tareaIdParamSchema, 'params'),
  validate(fechaQuerySchema, 'query'),
  getVisita,
);
visitasRouter.patch(
  '/:tareaOdooId/estado',
  requireRole(['tecnico', 'admin', 'superadmin']),
  validate(tareaIdParamSchema, 'params'),
  validate(estadoVisitaSchema),
  setEstadoVisita,
);
visitasRouter.patch(
  '/:tareaOdooId/finalizar',
  requireRole(['tecnico', 'admin', 'superadmin']),
  validate(tareaIdParamSchema, 'params'),
  validate(finalizarVisitaSchema),
  finalizarVisitaLote,
);
// Suspender / reanudar la visita en curso: solo el propio técnico, sobre su propia visita.
visitasRouter.patch(
  '/:tareaOdooId/suspender',
  requireRole(['tecnico']),
  validate(tareaIdParamSchema, 'params'),
  validate(suspenderVisitaSchema),
  suspenderVisita,
);
visitasRouter.patch(
  '/:tareaOdooId/reanudar',
  requireRole(['tecnico']),
  validate(tareaIdParamSchema, 'params'),
  validate(reanudarVisitaSchema),
  reanudarVisita,
);
visitasRouter.delete(
  '/:tareaOdooId',
  requireRole(['tecnico', 'admin', 'superadmin']),
  validate(tareaIdParamSchema, 'params'),
  validate(fechaQuerySchema, 'query'),
  cancelarVisita,
);
