import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { liquidacion, liquidacionQuerySchema } from '../controllers/liquidacion.controller.js';

export const liquidacionRouter = Router();

// Solo administración: es plata de los técnicos.
liquidacionRouter.use(requireAuth, requireRole(['admin', 'superadmin']));
liquidacionRouter.get('/', validate(liquidacionQuerySchema, 'query'), liquidacion);
