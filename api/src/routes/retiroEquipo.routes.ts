import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createRetiroEquipoSchema, listRetirosEquipoQuerySchema } from '../schemas/retiroEquipo.schema.js';
import { createRetiroEquipo, getRetiroEquipoPdf, listRetirosEquipo } from '../controllers/retiroEquipo.controller.js';

export const retiroEquipoRouter = Router();

retiroEquipoRouter.use(requireAuth);

// El técnico registra el retiro/entrega desde la PWA; coordinación, mesa de ayuda y admin lo ven en el panel
// (mismo reparto de roles que las incidencias de subtareas).
const VIEW_ROLES = ['coordinacion', 'admin', 'superadmin', 'mesa_ayuda'] as const;

retiroEquipoRouter.post('/', requireRole(['tecnico']), validate(createRetiroEquipoSchema, 'body'), createRetiroEquipo);
retiroEquipoRouter.get('/', requireRole([...VIEW_ROLES, 'tecnico']), validate(listRetirosEquipoQuerySchema, 'query'), listRetirosEquipo);
retiroEquipoRouter.get('/:id/pdf', requireRole([...VIEW_ROLES, 'tecnico']), getRetiroEquipoPdf);
