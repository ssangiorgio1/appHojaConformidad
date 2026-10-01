import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { getFlota, postRefrescarFlota } from '../controllers/flota.controller.js';

export const flotaRouter = Router();

// Posición en vivo de la flota de TODOS los clientes + estado de abono: sólo roles de
// coordinación/mesa de ayuda, nunca un técnico.
flotaRouter.use(requireAuth, requireRole(['coordinacion', 'mesa_ayuda', 'admin', 'superadmin']));
flotaRouter.get('/', getFlota);
flotaRouter.post('/refrescar', postRefrescarFlota);
