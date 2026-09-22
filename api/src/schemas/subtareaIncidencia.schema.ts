import { z } from 'zod';

const fechaField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha must be YYYY-MM-DD');

export const createSubtareaIncidenciaSchema = z.object({
  tareaOdooId: z.number().int().positive(),
  subtareaOdooId: z.number().int().positive(),
  subtareaNombre: z.string().optional(),
  fecha: fechaField,
  motivo: z.string().trim().min(1, 'El motivo es obligatorio').max(500),
});
export type CreateSubtareaIncidenciaInput = z.infer<typeof createSubtareaIncidenciaSchema>;

export const listSubtareaIncidenciasQuerySchema = z.object({
  estado: z.enum(['pendiente_reprogramar', 'reprogramada']).optional(),
  fecha: fechaField.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListSubtareaIncidenciasQuery = z.infer<typeof listSubtareaIncidenciasQuerySchema>;

export const resolveSubtareaIncidenciaSchema = z.object({
  estado: z.literal('reprogramada'),
});
export type ResolveSubtareaIncidenciaInput = z.infer<typeof resolveSubtareaIncidenciaSchema>;
