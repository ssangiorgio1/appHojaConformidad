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
  // Absent when `motivo` is set (técnico couldn't take this photo, see
  // GalleryPhotoCapture in the PWA) — nothing was uploaded, same idea as
  // firmaSchema's optional url/key below.
  url: z.string().min(1).refine(isR2Url, 'url must point to the R2 public bucket').optional(),
  key: z.string().min(1).optional(),
  motivo: z.string().optional(),
  descripcion: z.string().max(1000).optional(),
  mimeType: z.enum(['image/jpeg', 'image/png', 'video/webm']).optional(),
});

const firmaSchema = z
  .object({
    url: z.string().min(1).refine(isR2Url, 'url must point to the R2 public bucket').optional(),
    key: z.string().min(1).optional(),
    firmedAt: z.coerce.date().optional(),
    satisfaccion: z.enum(['satisfecho', 'insatisfecho', 'no_firma_insatisfecho']).nullable().optional(),
    motivo: z.string().optional(),
    nombreFirmante: z.string().optional(),
    clienteAusente: z.boolean().optional(),
  })
  .nullable();

const phaseInputSchema = z.object({
  checklist: checklistSchema.optional(),
  fallaDetalle: z.string().optional(),
  item6AirbagDetalle: z.string().optional(),
  item6GuineDetalle: z.string().optional(),
  item6AlternadorDetalle: z.string().optional(),
  item6PresionDetalle: z.string().optional(),
  item6TempDetalle: z.string().optional(),
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
    // Otras project.task reales que se colapsaron en esta unidad — ver
    // ALCANCE_BACKOFFICE.md §15.9b y collapseDuplicateNames en
    // calendarTask.service.ts. Se necesita para poder marcar TODAS como
    // "Hecha"/"En espera" en Odoo, no solo la primaria.
    mergedTaskIds: z.array(z.number().int().positive()).optional(),
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
  // No es parte de EQUIP_TEXT_KEYS (no viene de EQUIP_GROUPS) — ver
  // Equipo.equipoRetiradoSinSerie en @wara/shared/equipo.ts.
  equipoRetiradoSinSerie: z.string().optional(),
  elementosRetirados: z.string().optional(),
};
const equipoSchema = z.object(equipoShape).partial();

const fechaField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha must be YYYY-MM-DD');

const tipoServicioSchema = z.enum(['instalacion', 'desinstalacion', 'reparacion', 'cambio_equipo']).nullable();

// Ver nota en models/Conformidad.ts — solo aplica al esquema nuevo de 2 hojas
// vinculadas para cambio_equipo. `parejaId` es opcional: si el técnico de
// instalación no pudo emparejar en el momento (sin señal, no la encontró),
// queda null y se resuelve después desde el panel web.
const cambioEquipoSchema = z
  .object({
    rol: z.enum(['retiro', 'instalacion']),
    // El modelo (ver CambioEquipoSchema en models/Conformidad.ts) guarda
    // `null` explícito como "todavía sin emparejar" — un técnico de
    // instalación que no pudo vincular en el momento manda cambioEquipo con
    // parejaId: null, no lo omite. Sin `.nullable()` acá, ese caso (legítimo
    // y esperado) tiraba 400 "expected string, received null".
    parejaId: z.string().min(1).nullable().optional(),
  })
  .nullable();

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
    cambioEquipo: cambioEquipoSchema.optional(),
  });

const verificacionEquipoSchema = z.object({
  estado: z.enum(['verificado', 'con_problemas', 'sin_verificar']),
  problemas: z.array(z.string().max(300)).max(20),
  avanzoBajoResponsabilidad: z.boolean(),
  intentos: z.number().int().min(0).max(100).optional(),
  at: z.string().datetime(),
});

// Productos de la orden de venta que no se pudieron instalar o retirar en el lugar: clave de la casilla -> motivo.
const noInstaladosSchema = z
  .record(z.string().min(1).max(60), z.string().trim().min(1).max(300))
  .refine((r) => Object.keys(r).length <= 40, { message: 'Demasiados productos no instalados' });

export const patchConformidadSchema = topLevelSchema.partial().extend({
  noInstalados: noInstaladosSchema.optional(),
  verificacionEquipo: verificacionEquipoSchema.optional(),
  pre: phaseInputSchema.optional(),
  post: phaseInputSchema.optional(),
  equipo: equipoSchema.optional(),
  ticketOdoo: ticketOdooSchema.optional(),
  tipoServicio: tipoServicioSchema.optional(),
  // Hora real de la firma del POST en el dispositivo (ver resolverMomento en telegram.service.ts).
  completadoAt: z.string().datetime().optional(),
  // odooSync is intentionally NOT accepted here — it's written only by the
  // dedicated /odoo-sync endpoint once Odoo actually confirms success.
  pdfReporte: pdfReporteSchema.optional(),
});

