import { z } from 'zod';

export const listCalendarTasksQuerySchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  // Lista de ids separados por coma (ej. "39,64,83") — un solo query param
  // en vez de technicianId repetido, para no depender de cómo Express
  // parsea arrays en la query string.
  technicianIds: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(',')
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isInteger(n) && n > 0)
        : undefined,
    ),
});

export type ListCalendarTasksQuery = z.infer<typeof listCalendarTasksQuerySchema>;

export const moveCalendarTaskSchema = z
  .object({
    start: z.string().min(1),
    end: z.string().min(1),
  })
  .refine((d) => d.end > d.start, { message: 'end debe ser posterior a start', path: ['end'] });

export type MoveCalendarTaskInput = z.infer<typeof moveCalendarTaskSchema>;

export const taskIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const taskNotesQuerySchema = z.object({
  // El id del ticket de Odoo ya lo tiene el cliente (viene en la misma
  // CalendarTask que pide las notas) — evita que el server tenga que leer
  // de nuevo la tarea a Odoo solo para resolver helpdesk_ticket_id.
  ticketId: z.coerce.number().int().positive().optional(),
});

export type TaskNotesQuery = z.infer<typeof taskNotesQuerySchema>;
