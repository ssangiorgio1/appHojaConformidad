import { env } from './env.js';

export class VisionbloError extends Error {
  constructor(
    public code: 'NOT_CONFIGURED' | 'SESSION_EXPIRED' | 'HTTP' | 'TIMEOUT',
    message: string,
  ) {
    super(message);
    this.name = 'VisionbloError';
  }
}

// El backoffice de VisionBLO (bo3) no tiene API con token: se le pega con la cookie de sesión
// BO3SESSION (sólo el valor) y se parsean las variables JS embebidas en el HTML. Si la sesión
// venció, bo3 redirige a login y la variable esperada deja de aparecer.
const TIMEOUT_MS = 90_000;

async function visionbloRequest(path: string, body?: unknown, timeoutMs = TIMEOUT_MS): Promise<string> {
  if (!env.VISIONBLO_SESSION_COOKIE) {
    throw new VisionbloError('NOT_CONFIGURED', 'Falta VISIONBLO_SESSION_COOKIE en el entorno de la API.');
  }
  let res: Response;
  try {
    res = await fetch(`https://ssl.visionblo.com/bo3/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Cookie: `BO3SESSION=${env.VISIONBLO_SESSION_COOKIE}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new VisionbloError('TIMEOUT', `VisionBLO no respondió en ${timeoutMs / 1000}s (${path}).`);
    }
    throw err;
  }
  const text = await res.text();
  if (!res.ok) throw new VisionbloError('HTTP', `VisionBLO respondió ${res.status} en ${path}: ${text.slice(0, 200)}`);
  return text;
}

export function visionbloGet(path: string): Promise<string> {
  return visionbloRequest(path);
}

// Los POST de bo3 (equipo/diagnostico, equipo/historial...) responden JSON; un cuerpo vacío
// significa sesión vencida (la propia pantalla de bo3 avisa "La sesión expiró" en ese caso).
export async function visionbloPostJson<T>(path: string, body: unknown): Promise<T> {
  const text = await visionbloRequest(path, body, 30_000);
  if (!text.trim()) {
    throw new VisionbloError('SESSION_EXPIRED', 'VisionBLO devolvió una respuesta vacía — la sesión probablemente venció (renovar VISIONBLO_SESSION_COOKIE).');
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new VisionbloError('SESSION_EXPIRED', 'VisionBLO no devolvió JSON — la sesión probablemente venció (renovar VISIONBLO_SESSION_COOKIE).');
  }
}

// Extrae el array JSON que sigue a `nombre = [` respetando comillas (un nombre de cliente puede
// traer corchetes literales).
export function extractJsArray<T>(html: string, nombre: string): T[] {
  const marker = `${nombre} = [`;
  const idx = html.indexOf(marker);
  if (idx === -1) {
    throw new VisionbloError(
      'SESSION_EXPIRED',
      `No se encontró la variable '${nombre}' en la respuesta de VisionBLO — la sesión probablemente venció (renovar VISIONBLO_SESSION_COOKIE).`,
    );
  }
  const start = idx + marker.length - 1;
  let depth = 0;
  let inString = false;
  let escaping = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inString) {
      if (escaping) escaping = false;
      else if (c === '\\') escaping = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '[') depth++;
    else if (c === ']' && --depth === 0) return JSON.parse(html.slice(start, i + 1)) as T[];
  }
  throw new VisionbloError('HTTP', `Array '${nombre}' sin cierre en la respuesta de VisionBLO.`);
}

// Ping barato para mantener viva la sesión BO3SESSION (lo dispara un cron de QStash, ver
// routes/internal.routes.ts). `cliente/baja` es una pantalla liviana que ya carga el mismo `clientes`
// que usa la flota — si la sesión venció, extractJsArray tira SESSION_EXPIRED.
export async function visionbloKeepalive(): Promise<void> {
  extractJsArray(await visionbloGet('cliente/baja'), 'clientes');
}
