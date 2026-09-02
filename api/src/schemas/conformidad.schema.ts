import { z } from 'zod';
import { CHECKLIST_KEYS, EQUIP_TEXT_KEYS, EQUIP_CHECK_KEYS } from '@wara/shared';
import { env } from '../config/env.js';

const checklistShape = Object.fromEntries(
  CHECKLIST_KEYS.map((key) => [key, z.enum(['SI', 'NO']).nullable().optional()]),
);
const checklistSchema = z.object(checklistShape).partial();

// foto/firma urls are only ever produced by r2.service.ts's publicUrlFor(),
// always under this exact prefix — anything else would mean the client is
// pointing our Puppeteer-rendered PDF (see @wara/shared's printHtml.ts) at an
// arbitrary URL, which is an SSRF vector since Chromium will actually fetch
// whatever a <img src> says server-side. Reject it at the door instead of
// trusting the HTML template's escaping to be the only layer of defense.
const R2_PUBLIC_BASE = env.R2_PUBLIC_BASE_URL.replace(/\/+$/, '');
const isR2Url = (url: string) => url.startsWith(`${R2_PUBLIC_BASE}/`);

const fotoSchema = z.object({
  id: z.string().min(1),
  url: z.string().min(1).refine(isR2Url, 'url must point to the R2 public bucket'),
  key: z.string().min(1),
});

const firmaSchema = z
  .object({
    url: z.string().min(1).refine(isR2Url, 'url must point to the R2 public bucket').optional(),
    key: z.string().min(1).optional(),
    firmedAt: z.coerce.date().optional(),
    satisfaccion: z.enum(['satisfecho', 'insatisfecho', 'no_firma_insatisfecho']).nullable().optional(),
    motivo: z.string().optional(),
  })
  .nullable();

const phaseInputSchema = z.object({
  checklist: checklistSchema.optional(),
  observaciones: z.string().optional(),
  fotos: z.array(fotoSchema).optional(),
  firma: firmaSchema.optional(),
});

const ticketOdooSchema = z
  .object({
    numero: z.string().min(1),
    odooId: z.number().int().positive().optional(),
    clienteOdoo: z.string().optional(),
    verified: z.boolean().optional(),
  })
  .nullable();

const pdfReporteSchema = z
  .object({
    url: z.string().min(1),
    key: z.string().min(1),
  })
  .nullable();

const equipoShape = {
  ...Object.fromEntries(EQUIP_TEXT_KEYS.map((key) => [key, z.string().optional()])),
  ...Object.fromEntries(EQUIP_CHECK_KEYS.map((key) => [key, z.enum(['SI', 'NO']).nullable().optional()])),
};
const equipoSchema = z.object(equipoShape).partial();

const fechaField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha must be YYYY-MM-DD');

const topLevelSchema = z.object({
  numero: z.string(),
  cliente: z.string(),
  fecha: fechaField,
  hora: z.string(),
  matricula: z.string(),
  instalador: z.string(),
  responsableEmpresa: z.string(),
});

export const createConformidadSchema = topLevelSchema
  .partial({
    numero: true,
    cliente: true,
    hora: true,
    matricula: true,
    instalador: true,
    responsableEmpresa: true,
  })
  .extend({
    clientId: z.string().min(1),
    pre: phaseInputSchema,
    ticketOdoo: ticketOdooSchema.optional(),
  });

export const patchConformidadSchema = topLevelSchema.partial().extend({
  pre: phaseInputSchema.optional(),
  post: phaseInputSchema.optional(),
  equipo: equipoSchema.optional(),
  ticketOdoo: ticketOdooSchema.optional(),
  // odooSync is intentionally NOT accepted here — it's written only by the
  // dedicated /odoo-sync endpoint once Odoo actually confirms success.
  pdfReporte: pdfReporteSchema.optional(),
});

export const listConformidadesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  status: z.enum(['borrador_pre', 'pendiente_post', 'completo']).optional(),
  tecnicoId: z.string().optional(),
  matricula: z.string().max(100).optional(),
  imei: z.string().max(100).optional(),
  numero: z.string().max(100).optional(),
  fechaDesde: z.string().optional(),
  fechaHasta: z.string().optional(),
  search: z.string().max(100).optional(),
});

export type CreateConformidadInput = z.infer<typeof createConformidadSchema>;
export type PatchConformidadInput = z.infer<typeof patchConformidadSchema>;
export type ListConformidadesQuery = z.infer<typeof listConformidadesQuerySchema>;
