import { env } from '../config/env.js';

// Distancias y orden de visita POR CALLE, con un servidor de rutas OSRM (ver routing/ en la raíz del repo).
// Sin ROUTING_URL en el entorno todo esto queda apagado (el panel usa las zonas por radio en línea recta).
export class RuteoError extends Error {
  constructor(
    public code: 'NOT_CONFIGURED' | 'HTTP' | 'TIMEOUT' | 'NETWORK' | 'SIN_RUTA',
    message: string,
  ) {
    super(message);
    this.name = 'RuteoError';
  }
}

export interface PuntoRuta {
  id: string | number;
  latitud: number;
  longitud: number;
  /**
   * Solo con varios técnicos: posiciones (0 = el primero) de los técnicos a los que este punto les corresponde por su
   * territorio. Con uno solo va con él; con dos o más, la zona se comparte y sus unidades se reparten entre ellos.
   */
  tecnicos?: number[];
}

export interface OpcionesOrden {
  /** Punto con el que arranca el recorrido (la primera visita); el resto sigue desde ahí hacia el más cercano. */
  primeroId?: string | number;
  /** Con `primeroId`: true (por defecto) = el técnico sale de la oficina hacia esa primera visita; false = el recorrido empieza en ella. */
  desdeOficina?: boolean;
  /** Puntos [longitud, latitud] por los que pasa el recorrido antes de la primera visita (p. ej. una ruta de acceso), para forzar otro camino. */
  via?: Array<[number, number]>;
}

const TIMEOUT_MS = 20_000;
// Lo que acepta el servidor por pedido (--max-table-size / --max-trip-size de OSRM).
export const MAX_PUNTOS = 100;

export function ruteoDisponible(): boolean {
  return Boolean(env.ROUTING_URL);
}

