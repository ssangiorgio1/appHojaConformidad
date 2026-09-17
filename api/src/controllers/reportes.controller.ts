import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../middleware/error.middleware.js';
import { getReporteVisitas, getReporteTecnicos } from '../services/reportes.service.js';
import { OdooError } from '../services/odooErrors.js';
import type { ReporteVisitasQuery } from '../schemas/reporte.schema.js';

export const listReporteVisitas = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ReporteVisitasQuery;
  const data = await getReporteVisitas(query);
  res.json({ data });
});

export const listReporteTecnicos = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ReporteVisitasQuery;
  try {
    const data = await getReporteTecnicos(query);
    res.json({ data });
  } catch (err) {
    if (err instanceof OdooError) throw new HttpError(err.code === 'AUTH_FAILED' ? 400 : 502, err.message);
    throw err;
  }
});
