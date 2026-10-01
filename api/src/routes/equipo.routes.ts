import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { buscarEquiposQuerySchema, equipoIdParamsSchema, estadoEquipoQuerySchema, graficasEquipoQuerySchema } from '../schemas/equipo.schema.js';
import { buscar, estado, graficas } from '../controllers/equipo.controller.js';

export const equipoRouter = Router();

// Consulta en vivo por equipo contra bo3 (cookie compartida, ver config/visionblo.ts). La usan el
// panel web (Atilio, mapa de flota) y la PWA del técnico para verificar una instalación — por eso
// acá no se restringe por rol (cualquier usuario autenticado); a los técnicos se les recorta cliente y
// posición en el controller.
equipoRouter.use(requireAuth);
equipoRouter.get('/buscar', validate(buscarEquiposQuerySchema, 'query'), buscar);
equipoRouter.get(
  '/:equipoId/estado',
  validate(equipoIdParamsSchema, 'params'),
  validate(estadoEquipoQuerySchema, 'query'),
  estado,
);
equipoRouter.get(
  '/:equipoId/graficas',
  validate(equipoIdParamsSchema, 'params'),
  validate(graficasEquipoQuerySchema, 'query'),
  graficas,
);
