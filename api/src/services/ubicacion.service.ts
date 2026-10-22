// "Ubicación de la unidad" (campo de Odoo, texto libre): casi siempre es un link de Google Maps pegado por coordinación.
// En vez de mostrar solo "Ver en Google Maps", se extrae del link el lugar y las coordenadas y, con las coordenadas, la
// dirección (calle, número, barrio, ciudad, provincia). Los links cortos (maps.app.goo.gl) se expanden siguiendo la
// redirección de Google. Todo es best-effort: si algo falla, la PWA sigue mostrando el link como antes.

export interface UbicacionResuelta {
  // El texto original cargado en Odoo.
  texto: string;
  // A dónde abre el mapa: el link original, o una búsqueda si el texto no era un link.
  url: string;
  lat: number | null;
  lng: number | null;
  // Nombre del lugar si el link lo trae (un comercio, un predio). No coordenadas.
  nombre: string | null;
  // "Calle 1234, Barrio, Ciudad, Provincia" (reverse geocoding de las coordenadas, o el texto si era una dirección).
  direccion: string | null;
  // Solo "Calle 1234", para mostrarla destacada.
  calle: string | null;
  ciudad: string | null;
  provincia: string | null;
}

export interface DatosLink {
  lat: number | null;
  lng: number | null;
  nombre: string | null;
  // Las coordenadas son el pin exacto del lugar (o las que se escribieron). Si vienen solo del centro del mapa
  // (`@lat,lng`) pueden estar corridas respecto del lugar que nombra el link.
  exacta: boolean;
}

const ES_LINK = /^https?:\/\/\S+$/i;
const MAX_TEXTO = 500;

export function esLink(texto: string): boolean {
  return ES_LINK.test(texto.trim());
}

