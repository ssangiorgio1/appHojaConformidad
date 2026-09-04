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

// Solo lectura — mesa_ayuda/coordinación la necesitan para resolver nombres
// (técnico asignado, quién dio de alta un equipo) en el panel; crear/editar
// usuarios sigue exclusivo de admin/superadmin más abajo.
authRouter.get(
  '/usuarios',
  requireAuth,
  requireRole(['admin', 'superadmin', 'coordinacion', 'mesa_ayuda']),
  listUsuarios,
);

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
