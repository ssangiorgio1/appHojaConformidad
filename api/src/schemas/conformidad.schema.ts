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
  slotKey: z.string().optional(),
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
    nombreFirmante: z.string().optional(),
  })
  .nullable();

const phaseInputSchema = z.object({
  checklist: checklistSchema.optional(),
  fallaDetalle: z.string().optional(),
  item7Detalle: z.string().optional(),
  item8Detalle: z.string().optional(),
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

// Solo se manda una vez, al crear el registro desde la pantalla de Agenda de
// la PWA (tocando "Llegué — Comenzar trabajo" en una tarea) — no hay un caso
// de uso para cambiarla después, a diferencia de ticketOdoo que sí se puede
// re-vincular.
const tareaOdooSchema = z
  .object({
    id: z.number().int().positive(),
    nombre: z.string().optional(),
  })
  .nullable();

// Igual que tareaOdoo, pero para la subtarea/unidad puntual dentro de un lote
// (ver ALCANCE_BACKOFFICE.md §14) — también se manda una sola vez, al crear.
const subtareaOdooSchema = z
  .object({
    id: z.number().int().positive(),
    nombre: z.string().optional(),
  })
  .nullable();

// Mismo motivo que foto/firma de arriba: sin este refine, un técnico podía
// PATCHear su propia hoja con pdfReporte.url apuntando a una URL interna
// arbitraria y después disparar /odoo-sync, que hace fetch() server-side de
// esa URL y sube el resultado como adjunto a un ticket — un SSRF real.
const pdfReporteSchema = z
  .object({
    url: z.string().min(1).refine(isR2Url, 'url must point to the R2 public bucket'),
    key: z.string().min(1),
  })
  .nullable();

const equipoShape = {
  ...Object.fromEntries(EQUIP_TEXT_KEYS.map((key) => [key, z.string().optional()])),
  ...Object.fromEntries(EQUIP_CHECK_KEYS.map((key) => [key, z.enum(['SI', 'NO']).nullable().optional()])),
};
const equipoSchema = z.object(equipoShape).partial();

const fechaField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha must be YYYY-MM-DD');

const tipoServicioSchema = z.enum(['instalacion', 'desinstalacion', 'reparacion', 'cambio_equipo']).nullable();

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
    tareaOdoo: tareaOdooSchema.optional(),
    subtareaOdoo: subtareaOdooSchema.optional(),
    tipoServicio: tipoServicioSchema.optional(),
  });

export const patchConformidadSchema = topLevelSchema.partial().extend({
  pre: phaseInputSchema.optional(),
  post: phaseInputSchema.optional(),
  equipo: equipoSchema.optional(),
  ticketOdoo: ticketOdooSchema.optional(),
  tipoServicio: tipoServicioSchema.optional(),
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
  altaMesaAyuda: z.enum(['pendiente', 'hecho']).optional(),
  altaCoordinacion: z.enum(['pendiente', 'hecho']).optional(),
});

export const altaConformidadSchema = z.object({
  area: z.enum(['mesaAyuda', 'coordinacion']),
  checked: z.boolean(),
});

export type CreateConformidadInput = z.infer<typeof createConformidadSchema>;
export type PatchConformidadInput = z.infer<typeof patchConformidadSchema>;
export type ListConformidadesQuery = z.infer<typeof listConformidadesQuerySchema>;
export type AltaConformidadInput = z.infer<typeof altaConformidadSchema>;
