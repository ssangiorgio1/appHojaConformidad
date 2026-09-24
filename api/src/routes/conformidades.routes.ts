import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  createConformidadSchema,
  patchConformidadSchema,
  listConformidadesQuerySchema,
  altaConformidadSchema,
  cambioEquipoParejaSchema,
  retirosPendientesQuerySchema,
  equipoActualQuerySchema,
  cambioEquipoPorSubtareaQuerySchema,
} from '../schemas/conformidad.schema.js';
import {
  createConformidad,
  patchConformidad,
  listConformidades,
  getConformidadById,
  deleteConformidad,
  syncConformidadToOdoo,
  generateConformidadPdf,
  setAltaConformidad,
  linkCambioEquipoParejaHandler,
  getRetirosPendientes,
  getEquipoActual,
  getCambioEquipoPorSubtarea,
} from '../controllers/conformidades.controller.js';

export const conformidadesRouter = Router();

conformidadesRouter.use(requireAuth);

conformidadesRouter.post('/', validate(createConformidadSchema), createConformidad);
conformidadesRouter.get('/', validate(listConformidadesQuerySchema, 'query'), listConformidades);
// Antes de '/:id' — si no, "cambio-equipo" matchea ahí como si fuera un id
// (mismo cuidado que ya toma visitas.routes.ts con '/activa').
conformidadesRouter.get(
  '/cambio-equipo/retiros-pendientes',
  validate(retirosPendientesQuerySchema, 'query'),
  getRetirosPendientes,
);
// Antes de '/:id' por el mismo motivo que retiros-pendientes de arriba.
conformidadesRouter.get('/equipo-actual', validate(equipoActualQuerySchema, 'query'), getEquipoActual);
// Antes de '/:id' por el mismo motivo que retiros-pendientes de arriba.
conformidadesRouter.get(
  '/cambio-equipo/por-subtarea',
  validate(cambioEquipoPorSubtareaQuerySchema, 'query'),
  getCambioEquipoPorSubtarea,
);
conformidadesRouter.get('/:id', getConformidadById);
// coordinacion/mesa_ayuda solo deberían poder tocar el check de /alta más
// abajo — sin este requireRole, este PATCH genérico (checklist, firma,
// fotos, ticketOdoo) quedaba abierto a cualquier rol autenticado, muy por
// encima de lo que la UI les habilita a hacer.
conformidadesRouter.patch(
  '/:id',
  requireRole(['tecnico', 'admin', 'superadmin']),
  validate(patchConformidadSchema),
  patchConformidad,
);
conformidadesRouter.patch(
  '/:id/cambio-equipo-pareja',
  requireRole(['tecnico', 'admin', 'superadmin']),
  validate(cambioEquipoParejaSchema),
  linkCambioEquipoParejaHandler,
);
conformidadesRouter.post('/:id/odoo-sync', syncConformidadToOdoo);
conformidadesRouter.post('/:id/pdf', generateConformidadPdf);
conformidadesRouter.post(
  '/:id/alta',
  requireRole(['mesa_ayuda', 'coordinacion', 'admin', 'superadmin']),
  validate(altaConformidadSchema),
  setAltaConformidad,
);
conformidadesRouter.delete('/:id', requireRole(['admin', 'superadmin']), deleteConformidad);
