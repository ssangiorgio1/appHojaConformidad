import { z } from 'zod';
import { env } from '../config/env.js';

const fechaField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha must be YYYY-MM-DD');

// Mismo criterio que conformidad.schema.ts: la firma solo puede apuntar al bucket público de R2 (el PDF se renderiza
// en Chromium del servidor, que pediría cualquier URL que venga en un <img>).
const R2_PUBLIC_BASE = env.R2_PUBLIC_BASE_URL.replace(/\/+$/, '');
const isR2Url = (url: string) => url.startsWith(`${R2_PUBLIC_BASE}/`);

const firmaSchema = z
  .object({
    url: z.string().min(1).refine(isR2Url, 'url must point to the R2 public bucket').optional(),
    key: z.string().min(1).optional(),
    firmedAt: z.coerce.date().optional(),
    nombreFirmante: z.string().trim().max(200).optional(),
    // Obligatorio si no hay firma: "Sin persona para firmar" + el porqué.
    motivo: z.string().trim().max(500).optional(),
  })
  .refine((f) => !!f.url || !!f.motivo, { message: 'Sin firma hace falta el motivo', path: ['motivo'] });

export const createRetiroEquipoSchema = z
  .object({
    clientId: z.string().min(8).max(64).optional(),
    tareaOdooId: z.number().int().positive(),
    subtareaOdooId: z.number().int().positive().optional(),
    subtareaNombre: z.string().trim().max(200).optional(),
    mergedTaskIds: z.array(z.number().int().positive()).optional(),
    ticketOdooId: z.number().int().positive().optional(),
    clienteNombre: z.string().trim().max(200).optional(),
    fecha: fechaField,
    modalidad: z.enum(['entrega', 'deja_para_retirar']),
    equipo: z
      .object({
        numero: z.string().trim().max(60).optional(),
        imei: z.string().trim().max(30).optional(),
        estado: z.enum(['completo', 'danado', 'incompleto']).optional(),
      })
      .optional(),
    equiposExtra: z
      .array(z.object({ numero: z.string().trim().max(60).optional(), imei: z.string().trim().max(30).optional() }))
      .max(10)
      .optional(),
    adicionales: z.array(z.object({ nombre: z.string().trim().min(1).max(100), recibido: z.boolean() })).max(30).optional(),
    entrega: z
      .object({
        nombre: z.string().trim().max(200).optional(),
        telefono: z.string().trim().max(40).optional(),
        lugar: z.string().trim().max(300).optional(),
      })
      .optional(),
    observaciones: z.string().trim().max(1000).optional(),
    firma: firmaSchema.nullable().optional(),
    // Fotos del equipo / sensor (mismo criterio que la firma: solo URLs del bucket público de R2).
    fotos: z
      .array(z.object({ url: z.string().min(1).refine(isR2Url, 'url must point to the R2 public bucket'), key: z.string().min(1).optional() }))
      .max(8)
      .optional(),
    // Momento real del toque cuando se envía sin señal (ISO).
    ocurrioAt: z.string().datetime().optional(),
  })
  // Dejar el equipo para retirar exige decir dónde o con quién queda; si no, no hay cómo ubicarlo después.
  .refine((d) => d.modalidad !== 'deja_para_retirar' || !!(d.entrega?.lugar || d.entrega?.nombre), {
    message: 'Indicá dónde o con quién queda el equipo',
    path: ['entrega'],
  });
export type CreateRetiroEquipoInput = z.infer<typeof createRetiroEquipoSchema>;

export const listRetirosEquipoQuerySchema = z.object({
  fecha: fechaField.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListRetirosEquipoQuery = z.infer<typeof listRetirosEquipoQuerySchema>;
