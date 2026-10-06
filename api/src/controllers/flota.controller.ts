import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';
import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../middleware/error.middleware.js';
import { getVersionFlota, listFlota, refrescarFlota } from '../services/flota.service.js';
import { VisionbloError } from '../config/visionblo.js';

const gzipAsync = promisify(gzip);

// ~20k unidades (~4MB de JSON). Los datos sólo cambian cuando se refresca desde VisionBLO (versionFlota), así que se
// arma UNA vez el JSON y su versión gzip y se reutilizan en cada pedido (antes: leer Mongo + stringify + gzip síncrono
// por visita al mapa, que además bloqueaba el hilo). El TTL es sólo una red de seguridad.
const CACHE_TTL_MS = 5 * 60_000;
interface FlotaBody {
  version: number;
  at: number;
  etag: string;
  json: Buffer;
  gz: Buffer;
}
let cache: FlotaBody | null = null;
let armando: Promise<FlotaBody> | null = null;

function cacheVigente(c: FlotaBody | null): c is FlotaBody {
  return !!c && c.version === getVersionFlota() && Date.now() - c.at < CACHE_TTL_MS;
}

function armarBody(): Promise<FlotaBody> {
  // Se comparte el armado entre pedidos simultáneos (varios usuarios abriendo el mapa a la vez).
  armando ??= (async () => {
    const version = getVersionFlota();
    const json = Buffer.from(JSON.stringify(await listFlota()));
    const gz = await gzipAsync(json);
    const etag = `"${createHash('sha1').update(json).digest('base64url')}"`;
    return (cache = { version, at: Date.now(), etag, json, gz });
  })().finally(() => {
    armando = null;
  });
  return armando;
}

export const getFlota = asyncHandler(async (req: Request, res: Response) => {
  const body = cacheVigente(cache) ? cache : await armarBody();
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // `no-cache` (no `no-store`): el navegador puede guardarla pero siempre revalida con If-None-Match → 304 sin cuerpo.
  res.setHeader('Cache-Control', 'private, no-cache');
  res.setHeader('ETag', body.etag);
  res.setHeader('Vary', 'Accept-Encoding, Authorization');
  if (req.headers['if-none-match'] === body.etag) {
    res.status(304).end();
    return;
  }
  if (String(req.headers['accept-encoding'] ?? '').includes('gzip')) {
    res.setHeader('Content-Encoding', 'gzip');
    res.send(body.gz);
    return;
  }
  res.send(body.json);
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
