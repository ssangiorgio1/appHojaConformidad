import { z } from 'zod';

export const tareaIdParamSchema = z.object({
  tareaOdooId: z.coerce.number().int().positive(),
});

// 'YYYY-MM-DD' — identifica a qué entrada de calendario (fecha real de la
// subtarea, ver calendarTask.service.ts) pertenece el viaje, desde que una
// misma tareaOdooId puede tener 2+ entradas simultáneas en fechas distintas.
const fechaField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha debe ser YYYY-MM-DD');

export const fechaQuerySchema = z.object({
  fecha: fechaField,
});

export const estadoVisitaSchema = z.object({
  // 'completo' no se acepta acá a propósito — ese estado lo dispara
  // patchConformidad server-side cuando se firma el POST, nunca un PATCH
  // directo del técnico.
  estado: z.enum(['en_camino', 'en_sitio']),
  fecha: fechaField,
});

export const finalizarVisitaSchema = z.object({
  fecha: fechaField,
});

export type TareaIdParam = z.infer<typeof tareaIdParamSchema>;
export type FechaQuery = z.infer<typeof fechaQuerySchema>;
export type EstadoVisitaInput = z.infer<typeof estadoVisitaSchema>;
export type FinalizarVisitaInput = z.infer<typeof finalizarVisitaSchema>;
