import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { tareaIdParamSchema, estadoVisitaSchema } from '../schemas/visita.schema.js';
import {
  setEstadoVisita,
  getVisita,
  getVisitaActiva,
  cancelarVisita,
  finalizarVisitaLote,
} from '../controllers/visitas.controller.js';

export const visitasRouter = Router();

visitasRouter.use(requireAuth);

// Antes de '/:tareaOdooId' — si no, "activa" matchea ahí como si fuera un id.
visitasRouter.get('/activa', getVisitaActiva);
visitasRouter.get('/:tareaOdooId', validate(tareaIdParamSchema, 'params'), getVisita);
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
  finalizarVisitaLote,
);
visitasRouter.delete(
  '/:tareaOdooId',
  requireRole(['tecnico', 'admin', 'superadmin']),
  validate(tareaIdParamSchema, 'params'),
  cancelarVisita,
);
