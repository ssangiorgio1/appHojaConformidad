import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { resolverUbicacionQuerySchema } from '../schemas/ubicacion.schema.js';
import { resolver } from '../controllers/ubicacion.controller.js';

export const ubicacionRouter = Router();

// La usan la PWA del técnico y el panel: cualquier usuario autenticado.
ubicacionRouter.use(requireAuth);
ubicacionRouter.get('/resolver', validate(resolverUbicacionQuerySchema, 'query'), resolver);