async function pedir<T>(ruta: string): Promise<T> {
  if (!env.ROUTING_URL) throw new RuteoError('NOT_CONFIGURED', 'Falta ROUTING_URL: el servicio de rutas por calle no está configurado.');
  let res: Response;
  try {
    res = await fetch(`${env.ROUTING_URL}${ruta}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') throw new RuteoError('TIMEOUT', `El servicio de rutas no respondió en ${TIMEOUT_MS / 1000}s.`);
    throw new RuteoError('NETWORK', 'No se pudo conectar con el servicio de rutas.');
  }
  const cuerpo = (await res.json().catch(() => null)) as (T & { code?: string; message?: string }) | null;
  if (!res.ok || !cuerpo || (cuerpo.code && cuerpo.code !== 'Ok')) {
    const motivo = cuerpo?.code === 'NoRoute' || cuerpo?.code === 'NoSegment' || cuerpo?.code === 'NoTrips';
    throw new RuteoError(motivo ? 'SIN_RUTA' : 'HTTP', cuerpo?.message ?? `El servicio de rutas respondió ${res.status}.`);
  }
  return cuerpo;
}

const coord = (p: { latitud: number; longitud: number }) => `${p.longitud.toFixed(6)},${p.latitud.toFixed(6)}`;

// ---------------------------------------------------------------------------------------------
// Orden de visita (el mejor recorrido que sale del origen y pasa por todos los puntos)
// ---------------------------------------------------------------------------------------------

interface RespuestaTrip {
  trips: Array<{ distance: number; duration: number; legs: Array<{ distance: number; duration: number }>; geometry?: { coordinates: Array<[number, number]> } }>;
  // En el orden en que se mandaron; `waypoint_index` es la posición en el recorrido (0 = el origen).
  waypoints: Array<{ waypoint_index: number }>;
}

export interface ParadaOrdenada {
  id: string | number;
  /** 1 = la primera parada. */
  posicion: number;
  /** Tramo desde la parada anterior (o desde el origen, en la primera). */
  kmDesdeAnterior: number;
  minDesdeAnterior: number;
  /** Acumulado desde el origen hasta esta parada. */
  kmAcumulado: number;
}

export interface OrdenVisitas {
  paradas: ParadaOrdenada[];
  /** Total del recorrido; incluye la vuelta al origen si `volver`. */
  totalKm: number;
  totalMin: number;
  /** Solo si `volver`: tramo de regreso desde la última parada. */
  vuelta: { km: number; min: number } | null;
  /** Traza del recorrido por las calles, como [longitud, latitud] (para dibujarla en el mapa). */
  geometria: Array<[number, number]>;
}

const aKm = (m: number) => Math.round(m / 100) / 10;
const aMin = (s: number) => Math.round(s / 60);

/** Pura (se prueba sin servidor): arma el resultado a partir de la respuesta de /trip. */
export function interpretarTrip(resp: RespuestaTrip, puntos: PuntoRuta[], volver: boolean): OrdenVisitas {
  const trip = resp.trips[0];
  if (!trip) throw new RuteoError('SIN_RUTA', 'No se encontró un recorrido entre los puntos.');
  // waypoints[0] es el origen; waypoints[i + 1] es puntos[i].
  const posicionDe = puntos.map((_, i) => resp.waypoints[i + 1].waypoint_index);
  const orden = puntos.map((p, i) => ({ p, pos: posicionDe[i] })).sort((a, b) => a.pos - b.pos);
  let acumulado = 0;
  const paradas = orden.map(({ p }, n) => {
    const tramo = trip.legs[n];
    acumulado += tramo.distance;
    return { id: p.id, posicion: n + 1, kmDesdeAnterior: aKm(tramo.distance), minDesdeAnterior: aMin(tramo.duration), kmAcumulado: aKm(acumulado) };
  });
  const tramoVuelta = volver ? trip.legs[puntos.length] : undefined;
  return {
    paradas,
    totalKm: aKm(trip.distance),
    totalMin: aMin(trip.duration),
    vuelta: tramoVuelta ? { km: aKm(tramoVuelta.distance), min: aMin(tramoVuelta.duration) } : null,
    geometria: trip.geometry?.coordinates ?? [],
  };
}

/**
 * - `cercania` (por defecto): sale del origen, va a la unidad más cercana (por calle), de ahí a la más cercana
 *   de las que faltan, y así siguiendo. Es el orden que se espera al planificar: de lo cercano a lo lejano.
 * - `optimo`: el recorrido más corto en total (el solver de OSRM). Puede dejar unidades cercanas para el final
 *   y visitar unidades lejanas antes, porque lo único que mira es el total de kilómetros.
 */
export type CriterioOrden = 'cercania' | 'optimo';

/** Pura: orden "siempre a la más cercana que falta" a partir de una matriz de distancias (0 = origen). */
export function ordenMasCercano(distancias: Array<Array<number | null>>, primero?: number): number[] {
  const n = distancias.length - 1;
  const restantes = new Set(Array.from({ length: n }, (_, i) => i + 1));
  const orden: number[] = [];
  let actual = 0;
  // Con una primera visita elegida, el recorrido arranca ahí y sigue por cercanía desde ese punto.
  if (primero !== undefined && restantes.has(primero)) {
    orden.push(primero);
    restantes.delete(primero);
    actual = primero;
  }
  while (restantes.size > 0) {
    let mejor = -1;
    let mejorD = Number.POSITIVE_INFINITY;
    for (const j of restantes) {
      const d = distancias[actual][j] ?? Number.POSITIVE_INFINITY;
      if (mejor === -1 || d < mejorD) {
        mejor = j;
        mejorD = d;
      }
    }
    orden.push(mejor);
    restantes.delete(mejor);
    actual = mejor;
  }
  return orden;
}

interface RespuestaRoute {
  routes: Array<{ distance: number; duration: number; legs: Array<{ distance: number; duration: number }>; geometry?: { coordinates: Array<[number, number]> } }>;
}

async function ordenarMasCercanoPorCalle(
  origen: { latitud: number; longitud: number },
  puntos: PuntoRuta[],
  volver: boolean,
  opciones: OpcionesOrden = {},
): Promise<OrdenVisitas> {
  const coords = [origen, ...puntos].map(coord).join(';');
  const tabla = await pedir<RespuestaTable>(`/table/v1/driving/${coords}?annotations=distance`);
  const idxPrimero = opciones.primeroId === undefined ? -1 : puntos.findIndex((p) => p.id === opciones.primeroId);
  const orden = ordenMasCercano(tabla.distances, idxPrimero >= 0 ? idxPrimero + 1 : undefined);
  // Sin `desdeOficina` el recorrido empieza en la primera visita (no se cuenta el viaje desde la oficina).
  const desdeOficina = idxPrimero < 0 || opciones.desdeOficina !== false;
  const via = desdeOficina ? (opciones.via ?? []).map(([longitud, latitud]) => ({ longitud, latitud })) : [];
  const secuencia = [...(desdeOficina ? [origen] : []), ...via, ...orden.map((i) => puntos[i - 1]), ...(volver ? [origen] : [])];
  const ruta = await pedir<RespuestaRoute>(`/route/v1/driving/${secuencia.map(coord).join(';')}?overview=full&geometries=geojson&steps=false`);
  const r = ruta.routes[0];
  if (!r) throw new RuteoError('SIN_RUTA', 'No se encontró un recorrido entre los puntos.');
  let acumulado = 0;
  const paradas = orden.map((i, n) => {
    // Si el recorrido empieza en la primera visita, ella no tiene tramo anterior.
    let tramo = !desdeOficina && n === 0 ? { distance: 0, duration: 0 } : r.legs[desdeOficina ? n + via.length : n - 1];
    // El primer tramo incluye lo andado hasta los puntos intermedios.
    if (n === 0 && via.length > 0) tramo = r.legs.slice(0, via.length + 1).reduce((t, l) => ({ distance: t.distance + l.distance, duration: t.duration + l.duration }), { distance: 0, duration: 0 });
    acumulado += tramo.distance;
    return { id: puntos[i - 1].id, posicion: n + 1, kmDesdeAnterior: aKm(tramo.distance), minDesdeAnterior: aMin(tramo.duration), kmAcumulado: aKm(acumulado) };
  });
  const vuelta = volver ? r.legs[r.legs.length - 1] : undefined;
  return {
    paradas,
    totalKm: aKm(r.distance),
    totalMin: aMin(r.duration),
    vuelta: vuelta ? { km: aKm(vuelta.distance), min: aMin(vuelta.duration) } : null,
    geometria: r.geometry?.coordinates ?? [],
  };
}

export async function ordenarVisitas(
  origen: { latitud: number; longitud: number },
  puntos: PuntoRuta[],
  volver: boolean,
  criterio: CriterioOrden = 'cercania',
  opciones: OpcionesOrden = {},
): Promise<OrdenVisitas> {
  if (puntos.length === 0) return { paradas: [], totalKm: 0, totalMin: 0, vuelta: null, geometria: [] };
  if (puntos.length > MAX_PUNTOS) throw new RuteoError('HTTP', `Hasta ${MAX_PUNTOS} puntos por pedido.`);
  // Con una primera visita elegida o con puntos de paso el orden es siempre "al más cercano desde ahí" (el solver de recorrido corto no admite fijar la segunda parada).
  if (criterio === 'cercania' || opciones.primeroId !== undefined || (opciones.via?.length ?? 0) > 0) return ordenarMasCercanoPorCalle(origen, puntos, volver, opciones);
  const coords = [origen, ...puntos].map(coord).join(';');
  // Con vuelta el recorrido es un circuito; sin vuelta termina donde convenga (en cualquier punto).
  const modo = volver ? 'roundtrip=true&source=first' : 'roundtrip=false&source=first&destination=any';
  const resp = await pedir<RespuestaTrip>(`/trip/v1/driving/${coords}?${modo}&overview=full&geometries=geojson&steps=false`);
  return interpretarTrip(resp, puntos, volver);
}

// ---------------------------------------------------------------------------------------------
// Distancia por calle desde un origen a cada punto
// ---------------------------------------------------------------------------------------------

interface RespuestaTable {
  distances: Array<Array<number | null>>;
  durations: Array<Array<number | null>>;
}

export interface DistanciaPunto {
  id: string | number;
  /** null si el punto no tiene calle alcanzable desde el origen. */
  km: number | null;
  min: number | null;
}

// Una posición de unidad estacionada no cambia: se recuerda unos días para no repetir pedidos.
const TTL_MS = 7 * 24 * 3_600_000;
const cache = new Map<string, { at: number; km: number | null; min: number | null }>();
const clave = (o: { latitud: number; longitud: number }, p: { latitud: number; longitud: number }) => `${o.latitud.toFixed(4)},${o.longitud.toFixed(4)}>${p.latitud.toFixed(4)},${p.longitud.toFixed(4)}`;

export async function distanciasDesde(origen: { latitud: number; longitud: number }, puntos: PuntoRuta[]): Promise<DistanciaPunto[]> {
  const salida = new Map<string | number, DistanciaPunto>();
  const pendientes: PuntoRuta[] = [];
  for (const p of puntos) {
    const hit = cache.get(clave(origen, p));
    if (hit && Date.now() - hit.at < TTL_MS) salida.set(p.id, { id: p.id, km: hit.km, min: hit.min });
    else pendientes.push(p);
  }
  for (let i = 0; i < pendientes.length; i += MAX_PUNTOS) {
    const lote = pendientes.slice(i, i + MAX_PUNTOS);
    const coords = [origen, ...lote].map(coord).join(';');
    const resp = await pedir<RespuestaTable>(`/table/v1/driving/${coords}?sources=0&annotations=distance,duration`);
    lote.forEach((p, n) => {
      const d = resp.distances[0]?.[n + 1] ?? null;
      const t = resp.durations[0]?.[n + 1] ?? null;
      const r = { km: d === null ? null : aKm(d), min: t === null ? null : aMin(t) };
      cache.set(clave(origen, p), { at: Date.now(), ...r });
      salida.set(p.id, { id: p.id, ...r });
    });
    if (cache.size > 20_000) for (const k of [...cache.keys()].slice(0, 5_000)) cache.delete(k);
  }
  return puntos.map((p) => salida.get(p.id) as DistanciaPunto);
}

// ---------------------------------------------------------------------------------------------
// Varios técnicos: se reparten los puntos en "gajos" alrededor de la oficina y cada técnico recorre el suyo
// ---------------------------------------------------------------------------------------------

/**
 * Reparte los puntos en `cantidad` grupos de carga parecida, por barrido: se ordenan por el ángulo (rumbo)
 * desde el origen y se cortan en tramos consecutivos, así cada técnico queda con una porción del mapa (un
 * "gajo") y no se cruzan los recorridos. El corte arranca en el mayor hueco angular para no partir un grupo
 * que está junto. Cada punto pesa más cuanto más lejos está de la origen (1 + km / 40, en línea recta), porque
 * ir lejos lleva más tiempo: un técnico con pocas unidades lejanas equilibra a otro con muchas cercanas.
 * Es una heurística: no mira la distancia por calle ni el tiempo exacto de cada recorrido.
 */
export function repartirPorBarrido(origen: { latitud: number; longitud: number }, puntos: PuntoRuta[], cantidad: number): PuntoRuta[][] {
  const k = Math.max(1, Math.min(Math.floor(cantidad), puntos.length));
  if (k === 1) return [puntos];
  // Rumbo en grados [0, 360); la longitud se achata por el coseno de la latitud para que el ángulo sea real.
  const kx = Math.cos((origen.latitud * Math.PI) / 180);
  const conAngulo = puntos
    .map((p) => {
      const a = (Math.atan2((p.longitud - origen.longitud) * kx, p.latitud - origen.latitud) * 180) / Math.PI;
      return { p, a: (a + 360) % 360 };
    })
    .sort((x, y) => x.a - y.a);
  // El corte empieza justo después del mayor hueco entre ángulos consecutivos (contando el cierre de 360°).
  let mejor = 0;
  let hueco = -1;
  conAngulo.forEach((c, i) => {
    const siguiente = conAngulo[(i + 1) % conAngulo.length].a + (i === conAngulo.length - 1 ? 360 : 0);
    if (siguiente - c.a > hueco) {
      hueco = siguiente - c.a;
      mejor = (i + 1) % conAngulo.length;
    }
  });
  const rotados = [...conAngulo.slice(mejor), ...conAngulo.slice(0, mejor)].map((c) => c.p);
  const peso = (p: PuntoRuta) => {
    const dLat = (p.latitud - origen.latitud) * 111.195;
    const dLng = (p.longitud - origen.longitud) * 111.195 * kx;
    return 1 + Math.hypot(dLat, dLng) / 40;
  };
  const pesos = rotados.map(peso);
  const total = pesos.reduce((n, w) => n + w, 0);
  const grupos: PuntoRuta[][] = [];
  let desde = 0;
  let acumulado = 0;
  for (let g = 0; g < k; g++) {
    if (g === k - 1) {
      grupos.push(rotados.slice(desde));
      break;
    }
    // Corta donde el acumulado queda más cerca de la parte que le toca, dejando al menos un punto por grupo.
    const objetivo = (total * (g + 1)) / k;
    const maximo = rotados.length - (k - 1 - g);
    let hasta = desde + 1;
    acumulado += pesos[desde];
    while (hasta < maximo && Math.abs(acumulado + pesos[hasta] - objetivo) < Math.abs(acumulado - objetivo)) {
      acumulado += pesos[hasta];
      hasta++;
    }
    grupos.push(rotados.slice(desde, hasta));
    desde = hasta;
  }
  return grupos;
}

/** Carga estimada de un punto: 1 + km / 40 en línea recta desde el origen (ir lejos lleva más tiempo). */
function pesoPunto(origen: { latitud: number; longitud: number }, p: PuntoRuta): number {
  const kx = Math.cos((origen.latitud * Math.PI) / 180);
  return 1 + Math.hypot((p.latitud - origen.latitud) * 111.195, (p.longitud - origen.longitud) * 111.195 * kx) / 40;
}

/**
 * Reparto con territorios:
 * - Los puntos cuya zona es de UN solo técnico van con él.
 * - Los puntos de una zona compartida por varios técnicos se reparten entre ellos: se cortan en porciones por barrido
 *   (cada técnico queda con una parte del mapa de la zona, con carga parecida) y las porciones más cargadas se dan a
 *   los técnicos que menos llevan hasta ese momento.
 * - Lo que no tiene dueño se reparte por barrido entre los técnicos que quedaron sin nada (si todos tienen, cada
 *   punto libre va al técnico cuyo grupo le queda más cerca).
 */
export function repartirConTerritorios(origen: { latitud: number; longitud: number }, puntos: PuntoRuta[], cantidad: number): PuntoRuta[][] {
  const k = Math.max(1, Math.floor(cantidad));
  const grupos: PuntoRuta[][] = Array.from({ length: k }, () => []);
  const libres: PuntoRuta[] = [];
  const compartidos = new Map<string, { tecnicos: number[]; puntos: PuntoRuta[] }>();
  for (const p of puntos) {
    const candidatos = [...new Set((p.tecnicos ?? []).filter((t) => t >= 0 && t < k))].sort((a, b) => a - b);
    if (candidatos.length === 1) grupos[candidatos[0]].push(p);
    else if (candidatos.length > 1) {
      const clave = candidatos.join(',');
      const c = compartidos.get(clave) ?? { tecnicos: candidatos, puntos: [] };
      c.puntos.push(p);
      compartidos.set(clave, c);
    } else libres.push(p);
  }

  const carga = (g: PuntoRuta[]) => g.reduce((n, p) => n + pesoPunto(origen, p), 0);
  for (const { tecnicos, puntos: pts } of compartidos.values()) {
    const porciones = repartirPorBarrido(origen, pts, tecnicos.length)
      .map((parte) => ({ parte, peso: carga(parte) }))
      .sort((a, b) => b.peso - a.peso);
    const candidatos = [...tecnicos].sort((a, b) => carga(grupos[a]) - carga(grupos[b]));
    porciones.forEach(({ parte }, n) => grupos[candidatos[n]].push(...parte));
  }

  if (libres.length === 0) return grupos;
  const sinNada = grupos.map((g, i) => (g.length === 0 ? i : -1)).filter((i) => i >= 0);
  if (sinNada.length > 0) {
    const partes = repartirPorBarrido(origen, libres, sinNada.length);
    partes.forEach((parte, n) => grupos[sinNada[n]].push(...parte));
  } else {
    const centro = (g: PuntoRuta[]) => ({ latitud: g.reduce((n, p) => n + p.latitud, 0) / g.length, longitud: g.reduce((n, p) => n + p.longitud, 0) / g.length });
    const centros = grupos.map(centro);
    for (const p of libres) {
      let mejor = 0;
      let mejorD = Number.POSITIVE_INFINITY;
      centros.forEach((c, i) => {
        const d = Math.hypot(p.latitud - c.latitud, p.longitud - c.longitud);
        if (d < mejorD) {
          mejorD = d;
          mejor = i;
        }
      });
      grupos[mejor].push(p);
    }
  }
  return grupos;
}

/**
 * Puntos clave de una ruta de acceso hasta donde le sirve al grupo: se corta en el punto clave más cercano a la
 * visita más lejana, para no obligar al técnico a seguir la ruta hasta el final.
 */
export function recortarVia(via: Array<[number, number]>, grupo: PuntoRuta[], desde: { latitud: number; longitud: number }): Array<[number, number]> {
  if (via.length === 0 || grupo.length === 0) return [];
  const kx = Math.cos((desde.latitud * Math.PI) / 180);
  const dist = (a: [number, number], p: { latitud: number; longitud: number }) => Math.hypot((a[0] - p.longitud) * kx, a[1] - p.latitud);
  const lejos = grupo.reduce((m, p) => (Math.hypot((p.longitud - desde.longitud) * kx, p.latitud - desde.latitud) > Math.hypot((m.longitud - desde.longitud) * kx, m.latitud - desde.latitud) ? p : m));
  let j = 0;
  via.forEach((v, i) => {
    if (dist(v, lejos) < dist(via[j], lejos)) j = i;
  });
  return via.slice(0, j + 1);
}

export interface RecorridoTecnico extends OrdenVisitas {
  /** Posición del técnico en la lista pedida (0 = el primero). */
  tecnico: number;
}

/** Tramo que hacen todos los técnicos juntos, de la oficina hasta el punto donde se separan. */
export interface TramoCompartido {
  km: number;
  min: number;
  geometria: Array<[number, number]>;
}

export interface OpcionesVarios extends OpcionesOrden {
  /** Por técnico (misma posición que en la lista): puntos de paso para que cada uno use una ruta distinta. */
  vias?: Array<Array<[number, number]>>;
  /** Los técnicos salen juntos de la oficina hasta este punto y desde ahí se reparten; sus recorridos arrancan ahí. */
  juntosHasta?: { latitud: number; longitud: number };
}

export async function ordenarVisitasVariosTecnicos(
  origen: { latitud: number; longitud: number },
  puntos: PuntoRuta[],
  cantidad: number,
  volver: boolean,
  criterio: CriterioOrden = 'cercania',
  opciones: OpcionesVarios = {},
): Promise<{ recorridos: RecorridoTecnico[]; compartido: TramoCompartido | null }> {
  const { vias, juntosHasta, ...orden } = opciones;
  // Si algún punto trae técnico asignado (territorios) se respeta; si no, todo se reparte por barrido.
  const conTerritorio = puntos.some((p) => (p.tecnicos?.length ?? 0) > 0);
  const desde = juntosHasta ?? origen;
  const grupos = conTerritorio ? repartirConTerritorios(desde, puntos, cantidad) : repartirPorBarrido(desde, puntos, cantidad);
  let compartido: TramoCompartido | null = null;
  if (juntosHasta) {
    const r = await pedir<RespuestaRoute>(`/route/v1/driving/${coord(origen)};${coord(juntosHasta)}?overview=full&geometries=geojson&steps=false`);
    const ruta = r.routes[0];
    if (!ruta) throw new RuteoError('SIN_RUTA', 'No se encontró un camino hasta el punto donde se separan.');
    compartido = { km: aKm(ruta.distance), min: aMin(ruta.duration), geometria: ruta.geometry?.coordinates ?? [] };
  }
  const recorridos = await Promise.all(
    grupos.map((g, t) =>
      g.length === 0
        ? Promise.resolve<OrdenVisitas>({ paradas: [], totalKm: 0, totalMin: 0, vuelta: null, geometria: [] })
        : ordenarVisitas(desde, g, volver, criterio, { ...(g.some((p) => p.id === orden.primeroId) ? orden : {}), via: recortarVia(vias?.[t] ?? [], g, desde) }),
    ),
  );
  return { recorridos: recorridos.map((r, tecnico) => ({ ...r, tecnico })), compartido };
}

// ---------------------------------------------------------------------------------------------
// Rutas de acceso rápido: se marcan unos pocos puntos y el trazo sale de rutear por las calles entre ellos
// ---------------------------------------------------------------------------------------------

export interface TrazoRuta {
  /** [longitud, latitud]. */
  trazo: Array<[number, number]>;
  km: number;
  /** false si no hay servicio de rutas y el trazo es solo la línea recta entre los puntos marcados. */
  porCalle: boolean;
}

function kmRecta(a: [number, number], b: [number, number]): number {
  const kx = Math.cos((a[1] * Math.PI) / 180);
  return Math.hypot((b[0] - a[0]) * kx, b[1] - a[1]) * 111.195;
}

/** Trazo que pasa por los puntos marcados, en ese orden, siguiendo las calles (o en línea recta si no hay servicio de rutas). */
export async function trazoPorPuntos(puntos: Array<[number, number]>): Promise<TrazoRuta> {
  if (puntos.length < 2) return { trazo: puntos, km: 0, porCalle: false };
  if (!ruteoDisponible()) {
    return { trazo: puntos, km: Math.round(puntos.slice(1).reduce((n, p, i) => n + kmRecta(puntos[i], p), 0) * 10) / 10, porCalle: false };
  }
  const coords = puntos.map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(';');
  const resp = await pedir<RespuestaRoute>(`/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`);
  const r = resp.routes[0];
  if (!r) throw new RuteoError('SIN_RUTA', 'No se encontró un camino que pase por esos puntos.');
  return { trazo: r.geometry?.coordinates ?? puntos, km: aKm(r.distance), porCalle: true };
}
