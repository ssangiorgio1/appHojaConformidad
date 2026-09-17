import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { reporteVisitasQuerySchema } from '../schemas/reporte.schema.js';
import { listReporteVisitas, listReporteTecnicos } from '../controllers/reportes.controller.js';

export const reportesRouter = Router();

// Datos de rendimiento por técnico — mismo criterio de roles que el
// calendario (coordinacion/admin/superadmin), no algo que un técnico deba
// ver de sus compañeros.
reportesRouter.use(requireAuth, requireRole(['coordinacion', 'admin', 'superadmin']));
reportesRouter.get('/visitas', validate(reporteVisitasQuerySchema, 'query'), listReporteVisitas);
reportesRouter.get('/tecnicos', validate(reporteVisitasQuerySchema, 'query'), listReporteTecnicos);
