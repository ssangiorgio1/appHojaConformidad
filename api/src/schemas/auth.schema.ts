import { z } from 'zod';

export const updateUsuarioSchema = z.object({
  nombre: z.string().trim().min(1).max(120).optional(),
  legajo: z.string().trim().max(60).optional(),
  role: z.enum(['tecnico', 'admin', 'superadmin', 'coordinacion', 'mesa_ayuda']).optional(),
  activo: z.boolean().optional(),
});

export type UpdateUsuarioInput = z.infer<typeof updateUsuarioSchema>;

export const updateMeSchema = z.object({
  nombre: z.string().trim().min(1).max(120).optional(),
  legajo: z.string().trim().max(60).optional(),
});

export type UpdateMeInput = z.infer<typeof updateMeSchema>;

export const createUsuarioSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  nombre: z.string().trim().min(1).max(120),
  legajo: z.string().trim().max(60).optional(),
  role: z.enum(['tecnico', 'admin', 'superadmin', 'coordinacion', 'mesa_ayuda']).default('tecnico'),
  activo: z.boolean().default(true),
});

export type CreateUsuarioInput = z.infer<typeof createUsuarioSchema>;
