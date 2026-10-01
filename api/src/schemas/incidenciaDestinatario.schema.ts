import { z } from 'zod';

export const createIncidenciaDestinatarioSchema = z.object({
  odooUserId: z.number().int().positive(),
  nombre: z.string().trim().min(1).max(120),
});
export type CreateIncidenciaDestinatarioInput = z.infer<typeof createIncidenciaDestinatarioSchema>;

export const searchOdooUsersQuerySchema = z.object({
  q: z.string().trim().min(2).max(60),
});
export type SearchOdooUsersQuery = z.infer<typeof searchOdooUsersQuerySchema>;