// Body del endpoint dedicado de vinculación manual (ver
// linkCambioEquipoPareja en el controller) — deliberadamente separado de
// patchConformidadSchema: vincular es una operación que toca 2 documentos a
// la vez con sus propias reglas de validación (roles opuestos, ninguno ya
// vinculado), no un campo más que se pueda pisar con un PATCH común.
export const cambioEquipoParejaSchema = z.object({
  parejaId: z.string().min(1),
});

export const listConformidadesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  status: z.enum(['borrador_pre', 'pendiente_post', 'completo']).optional(),
  tipoServicio: z.enum(['instalacion', 'desinstalacion', 'reparacion', 'cambio_equipo']).optional(),
  tecnicoId: z.string().optional(),
  matricula: z.string().max(100).optional(),
  imei: z.string().max(100).optional(),
  numero: z.string().max(100).optional(),
  fechaDesde: z.string().optional(),
  fechaHasta: z.string().optional(),
  search: z.string().max(100).optional(),
  altaMesaAyuda: z.enum(['pendiente', 'hecho']).optional(),
  altaCoordinacion: z.enum(['pendiente', 'hecho']).optional(),
  // Hojas cambio_equipo del esquema nuevo (con cambioEquipo.rol seteado) que
  // todavía no tienen su pareja vinculada — para que coordinación las pueda
  // encontrar todas juntas en vez de tener que abrir cada hoja para verlo.
  cambioEquipoPendiente: z.coerce.boolean().optional(),
  // Verificación del equipo en el paso de control: 'bajo_responsabilidad' = el técnico avanzó igual con el
  // equipo sin confirmar (ver verificacionEquipo en el modelo).
  verificacionEquipo: z.enum(['verificado', 'con_problemas', 'sin_verificar', 'bajo_responsabilidad']).optional(),
});

// Query del endpoint acotado de búsqueda de pendientes de emparejar — ver
// GET /conformidades/cambio-equipo/retiros-pendientes en el controller.
// `rol` es el rol que se está BUSCANDO (el opuesto al de la hoja que se
// quiere vincular): la PWA siempre busca 'retiro' (el técnico de instalación
// busca el retiro que hizo otro compañero), pero el panel web necesita poder
// buscar en los dos sentidos para la vinculación manual de respaldo.
export const retirosPendientesQuerySchema = z.object({
  matricula: z.string().min(1).max(100),
  rol: z.enum(['retiro', 'instalacion']).default('retiro'),
});

// Query del endpoint de prellenado de equipo para reparación — ver
// GET /conformidades/equipo-actual en el controller. A diferencia de
// retiros-pendientes (búsqueda parcial, varios resultados a elegir), acá se
// busca por matrícula EXACTA y se devuelve un solo resultado: la última hoja
// 'completo' de esa unidad, que es la que describe el equipo instalado hoy.
export const equipoActualQuerySchema = z.object({
  matricula: z.string().min(1).max(100),
  excludeId: z.string().optional(),
});

// Query del endpoint de handoff cross-técnico — ver GET
// /conformidades/cambio-equipo/por-subtarea y getCambioEquipoPorSubtarea en
// el controller. Se manda uno de los dos ids (nunca ninguno): subtareaOdooId
// cuando la tarea es un lote, tareaOdooId cuando es una tarea suelta.
export const cambioEquipoPorSubtareaQuerySchema = z
  .object({
    subtareaOdooId: z.coerce.number().int().positive().optional(),
    tareaOdooId: z.coerce.number().int().positive().optional(),
  })
  .refine((q) => q.subtareaOdooId !== undefined || q.tareaOdooId !== undefined, {
    message: 'subtareaOdooId or tareaOdooId is required',
  });

export const altaConformidadSchema = z.object({
  area: z.enum(['mesaAyuda', 'coordinacion']),
  checked: z.boolean(),
});

export type CreateConformidadInput = z.infer<typeof createConformidadSchema>;
export type PatchConformidadInput = z.infer<typeof patchConformidadSchema>;
export type ListConformidadesQuery = z.infer<typeof listConformidadesQuerySchema>;
export type AltaConformidadInput = z.infer<typeof altaConformidadSchema>;
export type CambioEquipoParejaInput = z.infer<typeof cambioEquipoParejaSchema>;
export type RetirosPendientesQuery = z.infer<typeof retirosPendientesQuerySchema>;
export type EquipoActualQuery = z.infer<typeof equipoActualQuerySchema>;
export type CambioEquipoPorSubtareaQuery = z.infer<typeof cambioEquipoPorSubtareaQuerySchema>;
