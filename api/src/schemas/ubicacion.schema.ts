import { z } from 'zod';

export const resolverUbicacionQuerySchema = z.object({
  texto: z.string().trim().min(1, 'Falta la ubicación').max(500),
});
