import { z } from 'zod';

const punto = z.object({
  id: z.union([z.string().min(1).max(60), z.number()]),
  latitud: z.number().min(-90).max(90),
  longitud: z.number().min(-180).max(180),
  // Técnicos (posiciones en la lista) a los que ya les corresponde por su territorio; con varios, la zona se comparte.
  tecnicos: z.array(z.number().int().min(0).max(7)).max(8).optional(),
});

// Primera visita del recorrido: el resto sigue desde ahí hacia el más cercano.
const primeroId = z.union([z.string().min(1).max(60), z.number()]).optional();
const origen = z.object({ latitud: z.number().min(-90).max(90), longitud: z.number().min(-180).max(180) });

export const ordenVisitasBodySchema = z.object({
  origen,
  puntos: z.array(punto).min(1).max(100),
  // true = el recorrido vuelve al origen; false = termina en la última visita.
  volver: z.boolean().default(false),
  // cercania = de la unidad más cercana a la siguiente más cercana; optimo = el recorrido más corto en total.
  criterio: z.enum(['cercania', 'optimo']).default('cercania'),
  primeroId,
  // Con primeroId: false = el recorrido empieza en esa visita (sin el viaje desde la oficina).
  desdeOficina: z.boolean().default(true),
});

export const distanciasBodySchema = z.object({
  origen,
  puntos: z.array(punto).min(1).max(500),
});

export const variosTecnicosBodySchema = z.object({
  origen,
  puntos: z.array(punto).min(1).max(100),
  // Cuántos técnicos salen; los puntos se reparten entre ellos.
  cantidad: z.number().int().min(1).max(8),
  volver: z.boolean().default(false),
  criterio: z.enum(['cercania', 'optimo']).default('cercania'),
  primeroId,
  desdeOficina: z.boolean().default(true),
  // Por técnico (misma posición que en la lista): puntos [longitud, latitud] de paso, para que use otra ruta.
  vias: z.array(z.array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])).max(12)).max(8).optional(),
  // Los técnicos van juntos de la oficina hasta acá y después se separan.
  juntosHasta: origen.optional(),
});
