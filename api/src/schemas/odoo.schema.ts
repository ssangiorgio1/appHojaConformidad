import { z } from 'zod';

export const searchTicketsQuerySchema = z.object({
  q: z.string().min(1),
});

export type SearchTicketsQuery = z.infer<typeof searchTicketsQuerySchema>;
