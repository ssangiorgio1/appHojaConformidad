import { z } from 'zod';

const coordenada = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

export const rutaAccesoBodySchema = z.object({
  nombre: z.string().trim().min(2).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido (#RRGGBB)').default('#2563eb'),
  anchoKm: z.number().min(0.2).max(50).default(3),
  // Puntos clave marcados en el mapa; el trazo por las calles lo calcula la API.
  puntos: z.array(coordenada).min(2, 'La ruta necesita al menos 2 puntos').max(25),
  activa: z.boolean().default(true),
});

export const previsualizarBodySchema = z.object({
  puntos: z.array(coordenada).min(2).max(25),
});
export type RutaAccesoBody = z.infer<typeof rutaAccesoBodySchema>;

export const idParamsSchema = z.object({ id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Id inválido') });

export const territorioBodySchema = z.object({
  tecnicoNombre: z.string().trim().min(1).max(120),
  rutas: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).max(50).default([]),
  departamentos: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  distritos: z.array(z.string().trim().min(1).max(120)).max(300).default([]),
});
export type TerritorioBody = z.infer<typeof territorioBodySchema>;
