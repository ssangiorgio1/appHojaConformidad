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
  // bo3 devuelve, cuando no hay datos ese día, el último evento conocido aunque sea de años atrás:
  // fuera de [desde, hasta] se descarta, o rompe la escala de tiempo de los gráficos.
  const ini = new Date(r.desde).getTime();
  const fin = new Date(r.hasta).getTime();
  for (const e of r.datos) {
    const t = new Date(e.fecha).getTime();
    if (!(t >= ini && t <= fin)) continue;
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

function diasEntre(desde: string, hasta: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(desde); t <= Date.parse(hasta); t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

// Rango de días: una consulta (cacheada) por día, concatenadas en orden. Un día es el caso común.
export async function getGraficasRango(equipoId: number, desde: string, hasta: string): Promise<GraficasEquipo> {
  if (desde === hasta) return getGraficasEquipo(equipoId, desde);
  const dias = await Promise.all(diasEntre(desde, hasta).map((d) => getGraficasEquipo(equipoId, d)));
  const series = dias[0].series;
  const claves = Object.keys(series) as (keyof GraficasEquipo['series'])[];
  const unidas = Object.fromEntries(claves.map((k) => [k, dias.flatMap((d) => d.series[k])])) as GraficasEquipo['series'];
  return {
    equipoId,
    fecha: desde,
    desde: dias[0].desde,
    hasta: dias[dias.length - 1].hasta,
    consultadoAt: new Date().toISOString(),
    series: unidas,
  };
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
