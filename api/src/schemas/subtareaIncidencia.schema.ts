import { z } from 'zod';

const fechaField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha must be YYYY-MM-DD');

export const createSubtareaIncidenciaSchema = z.object({
  tareaOdooId: z.number().int().positive(),
  subtareaOdooId: z.number().int().positive(),
  subtareaNombre: z.string().optional(),
  // Ver conformidad.schema.ts / ALCANCE_BACKOFFICE.md §15.9b — otras
  // project.task reales colapsadas en esta misma unidad, a marcar "En
  // espera" junto con subtareaOdooId.
  mergedTaskIds: z.array(z.number().int().positive()).optional(),
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

// start/end/technicianId opcionales a propósito: sin ellos, el PATCH se
// comporta igual que antes (coordinación que ya reprogramó a mano en Odoo y
// solo quiere tildar el check). Con ellos, el controller además reprograma
// la subtarea en Odoo (ver resolveSubtareaIncidencia) — mismo shape/
// validación que moveCalendarTaskSchema (calendarTask.schema.ts) para la
// fecha, por consistencia.
export const resolveSubtareaIncidenciaSchema = z
  .object({
    estado: z.literal('reprogramada'),
    start: z.string().min(1).optional(),
    end: z.string().min(1).optional(),
    technicianId: z.number().int().positive().optional(),
  })
  .refine((d) => !d.start === !d.end, { message: 'start y end van juntos', path: ['end'] })
  .refine((d) => !d.start || !d.end || d.end > d.start, { message: 'end debe ser posterior a start', path: ['end'] });
export type ResolveSubtareaIncidenciaInput = z.infer<typeof resolveSubtareaIncidenciaSchema>;
