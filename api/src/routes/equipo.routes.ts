import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { buscarEquiposQuerySchema, historialUnidadQuerySchema, equipoIdParamsSchema, estadoEquipoQuerySchema, graficasEquipoQuerySchema, numeroPorImeiQuerySchema } from '../schemas/equipo.schema.js';
import { buscar, historialUnidad, estado, graficas, numeroPorImei } from '../controllers/equipo.controller.js';

export const equipoRouter = Router();

// Consulta en vivo por equipo contra bo3 (cookie compartida, ver config/visionblo.ts). La usan el
// panel web (Atilio, mapa de flota) y la PWA del técnico para verificar una instalación — por eso
// acá no se restringe por rol (cualquier usuario autenticado); a los técnicos se les recorta cliente y
// posición en el controller.
equipoRouter.use(requireAuth);
equipoRouter.get('/buscar', validate(buscarEquiposQuerySchema, 'query'), buscar);
equipoRouter.get('/numero-por-imei', validate(numeroPorImeiQuerySchema, 'query'), numeroPorImei);
equipoRouter.get('/historial-unidad', validate(historialUnidadQuerySchema, 'query'), historialUnidad);
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
