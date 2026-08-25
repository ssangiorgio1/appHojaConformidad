import { z } from 'zod';

export const updateRoleSchema = z.object({
  role: z.enum(['tecnico', 'admin', 'superadmin']).optional(),
  activo: z.boolean().optional(),
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
