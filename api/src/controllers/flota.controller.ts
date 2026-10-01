import { gzipSync } from 'node:zlib';
import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../middleware/error.middleware.js';
import { listFlota, refrescarFlota } from '../services/flota.service.js';
import { VisionbloError } from '../config/visionblo.js';

// ~20k unidades (~4MB de JSON): se comprime a mano para no sumar una dependencia sólo por esto.
export const getFlota = asyncHandler(async (req: Request, res: Response) => {
  const body = Buffer.from(JSON.stringify(await listFlota()));
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (String(req.headers['accept-encoding'] ?? '').includes('gzip')) {
    res.setHeader('Content-Encoding', 'gzip');
    res.send(gzipSync(body));
    return;
  }
  res.send(body);
});

export const postRefrescarFlota = asyncHandler(async (_req: Request, res: Response) => {
  try {
    const result = await refrescarFlota();
    if ('cooldown' in result) {
      res
        .status(429)
        .json({ error: `Se refrescó hace muy poco, probá de nuevo en ${result.cooldown}s.`, cooldown: result.cooldown });
      return;
    }
    res.json(result);
  } catch (err) {
    if (err instanceof VisionbloError) throw new HttpError(err.code === 'NOT_CONFIGURED' ? 503 : 502, err.message);
    throw err;
  }
});
