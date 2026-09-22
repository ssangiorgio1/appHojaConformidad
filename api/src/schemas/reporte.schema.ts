import { z } from 'zod';

export const reporteVisitasQuerySchema = z.object({
  tecnicoId: z.string().optional(),
  fechaDesde: z.string().optional(),
  fechaHasta: z.string().optional(),
  // Solo lo usa /reportes/visitas (una fila por viaje, puede haber cientos) —
  // /reportes/tecnicos ignora estos dos, es un resumen acotado a la cantidad
  // de técnicos, no necesita paginar.
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type ReporteVisitasQuery = z.infer<typeof reporteVisitasQuerySchema>;
