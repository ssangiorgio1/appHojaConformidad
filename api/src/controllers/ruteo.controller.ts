import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../middleware/error.middleware.js';
import { distanciasDesde, ordenarVisitas, ordenarVisitasVariosTecnicos, RuteoError, ruteoDisponible, type CriterioOrden, type PuntoRuta } from '../services/ruteo.service.js';

function traducirError(err: unknown): never {
  if (err instanceof RuteoError) throw new HttpError(err.code === 'NOT_CONFIGURED' ? 503 : err.code === 'SIN_RUTA' ? 422 : 502, err.message);
  throw err;
}

// El panel pregunta esto antes de ofrecer "por calle": sin ROUTING_URL sigue con los radios en línea recta.
export const estado = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ disponible: ruteoDisponible() });
});

export const visitas = asyncHandler(async (req: Request, res: Response) => {
  const { origen, puntos, volver, criterio, primeroId, desdeOficina } = req.body as { origen: { latitud: number; longitud: number }; puntos: PuntoRuta[]; volver: boolean; criterio: CriterioOrden; primeroId?: string | number; desdeOficina: boolean };
  try {
    res.json(await ordenarVisitas(origen, puntos, volver, criterio, { primeroId, desdeOficina }));
  } catch (err) {
    traducirError(err);
  }
});

export const distancias = asyncHandler(async (req: Request, res: Response) => {
  const { origen, puntos } = req.body as { origen: { latitud: number; longitud: number }; puntos: PuntoRuta[] };
  try {
    res.json({ distancias: await distanciasDesde(origen, puntos) });
  } catch (err) {
    traducirError(err);
  }
});

export const visitasVariosTecnicos = asyncHandler(async (req: Request, res: Response) => {
  const { origen, puntos, cantidad, volver, criterio, primeroId, desdeOficina, vias, juntosHasta } = req.body as { origen: { latitud: number; longitud: number }; puntos: PuntoRuta[]; cantidad: number; volver: boolean; criterio: CriterioOrden; primeroId?: string | number; desdeOficina: boolean; vias?: Array<Array<[number, number]>>; juntosHasta?: { latitud: number; longitud: number } };
  try {
    res.json(await ordenarVisitasVariosTecnicos(origen, puntos, cantidad, volver, criterio, { primeroId, desdeOficina, vias, juntosHasta }));
  } catch (err) {
    traducirError(err);
  }
});
