import { z } from 'zod';

export const buscarEquiposQuerySchema = z.object({
  q: z.string().trim().min(3, 'Escribí al menos 3 caracteres').max(60),
});

export const numeroPorImeiQuerySchema = z.object({
  imei: z.string().trim().regex(/^\d{15}$/, 'El IMEI tiene 15 dígitos'),
});

export const historialUnidadQuerySchema = z.object({
  matricula: z.string().trim().min(2).max(40),
});

export const seriesEquiposBodySchema = z.object({
  equipoIds: z.array(z.coerce.number().int().positive()).min(1).max(300),
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

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)');

export const MAX_DIAS_GRAFICAS = 7;

// Un día (`fecha`) o un rango (`desde`..`hasta`, inclusive). `fecha` queda por compatibilidad.
export const graficasEquipoQuerySchema = z
  .object({
    fecha: fechaIso.optional(),
    desde: fechaIso.optional(),
    hasta: fechaIso.optional(),
  })
  .transform((q, ctx) => {
    const desde = q.desde ?? q.fecha;
    const hasta = q.hasta ?? q.fecha ?? q.desde;
    if (!desde || !hasta) {
      ctx.addIssue({ code: 'custom', message: 'Indicá fecha o desde/hasta' });
      return z.NEVER;
    }
    const dias = Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000) + 1;
    if (!(dias >= 1)) {
      ctx.addIssue({ code: 'custom', message: '"hasta" no puede ser anterior a "desde"' });
      return z.NEVER;
    }
    if (dias > MAX_DIAS_GRAFICAS) {
      ctx.addIssue({ code: 'custom', message: `El rango máximo es de ${MAX_DIAS_GRAFICAS} días` });
      return z.NEVER;
    }
    return { desde, hasta };
  });
