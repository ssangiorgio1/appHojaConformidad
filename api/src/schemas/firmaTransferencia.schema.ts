import { z } from 'zod';

export const createFirmaTransferenciaSchema = z.object({
  transferenciaId: z.string().trim().min(1).max(40),
  tecnicoNombre: z.string().trim().min(1).max(200),
  sentido: z.enum(['a_tecnico', 'a_deposito']),
  lineas: z
    .array(
      z.object({
        nombre: z.string().trim().min(1).max(200),
        cantidad: z.number().int().positive().max(100000),
        series: z.array(z.string().trim().max(60)).max(200).optional(),
      }),
    )
    .min(1)
    .max(100),
});

const PNG_PREFIX = 'data:image/png;base64,';

// Solo PNG en base64 y de tamaño acotado: la firma se vuelve a mostrar en el panel y en la hoja impresa.
export const firmarTransferenciaSchema = z.object({
  firma: z
    .string()
    .max(400_000)
    .refine((v) => v.startsWith(PNG_PREFIX) && /^[A-Za-z0-9+/]+=*$/.test(v.slice(PNG_PREFIX.length)), 'firma must be a PNG data URL')
    // Los bytes 89 50 4E 47... en base64: lo que de verdad empieza como PNG.
    .refine((v) => v.slice(PNG_PREFIX.length).startsWith('iVBORw0KGgo'), 'firma must be a PNG image'),
});

export type CreateFirmaTransferenciaInput = z.infer<typeof createFirmaTransferenciaSchema>;
export type FirmarTransferenciaInput = z.infer<typeof firmarTransferenciaSchema>;
