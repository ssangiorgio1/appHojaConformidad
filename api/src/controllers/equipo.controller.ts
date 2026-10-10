import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../middleware/error.middleware.js';
import { VisionbloError } from '../config/visionblo.js';
import { getGraficasRango } from '../services/equipoGraficas.service.js';
import { numeroEquipoPorImei } from '../services/stockEquipo.service.js';
import { getHistorialUnidad } from '../services/historialUnidad.service.js';
import { buscarEquipos, getEstadoEquipo, vistaTecnico } from '../services/equipoEstado.service.js';

function traducirError(err: unknown): never {
  if (err instanceof VisionbloError) throw new HttpError(err.code === 'NOT_CONFIGURED' ? 503 : 502, err.message);
  throw err;
}

export const buscar = asyncHandler(async (req: Request, res: Response) => {
  const { q } = req.query as unknown as { q: string };
  try {
    res.json({ data: await buscarEquipos(q) });
  } catch (err) {
    traducirError(err);
  }
});

// Una falla de la herramienta de stock no es un error para el técnico: se devuelve null y la PWA
// deja el número de equipo para cargar a mano.
export const numeroPorImei = asyncHandler(async (req: Request, res: Response) => {
  const { imei } = req.query as unknown as { imei: string };
  try {
    res.json({ numEquipo: await numeroEquipoPorImei(imei) });
  } catch (err) {
    console.error('STOCK_IMEI_LOOKUP_FAILED', err);
    res.json({ numEquipo: null });
  }
});

// Historial de servicios de una unidad (Atilio de la PWA). Cross-técnico a propósito, como el resto de /equipos: solo
// devuelve conteos y el último servicio, no las hojas.
export const historialUnidad = asyncHandler(async (req: Request, res: Response) => {
  const { matricula } = req.query as unknown as { matricula: string };
  res.json(await getHistorialUnidad(matricula));
});

export const estado =asyncHandler(async (req: Request, res: Response) => {
  const { equipoId } = req.params as unknown as { equipoId: number };
  const { forzar } = req.query as unknown as { forzar: boolean };
  try {
    const data = await getEstadoEquipo(equipoId, { forzar });
    res.json(req.user?.role === 'tecnico' ? vistaTecnico(data) : data);
  } catch (err) {
    traducirError(err);
  }
});

export const graficas = asyncHandler(async (req: Request, res: Response) => {
  const { equipoId } = req.params as unknown as { equipoId: number };
  const { desde, hasta } = req.query as unknown as { desde: string; hasta: string };
  try {
    res.json(await getGraficasRango(equipoId, desde, hasta));
  } catch (err) {
    traducirError(err);
  }
});
