import { z } from 'zod';

export const searchTicketsQuerySchema = z.object({
  q: z.string().min(1),
});

export type SearchTicketsQuery = z.infer<typeof searchTicketsQuerySchema>;

export const linkOdooAccountSchema = z.object({
  login: z.string().trim().min(1),
  password: z.string().min(1),
});

export type LinkOdooAccountInput = z.infer<typeof linkOdooAccountSchema>;
