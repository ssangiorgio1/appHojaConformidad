import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { distanciasBodySchema, ordenVisitasBodySchema, variosTecnicosBodySchema } from '../schemas/ruteo.schema.js';
import { distancias, estado, visitas, visitasVariosTecnicos } from '../controllers/ruteo.controller.js';

export const ruteoRouter = Router();

// Solo el panel (coordinación): rutas por calle contra el servidor OSRM configurado en ROUTING_URL.
ruteoRouter.use(requireAuth, requireRole(['admin', 'superadmin', 'coordinacion', 'mesa_ayuda']));
ruteoRouter.get('/estado', estado);
ruteoRouter.post('/visitas', validate(ordenVisitasBodySchema, 'body'), visitas);
ruteoRouter.post('/visitas-varios-tecnicos', validate(variosTecnicosBodySchema, 'body'), visitasVariosTecnicos);
ruteoRouter.post('/distancias', validate(distanciasBodySchema, 'body'), distancias);
