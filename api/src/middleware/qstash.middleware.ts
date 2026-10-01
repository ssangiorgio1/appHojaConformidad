import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';

// Verifica la firma `Upstash-Signature` (JWT HS256) que QStash manda en cada request, sin sumar el
// SDK: se prueba con la signing key actual y la siguiente (rotación), y se chequea que el JWT sea
// para ESTA url y este body. Sin QSTASH_*_SIGNING_KEY configuradas, el endpoint queda cerrado (503).
function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function verifyJwt(token: string, key: string, url: string, rawBody: string): boolean {
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) return false;
  const expected = createHmac('sha256', key).update(`${h}.${p}`).digest();
  const given = Buffer.from(s, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;
  let claims: { iss?: string; sub?: string; exp?: number; nbf?: number; body?: string };
  try {
    claims = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
  } catch {
    return false;
  }
  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== 'Upstash' || claims.sub !== url) return false;
  if (typeof claims.exp !== 'number' || claims.exp < now) return false;
  if (typeof claims.nbf === 'number' && claims.nbf > now + 5) return false;
  return (claims.body ?? '').replace(/=+$/, '') === b64url(createHash('sha256').update(rawBody).digest());
}

export function requireQstashSignature(req: Request, res: Response, next: NextFunction): void {
  const keys = [env.QSTASH_CURRENT_SIGNING_KEY, env.QSTASH_NEXT_SIGNING_KEY].filter((k): k is string => !!k);
  if (!keys.length) {
    res.status(503).json({ error: 'QStash no configurado en la API.' });
    return;
  }
  const token = req.header('Upstash-Signature');
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  // Estos endpoints son GET/POST sin body (el cron no manda nada) — body vacío = hash del string vacío.
  if (!token || !keys.some((k) => verifyJwt(token, k, url, ''))) {
    res.status(401).json({ error: 'Firma de QStash inválida.' });
    return;
  }
  next();
}
