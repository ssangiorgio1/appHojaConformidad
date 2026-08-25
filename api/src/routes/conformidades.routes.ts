import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  createConformidadSchema,
  patchConformidadSchema,
  listConformidadesQuerySchema,
} from '../schemas/conformidad.schema.js';
import {
  createConformidad,
  patchConformidad,
  listConformidades,
  getConformidadById,
  deleteConformidad,
} from '../controllers/conformidades.controller.js';

export const conformidadesRouter = Router();

conformidadesRouter.use(requireAuth);

conformidadesRouter.post('/', validate(createConformidadSchema), createConformidad);
conformidadesRouter.get('/', validate(listConformidadesQuerySchema, 'query'), listConformidades);
conformidadesRouter.get('/:id', getConformidadById);
conformidadesRouter.patch('/:id', validate(patchConformidadSchema), patchConformidad);
conformidadesRouter.delete('/:id', requireRole(['admin', 'superadmin']), deleteConformidad);
