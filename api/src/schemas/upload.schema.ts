import { z } from 'zod';

export const presignedUrlSchema = z.object({
  localId: z.string().min(1),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha must be YYYY-MM-DD'),
  fase: z.enum(['pre', 'post']),
  tipo: z.enum(['foto', 'firma', 'pdf']),
  contentType: z.enum(['image/jpeg', 'image/png', 'application/pdf']),
  indice: z.coerce.number().int().min(0).optional(),
});

export type PresignedUrlInput = z.infer<typeof presignedUrlSchema>;
