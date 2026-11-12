import { env } from './env.js';

// API de preinstalación de VisionBLO (token Bearer; guía de Matías Moreno): servicio aparte del backoffice bo3 (cookie), pensado
// para que un técnico pruebe un equipo. Acá SOLO se usan sus métodos de lectura: corte_motor, canbus y liberar_equipo
// modifican el equipo (crean/borran un móvil temporal) y no deben llamarse desde esta API.
//
// Convenciones del servicio: siempre responde HTTP 200 (el error viene en el body como { error }), `equipo_id` va como número
// JSON y la URL es http plano — por eso el token vive solo en el servidor, nunca en el navegador del técnico.

export class VisionbloApiError extends Error {
  constructor(
    public code: 'NOT_CONFIGURED' | 'TIMEOUT' | 'NETWORK' | 'HTTP' | 'API',
    message: string,
  ) {
    super(message);
    this.name = 'VisionbloApiError';
  }
}

const TIMEOUT_MS = 15_000;

type MetodoLectura = 'ultimo_reporte' | 'opciones_pendientes' | 'get_equipo_id';

export function visionbloApiConfigurada(): boolean {
  return !!env.VISIONBLO_API_TOKEN;
}

async function llamar<T>(metodo: MetodoLectura, cuerpo: Record<string, unknown>): Promise<T> {
  if (!env.VISIONBLO_API_TOKEN) {
    throw new VisionbloApiError('NOT_CONFIGURED', 'Falta VISIONBLO_API_TOKEN en el entorno de la API.');
  }
  let res: Response;
  try {
    res = await fetch(`${env.VISIONBLO_API_URL}/${metodo}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.VISIONBLO_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new VisionbloApiError('TIMEOUT', `La API de VisionBLO no respondió en ${TIMEOUT_MS / 1000}s (${metodo}).`);
    }
    throw new VisionbloApiError('NETWORK', `No se pudo conectar con la API de VisionBLO (${metodo}).`);
  }
  const texto = await res.text();
  if (!res.ok) throw new VisionbloApiError('HTTP', `La API de VisionBLO respondió ${res.status} en ${metodo}.`);
  let json: { ok?: boolean; error?: string } & Record<string, unknown>;
  try {
    json = JSON.parse(texto);
  } catch {
    throw new VisionbloApiError('API', `La API de VisionBLO no devolvió JSON en ${metodo}.`);
  }
  // Los errores vienen en español y con HTTP 200: se mira el body.
  if (json.error) throw new VisionbloApiError('API', `${metodo}: ${json.error}`);
  return json as T;
}

export interface EventoApi {
  fecha: string;
  // Varía por evento; el servicio puede devolver {} o [] cuando el evento no trae datos.
  datos: Record<string, unknown> | unknown[] | null;
}

export interface UltimoReporteApi {
  ok: true;
  // Falso si el equipo nunca reportó. También es lo que devuelve para un equipo_id inexistente.
  ultima_recepcion: string | false;
  ultimo_reporte: Record<string, EventoApi>;
}

export function ultimoReporteApi(equipoId: number): Promise<UltimoReporteApi> {
  return llamar<UltimoReporteApi>('ultimo_reporte', { equipo_id: equipoId });
}
