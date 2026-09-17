import { z } from 'zod';

export const reporteVisitasQuerySchema = z.object({
  tecnicoId: z.string().optional(),
  fechaDesde: z.string().optional(),
  fechaHasta: z.string().optional(),
});

export type ReporteVisitasQuery = z.infer<typeof reporteVisitasQuerySchema>;
