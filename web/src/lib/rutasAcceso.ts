// Rutas de acceso rápido (Costanera, Corredor del Oeste, Acceso Este…): se marcan sus puntos clave en el mapa y el
// trazo por las calles lo calcula la API.
// Una unidad pertenece a la ruta que le queda más cerca si está a menos de `anchoKm` del trazo; dentro de la ruta
// se ordena por su avance (km a lo largo del trazo desde su punto inicial, que es el lado de la oficina).

export interface RutaAcceso {
  _id: string;
  nombre: string;
  color: string;
  anchoKm: number;
  /** Puntos clave marcados en el mapa, [longitud, latitud], en el sentido de salida desde la oficina. */
  puntos: Array<[number, number]>;
  /** Trazo por las calles que pasa por esos puntos (lo calcula la API al guardar). */
  trazo: Array<[number, number]>;
  activa: boolean;
}

export interface TerritorioTecnico {
  _id: string;
  tecnicoId: string;
  tecnicoNombre: string;
  rutas: string[];
  departamentos: string[];
  /** Clave `Departamento|Distrito`. */
  distritos: string[];
}

const KM_POR_GRADO = 111.195;

interface Punto {
  latitud: number;
  longitud: number;
}

/** Distancia (km) de un punto a un segmento y posición (0..1) del punto más cercano sobre él, en un plano local. */
function sobreSegmento(p: Punto, a: [number, number], b: [number, number], kx: number): { km: number; t: number } {
  const ax = a[0] * kx;
  const ay = a[1];
  const bx = b[0] * kx;
  const by = b[1];
  const px = p.longitud * kx;
  const py = p.latitud;
  const dx = bx - ax;
  const dy = by - ay;
  const largo2 = dx * dx + dy * dy;
  const t = largo2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / largo2));
  return { km: Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) * KM_POR_GRADO, t };
}

function largoSegmentoKm(a: [number, number], b: [number, number], kx: number): number {
  return Math.hypot((b[0] - a[0]) * kx, b[1] - a[1]) * KM_POR_GRADO;
}

export interface UbicacionEnRuta {
  ruta: RutaAcceso;
  /** Distancia del punto al trazo. */
  distanciaKm: number;
  /** Km a lo largo del trazo, desde su inicio, hasta el punto más cercano a la unidad. */
  avanceKm: number;
}

/** Ruta más cercana a un punto y su avance, o null si ninguna le queda a menos de su ancho. */
export function rutaDelPunto(p: Punto, rutas: RutaAcceso[]): UbicacionEnRuta | null {
  if (!Number.isFinite(p.latitud) || !Number.isFinite(p.longitud)) return null;
  const kx = Math.cos((p.latitud * Math.PI) / 180);
  let mejor: UbicacionEnRuta | null = null;
  for (const ruta of rutas) {
    if (!ruta.activa || ruta.trazo.length < 2) continue;
    let acumulado = 0;
    let minKm = Number.POSITIVE_INFINITY;
    let avance = 0;
    for (let i = 0; i < ruta.trazo.length - 1; i++) {
      const a = ruta.trazo[i];
      const b = ruta.trazo[i + 1];
      const s = sobreSegmento(p, a, b, kx);
      const largo = largoSegmentoKm(a, b, kx);
      if (s.km < minKm) {
        minKm = s.km;
        avance = acumulado + s.t * largo;
      }
      acumulado += largo;
    }
    if (minKm <= ruta.anchoKm && (!mejor || minKm < mejor.distanciaKm)) mejor = { ruta, distanciaKm: minKm, avanceKm: avance };
  }
  return mejor;
}

/** Largo total de una ruta, en km. */
export function largoRutaKm(ruta: Pick<RutaAcceso, 'trazo'>): number {
  if (ruta.trazo.length < 2) return 0;
  const kx = Math.cos((ruta.trazo[0][1] * Math.PI) / 180);
  let total = 0;
  for (let i = 0; i < ruta.trazo.length - 1; i++) total += largoSegmentoKm(ruta.trazo[i], ruta.trazo[i + 1], kx);
  return total;
}
