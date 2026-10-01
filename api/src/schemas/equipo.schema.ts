import { z } from 'zod';

export const buscarEquiposQuerySchema = z.object({
  q: z.string().trim().min(3, 'Escribí al menos 3 caracteres').max(60),
});

export const equipoIdParamsSchema = z.object({
  equipoId: z.coerce.number().int().positive(),
});

export const estadoEquipoQuerySchema = z.object({
  // `forzar=1` saltea el cache de 30s (botón "Actualizar" de la pantalla).
  forzar: z
    .enum(['0', '1'])
    .optional()
    .transform((v) => v === '1'),
});

export const graficasEquipoQuerySchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)'),
});
