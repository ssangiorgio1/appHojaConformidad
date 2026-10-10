import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { cerrarVisitaAbierta, listVisitasAbiertas } from '../controllers/visitasAbiertas.controller.js';

export const visitasAbiertasRouter = Router();

visitasAbiertasRouter.use(requireAuth, requireRole(['coordinacion', 'mesa_ayuda', 'admin', 'superadmin']));

visitasAbiertasRouter.get('/', listVisitasAbiertas);
visitasAbiertasRouter.post('/:id/cerrar', cerrarVisitaAbierta);
