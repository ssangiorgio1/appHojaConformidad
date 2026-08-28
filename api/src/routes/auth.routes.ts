import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { authMutationLimiter } from '../middleware/rateLimit.middleware.js';
import { createUsuarioSchema, updateMeSchema, updateUsuarioSchema } from '../schemas/auth.schema.js';
import {
  createUsuario,
  getMe,
  listUsuarios,
  resetUsuarioPassword,
  updateMe,
  updateUsuario,
} from '../controllers/auth.controller.js';

export const authRouter = Router();

authRouter.get('/me', requireAuth, getMe);

authRouter.patch('/me', requireAuth, validate(updateMeSchema), updateMe);

authRouter.get('/usuarios', requireAuth, requireRole(['admin', 'superadmin']), listUsuarios);

authRouter.post(
  '/usuarios',
  requireAuth,
  requireRole(['admin', 'superadmin']),
  authMutationLimiter,
  validate(createUsuarioSchema),
  createUsuario,
);

authRouter.patch(
  '/usuarios/:id',
  requireAuth,
  requireRole(['admin', 'superadmin']),
  validate(updateUsuarioSchema),
  updateUsuario,
);

authRouter.post(
  '/usuarios/:id/reset-password',
  requireAuth,
  requireRole(['admin', 'superadmin']),
  authMutationLimiter,
  resetUsuarioPassword,
);