export function mapsUrl(texto: string): string {
  const t = texto.trim();
  // Solo http(s): nunca se arma un href con otro esquema a partir de un texto cargado en Odoo.
  return esLink(t) ? t : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t)}`;
}

// --- Parseo de links (puro, sin red) -----------------------------------------------------------------------------

const NUM = '-?\\d{1,3}(?:\\.\\d+)?';
const RE_PIN = new RegExp(`!3d(${NUM})!4d(${NUM})`);
const RE_ARROBA = new RegExp(`@(${NUM}),(${NUM})`);
const RE_PARAM = new RegExp(`[?&](?:q|ll|query|destination|center)=(${NUM}),\\s*(${NUM})(?:&|$)`);
const RE_PAR_SUELTO = new RegExp(`^\\s*(${NUM})\\s*[,;]\\s*(${NUM})\\s*$`);

function coordenadaValida(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

// "32°52'23.3"S 68°51'02.8"W" o "-32.87, -68.85": Google usa las coordenadas como nombre cuando el pin no tiene lugar.
export function pareceCoordenadas(nombre: string): boolean {
  return /\d/.test(nombre) && /^[\s\d°º'"′″.,;+\-−NSEOWnseow]+$/.test(nombre);
}

function decodificar(s: string): string | null {
  try {
    const t = decodeURIComponent(s.replace(/\+/g, ' ')).trim();
    return t || null;
  } catch {
    return null;
  }
}

// Extrae coordenadas y nombre del lugar de un link largo de Google Maps. El pin exacto (`!3d…!4d…`) manda sobre el
// centro del mapa (`@lat,lng`), que puede estar corrido.
export function parsearLinkDeMaps(url: string): DatosLink {
  let coords: [number, number] | null = null;
  let exacta = false;
  for (const re of [RE_PIN, RE_ARROBA, RE_PARAM]) {
    const m = re.exec(url);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (coordenadaValida(lat, lng)) {
        coords = [lat, lng];
        exacta = re !== RE_ARROBA;
        break;
      }
    }
  }

  let nombre: string | null = null;
  const lugar = /\/maps\/(?:place|search)\/([^/@?]+)/.exec(url);
  if (lugar) nombre = decodificar(lugar[1]);
  if (!nombre) {
    const q = /[?&](?:q|query)=([^&]+)/.exec(url);
    if (q) nombre = decodificar(q[1]);
  }
  if (nombre && pareceCoordenadas(nombre)) nombre = null;

  return { lat: coords ? coords[0] : null, lng: coords ? coords[1] : null, nombre, exacta };
}

// Texto cargado en Odoo: un link de Maps, un par "lat, lng", o una dirección escrita a mano.
export function parsearTextoUbicacion(texto: string): DatosLink {
  const t = texto.trim();
  if (esLink(t)) return parsearLinkDeMaps(t);
  const par = RE_PAR_SUELTO.exec(t);
  if (par && coordenadaValida(Number(par[1]), Number(par[2]))) return { lat: Number(par[1]), lng: Number(par[2]), nombre: null, exacta: true };
  return { lat: null, lng: null, nombre: t || null, exacta: false };
}

// --- Links cortos ------------------------------------------------------------------------------------------------

// Solo se siguen redirecciones a hosts de Google: el texto viene de Odoo y nunca debe hacer que el servidor pida
// cualquier URL.
const HOSTS_CORTOS = new Set(['maps.app.goo.gl', 'goo.gl', 'g.co']);
const RE_HOST_GOOGLE = /^(?:www\.|maps\.)?google\.[a-z]{2,3}(?:\.[a-z]{2})?$/i;

export function hostPermitido(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    return HOSTS_CORTOS.has(u.hostname.toLowerCase()) || RE_HOST_GOOGLE.test(u.hostname);
  } catch {
    return false;
  }
}

export function esLinkCorto(url: string): boolean {
  try {
    const u = new URL(url);
    return HOSTS_CORTOS.has(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

type FetchLike = (url: string, init?: { redirect?: 'manual'; signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{
  status: number;
  headers: { get(name: string): string | null };
}>;

// Sigue la redirección de un link corto hasta el link largo de Google Maps (máximo 4 saltos, 4 s por salto).
export async function expandirLinkCorto(url: string, fetchFn: FetchLike = fetch as unknown as FetchLike): Promise<string | null> {
  let actual = url;
  for (let salto = 0; salto < 4; salto++) {
    if (!hostPermitido(actual)) return null;
    // Un link largo ya trae todo lo que se puede leer: no hace falta seguir.
    if (!esLinkCorto(actual) && salto > 0) return actual;
    const res = await fetchFn(actual, { redirect: 'manual', signal: AbortSignal.timeout(4000), headers: { 'user-agent': 'Mozilla/5.0 (compatible; WARA-Conformidad/1.0)' } });
    const ubicacion = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && ubicacion) {
      actual = new URL(ubicacion, actual).toString();
      continue;
    }
    return esLinkCorto(actual) ? null : actual;
  }
  return hostPermitido(actual) && !esLinkCorto(actual) ? actual : null;
}

// --- Dirección a partir de coordenadas ---------------------------------------------------------------------------

export interface DireccionNominatim {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  footway?: string;
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  state_district?: string;
  state?: string;
  postcode?: string;
}

export interface DireccionFormateada {
  calle: string | null;
  ciudad: string | null;
  provincia: string | null;
  direccion: string | null;
}

// "Cayetano Alberto Silva 2445, Barrio Ferroviario, Ciudad de Mendoza, Mendoza".
export function formatearDireccion(a: DireccionNominatim | null | undefined): DireccionFormateada {
  if (!a) return { calle: null, ciudad: null, provincia: null, direccion: null };
  const via = a.road ?? a.pedestrian ?? a.footway ?? null;
  const calle = via ? (a.house_number ? `${via} ${a.house_number}` : via) : null;
  const barrio = a.neighbourhood ?? a.suburb ?? a.quarter ?? null;
  const ciudad = a.city ?? a.town ?? a.village ?? a.municipality ?? a.state_district ?? null;
  const provincia = a.state ?? null;
  const partes: string[] = [];
  for (const p of [calle, barrio, ciudad, provincia]) {
    if (p && !partes.some((x) => x.toLowerCase() === p.toLowerCase())) partes.push(p);
  }
  return { calle, ciudad, provincia, direccion: partes.length ? partes.join(', ') : null };
}

// Nominatim (OpenStreetMap) pide identificarse y no más de 1 pedido por segundo: se encolan y se espacian.
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const NOMINATIM_ESPERA_MS = 1100;
let colaNominatim: Promise<unknown> = Promise.resolve();

export function geocodificarInverso(lat: number, lng: number): Promise<DireccionFormateada> {
  const tarea = colaNominatim.then(async () => {
    try {
      const url = `${NOMINATIM_URL}?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=es`;
      const res = await fetch(url, {
        headers: { 'user-agent': 'WARA-Conformidad/1.0 (soporte@waragps.com)' },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return formatearDireccion(null);
      const json = (await res.json()) as { address?: DireccionNominatim };
      return formatearDireccion(json.address);
    } catch {
      return formatearDireccion(null);
    } finally {
      await new Promise((r) => setTimeout(r, NOMINATIM_ESPERA_MS));
    }
  });
  colaNominatim = tarea.catch(() => undefined);
  return tarea as Promise<DireccionFormateada>;
}

// --- Orquestación ------------------------------------------------------------------------------------------------

export interface DepsUbicacion {
  expandir?: (url: string) => Promise<string | null>;
  geocodificar?: (lat: number, lng: number) => Promise<DireccionFormateada>;
}

function sinResolver(texto: string): UbicacionResuelta {
  return { texto, url: mapsUrl(texto), lat: null, lng: null, nombre: null, direccion: null, calle: null, ciudad: null, provincia: null };
}

// Nunca lanza: lo que no se pueda resolver queda en null y la PWA muestra el link de siempre.
export async function resolverUbicacion(textoOriginal: string, deps: DepsUbicacion = {}): Promise<UbicacionResuelta> {
  const texto = textoOriginal.trim().slice(0, MAX_TEXTO);
  if (!texto) return sinResolver('');
  const expandir = deps.expandir ?? ((u: string) => expandirLinkCorto(u));
  const geocodificar = deps.geocodificar ?? geocodificarInverso;
  const base = sinResolver(texto);

  try {
    // Una dirección escrita a mano ya es la dirección: no hace falta nada más.
    if (!esLink(texto)) {
      const datos = parsearTextoUbicacion(texto);
      if (datos.lat === null) return { ...base, direccion: texto, calle: null };
      const dir = await geocodificar(datos.lat, datos.lng!);
      return { ...base, lat: datos.lat, lng: datos.lng, direccion: dir.direccion ?? texto, calle: dir.calle, ciudad: dir.ciudad, provincia: dir.provincia };
    }

    let urlLarga: string | null = texto;
    if (esLinkCorto(texto)) urlLarga = await expandir(texto);
    if (!urlLarga) return base;

    const datos = parsearLinkDeMaps(urlLarga);
    let dir: DireccionFormateada = { calle: null, ciudad: null, provincia: null, direccion: null };
    if (datos.lat !== null && datos.lng !== null) dir = await geocodificar(datos.lat, datos.lng);
    // El link nombra un lugar pero las coordenadas son solo el centro del mapa (pueden estar corridas): manda el nombre
    // del link y de las coordenadas se toma únicamente la localidad, para no mostrar una calle que contradiga al nombre.
    if (datos.nombre && !datos.exacta) {
      const partes: string[] = [];
      for (const p of [datos.nombre, dir.ciudad, dir.provincia]) {
        if (p && !partes.some((x) => x.toLowerCase() === p.toLowerCase())) partes.push(p);
      }
      return { ...base, lat: datos.lat, lng: datos.lng, nombre: datos.nombre, direccion: partes.join(', '), calle: datos.nombre, ciudad: dir.ciudad, provincia: dir.provincia };
    }
    return {
      ...base,
      lat: datos.lat,
      lng: datos.lng,
      nombre: datos.nombre,
      direccion: dir.direccion ?? datos.nombre,
      calle: dir.calle,
      ciudad: dir.ciudad,
      provincia: dir.provincia,
    };
  } catch {
    return base;
  }
}

// ¿Vale la pena guardar el resultado? Un fallo transitorio (sin red, Google lento) no se guarda: se vuelve a intentar.
export function tieneDatos(u: UbicacionResuelta): boolean {
  return u.direccion !== null || u.nombre !== null || u.lat !== null;
}
