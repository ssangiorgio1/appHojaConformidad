import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { idParamsSchema, previsualizarBodySchema, rutaAccesoBodySchema, territorioBodySchema } from '../schemas/planificacion.schema.js';
import { createRuta, deleteRuta, deleteTerritorio, listRutas, listTerritorios, previsualizarRuta, saveTerritorio, updateRuta } from '../controllers/planificacion.controller.js';

export const planificacionRouter = Router();

// Rutas de acceso y territorios por técnico: configuración de la planificación de visitas del panel.
// Verla: personal del panel; cambiarla: coordinación y administradores.
const VER = ['admin', 'superadmin', 'coordinacion', 'mesa_ayuda'] as const;
const EDITAR = ['admin', 'superadmin', 'coordinacion'] as const;
planificacionRouter.use(requireAuth);

planificacionRouter.get('/rutas', requireRole([...VER]), listRutas);
planificacionRouter.post('/rutas/previsualizar', requireRole([...EDITAR]), validate(previsualizarBodySchema, 'body'), previsualizarRuta);
planificacionRouter.post('/rutas', requireRole([...EDITAR]), validate(rutaAccesoBodySchema, 'body'), createRuta);
planificacionRouter.put('/rutas/:id', requireRole([...EDITAR]), validate(idParamsSchema, 'params'), validate(rutaAccesoBodySchema, 'body'), updateRuta);
planificacionRouter.delete('/rutas/:id', requireRole([...EDITAR]), validate(idParamsSchema, 'params'), deleteRuta);

planificacionRouter.get('/territorios', requireRole([...VER]), listTerritorios);
planificacionRouter.put('/territorios/:id', requireRole([...EDITAR]), validate(idParamsSchema, 'params'), validate(territorioBodySchema, 'body'), saveTerritorio);
planificacionRouter.delete('/territorios/:id', requireRole([...EDITAR]), validate(idParamsSchema, 'params'), deleteTerritorio);
