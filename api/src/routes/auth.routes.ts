import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { updateRoleSchema } from '../schemas/auth.schema.js';
import { getMe, updateUsuarioRole } from '../controllers/auth.controller.js';

export const authRouter = Router();

authRouter.get('/me', requireAuth, getMe);

authRouter.patch(
  '/usuarios/:id/role',
  requireAuth,
  requireRole(['admin', 'superadmin']),
  validate(updateRoleSchema),
  updateUsuarioRole,
);
