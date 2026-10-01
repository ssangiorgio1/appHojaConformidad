import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createIncidenciaDestinatarioSchema, searchOdooUsersQuerySchema } from '../schemas/incidenciaDestinatario.schema.js';
import {
  listIncidenciaDestinatarios,
  createIncidenciaDestinatario,
  deleteIncidenciaDestinatario,
  searchOdooUsersController,
} from '../controllers/incidenciaDestinatario.controller.js';

export const incidenciaDestinatarioRouter = Router();

// Configura quién recibe el mail.activity de "reprogramar" en Odoo (ver
// scheduleSubtareaReprogramarActivity) — más sensible que ver/resolver
// incidencias (subtareaIncidencia.routes.ts, abierto a coordinacion/
// mesa_ayuda), así que acá solo admin/superadmin.
incidenciaDestinatarioRouter.use(requireAuth, requireRole(['admin', 'superadmin']));

incidenciaDestinatarioRouter.get('/', listIncidenciaDestinatarios);
incidenciaDestinatarioRouter.get('/buscar-odoo', validate(searchOdooUsersQuerySchema, 'query'), searchOdooUsersController);
incidenciaDestinatarioRouter.post('/', validate(createIncidenciaDestinatarioSchema, 'body'), createIncidenciaDestinatario);
incidenciaDestinatarioRouter.delete('/:id', deleteIncidenciaDestinatario);
