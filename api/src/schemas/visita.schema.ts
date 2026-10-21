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

// Momento real en que el técnico tocó el botón — solo lo manda la PWA al reproducir una acción que quedó
// encolada sin señal, para que los tiempos de traslado/trabajo no se midan contra la hora en que volvió
// la conexión. notificarEstadoVisita lo valida (rango razonable) y si es inválido usa la hora del servidor.
const ocurrioAtField = z.string().datetime().optional();

export const estadoVisitaSchema = z.object({
  // 'completo' no se acepta acá a propósito — ese estado lo dispara
  // patchConformidad server-side cuando se firma el POST, nunca un PATCH
  // directo del técnico.
  estado: z.enum(['en_camino', 'en_sitio']),
  fecha: fechaField,
  ocurrioAt: ocurrioAtField,
});

export const finalizarVisitaSchema = z.object({
  fecha: fechaField,
  ocurrioAt: ocurrioAtField,
});

// Suspender la visita en curso para atender otra tarea cercana (caso excepcional): el motivo es obligatorio.
export const suspenderVisitaSchema = z.object({
  fecha: fechaField,
  motivo: z.string().trim().min(1, 'El motivo es obligatorio').max(300),
  // Subtareas (unidades) de esta tarea a las que se deja la nota interna de Odoo. Sin ellas (tarea suelta), va en la tarea.
  subtareaOdooIds: z.array(z.number().int().positive()).max(50).optional(),
  ocurrioAt: ocurrioAtField,
});

export const reanudarVisitaSchema = z.object({
  fecha: fechaField,
  ocurrioAt: ocurrioAtField,
});

export type TareaIdParam = z.infer<typeof tareaIdParamSchema>;
export type FechaQuery = z.infer<typeof fechaQuerySchema>;
export type EstadoVisitaInput = z.infer<typeof estadoVisitaSchema>;
export type FinalizarVisitaInput = z.infer<typeof finalizarVisitaSchema>;
export type SuspenderVisitaInput = z.infer<typeof suspenderVisitaSchema>;
export type ReanudarVisitaInput = z.infer<typeof reanudarVisitaSchema>;
