import { z } from 'zod';

const fechaField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha must be YYYY-MM-DD');

export const createSubtareaIncidenciaSchema = z
  .object({
  tipo: z.enum(['no_encontrada', 'pre_cancelado', 'reprogramado_cliente']).default('no_encontrada'),
  // Firma (en cualquier tipo; obligatoria solo en 'reprogramado_cliente') del cliente (PNG en data URI, la sube la API a R2) con nombre y DNI de quien
  // firmó, o `sinFirma` con el motivo cuando no había quien firmara. Una de las dos es obligatoria.
  firma: z
    .object({
      png: z
        .string()
        .startsWith('data:image/png;base64,')
        .max(400_000)
        .refine((v) => Buffer.from(v.slice('data:image/png;base64,'.length), 'base64').subarray(0, 8).toString('hex') === '89504e470d0a1a0a', {
          message: 'La firma no es un PNG válido',
        }),
      nombre: z.string().trim().min(1).max(120),
      dni: z.string().trim().max(20).default(''),
    })
    .optional(),
  sinFirma: z.object({ motivo: z.string().trim().min(1, 'El motivo es obligatorio').max(300) }).optional(),
  // Hora agendada de la visita (ISO). Con ella la API compara la llegada del técnico y sugiere si fue visita
  // fallida o llegada tarde (ver clasificarIncidencia.ts).
  horaAgendada: z.string().datetime().optional(),
  // Fin del rango horario de la tarea: si el técnico llegó después, la visita es en parte culpa de WARA (sin cargo).
  horaFinAgendada: z.string().datetime().optional(),
  // Propuesta de reprogramación para esta unidad (ISO). Opcional: sin ella la incidencia queda
  // pendiente_reprogramar como siempre; con ella queda propuesta_pendiente.
  propuestaInicio: z.string().datetime().optional(),
  propuestaFin: z.string().datetime().optional(),
  tareaOdooId: z.number().int().positive(),
  subtareaOdooId: z.number().int().positive(),
  subtareaNombre: z.string().optional(),
  // Ticket de Odoo y cliente, para el PDF de reprogramación que se adjunta al ticket.
  ticketOdooId: z.number().int().positive().optional(),
  clienteNombre: z.string().trim().max(200).optional(),
  // Ver conformidad.schema.ts / ALCANCE_BACKOFFICE.md §15.9b — otras
  // project.task reales colapsadas en esta misma unidad, a marcar "En
  // espera" junto con subtareaOdooId.
  mergedTaskIds: z.array(z.number().int().positive()).optional(),
  fecha: fechaField,
  motivo: z.string().trim().min(1, 'El motivo es obligatorio').max(500),
  // Reporte hecho sin señal y enviado después: clientId (uuid del dispositivo) hace el POST idempotente — un
  // reintento tras un timeout no crea otra incidencia (ni repite el aviso a Odoo) — y ocurrioAt es el momento
  // real del toque (ISO).
  clientId: z.string().min(8).max(64).optional(),
  ocurrioAt: z.string().datetime().optional(),
  })
  .refine((d) => d.tipo !== 'reprogramado_cliente' || (!!d.propuestaInicio && !!d.propuestaFin), {
    message: 'La reprogramación a pedido del cliente lleva la fecha y hora que eligió',
    path: ['propuestaInicio'],
  })
  .refine((d) => d.tipo !== 'reprogramado_cliente' || !!d.firma !== !!d.sinFirma, {
    message: 'Firma del cliente o "no hay quien firme" con motivo (una sola)',
    path: ['firma'],
  })
  .refine((d) => !(d.firma && d.sinFirma), { message: 'Firma del cliente o "cliente ausente" con motivo (una sola)', path: ['firma'] })
  .refine((d) => !d.propuestaInicio === !d.propuestaFin, { message: 'propuestaInicio y propuestaFin van juntos', path: ['propuestaFin'] })
  .refine((d) => !d.propuestaInicio || !d.propuestaFin || d.propuestaFin > d.propuestaInicio, {
    message: 'propuestaFin debe ser posterior a propuestaInicio',
    path: ['propuestaFin'],
  });
export type CreateSubtareaIncidenciaInput = z.infer<typeof createSubtareaIncidenciaSchema>;

export const listSubtareaIncidenciasQuerySchema = z.object({
  // Uno o varios estados separados por coma (ej. "pendiente_reprogramar,rechazada").
  estado: z
    .string()
    .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean))
    .pipe(z.array(z.enum(['pendiente_reprogramar', 'propuesta_pendiente', 'rechazada', 'reprogramada'])).min(1))
    .optional(),
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
    // 'rechazada' solo vale para una propuesta del técnico (ver resolveSubtareaIncidencia) y exige motivo.
    // 'reprogramada' sobre una propuesta sin start/end acepta la hora propuesta; con start/end la cambia.
    estado: z.enum(['reprogramada', 'rechazada']),
    // Coordinación corrige el tipo sugerido antes de que salga el PDF (visita fallida vs. llegada tarde).
    tipo: z.enum(['no_encontrada', 'llegada_tarde']).optional(),
    start: z.string().min(1).optional(),
    end: z.string().min(1).optional(),
    technicianId: z.number().int().positive().optional(),
    motivoRechazo: z.string().trim().max(500).optional(),
  })
  .refine((d) => !d.start === !d.end, { message: 'start y end van juntos', path: ['end'] })
  .refine((d) => !d.start || !d.end || d.end > d.start, { message: 'end debe ser posterior a start', path: ['end'] })
  .refine((d) => d.estado !== 'rechazada' || !!d.motivoRechazo, { message: 'El motivo del rechazo es obligatorio', path: ['motivoRechazo'] })
  .refine((d) => d.estado !== 'rechazada' || !d.start, { message: 'Un rechazo no lleva fecha nueva', path: ['start'] });
export type ResolveSubtareaIncidenciaInput = z.infer<typeof resolveSubtareaIncidenciaSchema>;
