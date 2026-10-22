import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { UbicacionCacheModel } from '../models/UbicacionCache.js';
import { resolverUbicacion, tieneDatos, type UbicacionResuelta } from '../services/ubicacion.service.js';

// Cache en memoria encima del de Mongo: la misma ubicación se pide muchas veces por día (cada técnico abre la ficha).
const memoria = new Map<string, UbicacionResuelta>();
const MEMORIA_MAX = 2000;
// Lo que no se pudo resolver se recuerda unos minutos para no martillar a Google ni a Nominatim.
const fallos = new Map<string, number>();
const FALLO_MS = 5 * 60_000;

function recordar(u: UbicacionResuelta): void {
  if (memoria.size >= MEMORIA_MAX) memoria.delete(memoria.keys().next().value as string);
  memoria.set(u.texto, u);
}

function soloDatos(doc: Record<string, unknown>): UbicacionResuelta {
  return {
    texto: String(doc.texto),
    url: String(doc.url),
    lat: (doc.lat as number | null) ?? null,
    lng: (doc.lng as number | null) ?? null,
    nombre: (doc.nombre as string | null) ?? null,
    direccion: (doc.direccion as string | null) ?? null,
    calle: (doc.calle as string | null) ?? null,
    ciudad: (doc.ciudad as string | null) ?? null,
    provincia: (doc.provincia as string | null) ?? null,
  };
}

// Resuelve el link de Maps cargado en Odoo a lugar, coordenadas y dirección. Nunca falla: si no se puede resolver
// devuelve solo el link y la PWA muestra "Ver en Google Maps" como siempre.
export const resolver = asyncHandler(async (req: Request, res: Response) => {
  const { texto } = req.query as unknown as { texto: string };
  res.setHeader('Cache-Control', 'private, max-age=3600');

  const enMemoria = memoria.get(texto);
  if (enMemoria) {
    res.json(enMemoria);
    return;
  }

  const guardada = await UbicacionCacheModel.findOne({ texto }).lean().catch(() => null);
  if (guardada) {
    const datos = soloDatos(guardada as unknown as Record<string, unknown>);
    recordar(datos);
    res.json(datos);
    return;
  }

  const falloAt = fallos.get(texto);
  if (falloAt && Date.now() - falloAt < FALLO_MS) {
    // Falló hace instantes: no se vuelve a intentar todavía, se devuelve solo el link.
    res.json(await resolverUbicacion(texto, { expandir: async () => null, geocodificar: async () => ({ calle: null, ciudad: null, provincia: null, direccion: null }) }));
    return;
  }

  const resultado = await resolverUbicacion(texto);
  if (tieneDatos(resultado)) {
    recordar(resultado);
    await UbicacionCacheModel.updateOne({ texto }, { $set: resultado }, { upsert: true }).catch((err) => console.error('UBICACION_CACHE_SAVE_FAILED', err));
  } else {
    fallos.set(texto, Date.now());
  }
  res.json(resultado);
});
