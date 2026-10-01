import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../middleware/error.middleware.js';
import { VisionbloError } from '../config/visionblo.js';
import { getGraficasEquipo } from '../services/equipoGraficas.service.js';
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

export const estado = asyncHandler(async (req: Request, res: Response) => {
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
  const { fecha } = req.query as unknown as { fecha: string };
  try {
    res.json(await getGraficasEquipo(equipoId, fecha));
  } catch (err) {
    traducirError(err);
  }
});
