import { visionbloPostJson } from '../config/visionblo.js';

// Gráficas de estado de UN equipo en UN día (bo3 equipo/graficas). Es una consulta en vivo: no se
// guarda en Mongo, sólo un cache corto en memoria para no repetir la misma consulta a bo3.

interface EventoGrafica {
  fecha: string;
  evento: string;
  voltaje_bateria?: number;
  voltaje_cargador?: number;
  dbm_modem?: number | null;
  velocidad?: number;
  satelites?: number;
  hdop?: number;
  presente?: boolean;
  conectado?: boolean;
}

interface RespuestaGraficas {
  desde: string;
  hasta: string;
  datos: EventoGrafica[];
  error?: string;
}

type Punto = [number, number | null];

export interface GraficasEquipo {
  equipoId: number;
  fecha: string;
  desde: string;
  hasta: string;
  consultadoAt: string;
  series: {
    bateriaInterna: Punto[];
    cargador: Punto[];
    senalDbm: Punto[];
    velocidad: Punto[];
    satelites: Punto[];
    hdop: Punto[];
    ignicion: Punto[];
    presenciaCargador: Punto[];
  };
}

const TTL_MS = 5 * 60_000;
const MAX_CACHE = 50;
const cache = new Map<string, { at: number; data: GraficasEquipo }>();
const enCurso = new Map<string, Promise<GraficasEquipo>>();

async function consultar(equipoId: number, fecha: string): Promise<GraficasEquipo> {
  const r = await visionbloPostJson<RespuestaGraficas>('equipo/graficas', { equipo_id: String(equipoId), fecha });
  if (r.error) throw new Error(r.error);
  const series: GraficasEquipo['series'] = {
    bateriaInterna: [],
    cargador: [],
    senalDbm: [],
    velocidad: [],
    satelites: [],
    hdop: [],
    ignicion: [],
    presenciaCargador: [],
  };
  for (const e of r.datos) {
    const t = new Date(e.fecha).getTime();
    if (e.evento === 'estado_general') {
      series.bateriaInterna.push([t, e.voltaje_bateria ?? null]);
      series.cargador.push([t, e.voltaje_cargador ?? null]);
      series.senalDbm.push([t, e.dbm_modem ?? null]);
    } else if (e.evento === 'posicion') {
      series.velocidad.push([t, e.velocidad ?? null]);
      series.satelites.push([t, e.satelites ?? null]);
      series.hdop.push([t, e.hdop ?? null]);
    } else if (e.evento === 'ignicion') {
      series.ignicion.push([t, e.presente ? 1 : 0]);
    } else if (e.evento === 'cargador') {
      series.presenciaCargador.push([t, e.conectado ? 1 : 0]);
    }
  }
  return { equipoId, fecha, desde: r.desde, hasta: r.hasta, consultadoAt: new Date().toISOString(), series };
}

export async function getGraficasEquipo(equipoId: number, fecha: string): Promise<GraficasEquipo> {
  const key = `${equipoId}:${fecha}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  const pendiente = enCurso.get(key);
  if (pendiente) return pendiente;
  const p = consultar(equipoId, fecha)
    .then((data) => {
      if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
      cache.set(key, { at: Date.now(), data });
      return data;
    })
    .finally(() => enCurso.delete(key));
  enCurso.set(key, p);
  return p;
}
