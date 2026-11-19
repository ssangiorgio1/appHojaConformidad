import type { ConformidadDoc } from './types';

// Una hoja normal llega al servidor segundos o pocos minutos después de terminarse. Pasada una hora, es que no se pudo enviar en
// el momento (sin señal, app cerrada, subida que falló) y apareció después: coordinación y mesa de ayuda ya pudieron haber
// revisado ese día sin verla.
export const UMBRAL_LLEGADA_TARDE_MIN = 60;

export interface LlegadaTarde {
  fase: 'PRE' | 'POST';
  // Hora real en que el técnico terminó esa etapa en su teléfono.
  hechaAt: string;
  // Hora en que el servidor la recibió.
  llegoAt: string;
  demoraMin: number;
}

function demora(hechaAt?: string | null, llegoAt?: string | null): number | null {
  if (!hechaAt || !llegoAt) return null;
  const a = new Date(hechaAt).getTime();
  const b = new Date(llegoAt).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  const min = Math.round((b - a) / 60_000);
  // Negativo = el reloj del teléfono estaba adelantado: no es una demora.
  return min >= 0 ? min : null;
}

// Devuelve la etapa (PRE o POST) que llegó con más demora, si pasó del umbral; null si llegó a tiempo o si la hoja es anterior
// a este dato (sin horas reales guardadas): de esas no se puede afirmar nada.
export function llegadaTarde(c: Pick<ConformidadDoc, 'preFinalizadoAt' | 'completadoAt' | 'completoRecibidoAt' | 'createdAt'>): LlegadaTarde | null {
  const candidatas: LlegadaTarde[] = [];
  const pre = demora(c.preFinalizadoAt, c.createdAt);
  if (pre !== null && pre >= UMBRAL_LLEGADA_TARDE_MIN && c.preFinalizadoAt) {
    candidatas.push({ fase: 'PRE', hechaAt: c.preFinalizadoAt, llegoAt: c.createdAt, demoraMin: pre });
  }
  const post = demora(c.completadoAt, c.completoRecibidoAt);
  if (post !== null && post >= UMBRAL_LLEGADA_TARDE_MIN && c.completadoAt && c.completoRecibidoAt) {
    candidatas.push({ fase: 'POST', hechaAt: c.completadoAt, llegoAt: c.completoRecibidoAt, demoraMin: post });
  }
  if (!candidatas.length) return null;
  return candidatas.reduce((a, b) => (b.demoraMin > a.demoraMin ? b : a));
}

// "45 min", "2 h 10 min", "1 d 3 h".
export function formatDemora(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h${min % 60 ? ` ${min % 60} min` : ''}`;
  const d = Math.floor(h / 24);
  return `${d} d${h % 24 ? ` ${h % 24} h` : ''}`;
}
