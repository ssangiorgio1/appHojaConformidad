import departamentos from '@/data/mendozaDepartamentos.json';
import distritosJson from '@/data/mendozaDistritos.json';

export interface Departamento {
  nombre: string;
  /** Polígonos como [lng, lat]; cada polígono = anillo exterior + huecos. */
  poligonos: number[][][][];
  /** Caja envolvente, para descartar rápido los puntos que no pueden caer adentro. */
  norte: number;
  sur: number;
  este: number;
  oeste: number;
}

interface FeatureDepartamento {
  type: 'Feature';
  properties: { nombre: string };
  geometry: { type: 'MultiPolygon'; coordinates: number[][][][] };
}
export interface DepartamentosGeoJson {
  type: 'FeatureCollection';
  features: FeatureDepartamento[];
}

export const DEPARTAMENTOS_GEOJSON = departamentos as unknown as DepartamentosGeoJson;

export const DEPARTAMENTOS: Departamento[] = DEPARTAMENTOS_GEOJSON.features.map((f) => {
  const poligonos = f.geometry.coordinates;
  let norte = -90;
  let sur = 90;
  let este = -180;
  let oeste = 180;
  for (const poly of poligonos)
    for (const [lng, lat] of poly[0]) {
      if (lat > norte) norte = lat;
      if (lat < sur) sur = lat;
      if (lng > este) este = lng;
      if (lng < oeste) oeste = lng;
    }
  return { nombre: f.properties.nombre, poligonos, norte, sur, este, oeste };
});

function enAnillo(lng: number, lat: number, anillo: number[][]): boolean {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i];
    const [xj, yj] = anillo[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** Nombre del departamento de Mendoza que contiene el punto, o null si cae fuera de Mendoza. */
export function departamentoDe(lat: number, lng: number): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  for (const d of DEPARTAMENTOS) {
    if (lat > d.norte || lat < d.sur || lng > d.este || lng < d.oeste) continue;
    for (const poly of d.poligonos) {
      if (!enAnillo(lng, lat, poly[0])) continue;
      let enHueco = false;
      for (let h = 1; h < poly.length; h++) if (enAnillo(lng, lat, poly[h])) enHueco = true;
      if (!enHueco) return d.nombre;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Distritos (de OpenStreetMap, aportados por la comunidad: no son cartografía oficial). Capital no
// tiene distritos en esa fuente: se trata como una sola zona.
// ---------------------------------------------------------------------------------------------

interface FeatureDistrito {
  type: 'Feature';
  properties: { nombre: string; departamento: string };
  geometry: { type: 'MultiPolygon'; coordinates: number[][][][] };
}

export interface Distrito {
  nombre: string;
  departamento: string;
  /** Clave única (hay nombres repetidos entre departamentos): `Departamento|Distrito`. */
  clave: string;
  poligonos: number[][][][];
  norte: number;
  sur: number;
  este: number;
  oeste: number;
}

export function claveDistrito(departamento: string, distrito: string): string {
  return `${departamento}|${distrito}`;
}

function conCaja(poligonos: number[][][][]) {
  let norte = -90;
  let sur = 90;
  let este = -180;
  let oeste = 180;
  for (const poly of poligonos)
    for (const [lng, lat] of poly[0]) {
      if (lat > norte) norte = lat;
      if (lat < sur) sur = lat;
      if (lng > este) este = lng;
      if (lng < oeste) oeste = lng;
    }
  return { norte, sur, este, oeste };
}

export const DISTRITOS: Distrito[] = (distritosJson as unknown as { features: FeatureDistrito[] }).features.map((f) => ({
  nombre: f.properties.nombre,
  departamento: f.properties.departamento,
  clave: claveDistrito(f.properties.departamento, f.properties.nombre),
  poligonos: f.geometry.coordinates,
  ...conCaja(f.geometry.coordinates),
}));

const DISTRITOS_POR_DEPARTAMENTO = new Map<string, Distrito[]>();
for (const d of DISTRITOS) {
  const lista = DISTRITOS_POR_DEPARTAMENTO.get(d.departamento) ?? [];
  lista.push(d);
  DISTRITOS_POR_DEPARTAMENTO.set(d.departamento, lista);
}

function enPoligonos(lat: number, lng: number, poligonos: number[][][][]): boolean {
  for (const poly of poligonos) {
    if (!enAnillo(lng, lat, poly[0])) continue;
    let enHueco = false;
    for (let h = 1; h < poly.length; h++) if (enAnillo(lng, lat, poly[h])) enHueco = true;
    if (!enHueco) return true;
  }
  return false;
}

/** Departamento y distrito (clave) del punto; el distrito es null si el departamento no tiene o no cae en ninguno. */
export function ubicar(lat: number, lng: number): { departamento: string | null; distrito: string | null } {
  const departamento = departamentoDe(lat, lng);
  if (!departamento) return { departamento: null, distrito: null };
  for (const d of DISTRITOS_POR_DEPARTAMENTO.get(departamento) ?? []) {
    if (lat > d.norte || lat < d.sur || lng > d.este || lng < d.oeste) continue;
    if (enPoligonos(lat, lng, d.poligonos)) return { departamento, distrito: d.clave };
  }
  return { departamento, distrito: null };
}

export type TipoZona = 'departamento' | 'distrito';

export interface ZonaFeature {
  /** Departamento: su nombre. Distrito: su clave. */
  id: string;
  nombre: string;
  tipo: TipoZona;
  departamento: string;
  /** true para lo que se dibuja solo como contexto (departamentos vecinos del elegido). */
  contexto: boolean;
  geometry: { type: 'MultiPolygon'; coordinates: number[][][][] };
}

/**
 * Qué polígonos se dibujan: sin selección, los departamentos; con un departamento elegido, sus
 * distritos (o el departamento mismo si no tiene) más los otros departamentos como contexto.
 */
export function zonasVisibles(departamento: string | null): ZonaFeature[] {
  const deptos = DEPARTAMENTOS_GEOJSON.features.map<ZonaFeature>((f) => ({
    id: f.properties.nombre,
    nombre: f.properties.nombre,
    tipo: 'departamento',
    departamento: f.properties.nombre,
    contexto: departamento !== null && f.properties.nombre !== departamento,
    geometry: f.geometry,
  }));
  if (!departamento) return deptos;
  const distritos = DISTRITOS_POR_DEPARTAMENTO.get(departamento) ?? [];
  if (distritos.length === 0) return deptos;
  const otros = deptos.filter((z) => z.contexto);
  const propios = distritos.map<ZonaFeature>((d) => ({
    id: d.clave,
    nombre: d.nombre,
    tipo: 'distrito',
    departamento,
    contexto: false,
    geometry: { type: 'MultiPolygon', coordinates: d.poligonos },
  }));
  return [...otros, ...propios];
}
