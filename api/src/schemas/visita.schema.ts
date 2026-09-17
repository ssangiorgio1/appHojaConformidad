import { z } from 'zod';

export const tareaIdParamSchema = z.object({
  tareaOdooId: z.coerce.number().int().positive(),
});

export const estadoVisitaSchema = z.object({
  // 'completo' no se acepta acá a propósito — ese estado lo dispara
  // patchConformidad server-side cuando se firma el POST, nunca un PATCH
  // directo del técnico.
  estado: z.enum(['en_camino', 'en_sitio']),
});

export type TareaIdParam = z.infer<typeof tareaIdParamSchema>;
export type EstadoVisitaInput = z.infer<typeof estadoVisitaSchema>;
