import { Schema, model, type InferSchemaType } from 'mongoose';
import { CHECKLIST_KEYS, EQUIP_TEXT_KEYS, EQUIP_CHECK_KEYS } from '@wara/shared';

const checklistFields = Object.fromEntries(
  CHECKLIST_KEYS.map((key) => [key, { type: String, enum: ['SI', 'NO'], default: null }]),
);
const ChecklistSchema = new Schema(checklistFields, { _id: false });

const FotoSchema = new Schema(
  {
    id: { type: String, required: true },
    // De qué slot de captura guiada vino (ver @wara/shared's photoSlots.ts) —
    // ausente en fotos sincronizadas antes de que este campo existiera.
    slotKey: { type: String },
    // Ausentes cuando `motivo` está seteado (el técnico no pudo sacar esta
    // foto — ver GalleryPhotoCapture en la PWA): no hay nada subido a R2.
    url: { type: String },
    key: { type: String },
    motivo: { type: String },
    // Ausente = 'image/jpeg' (fotos existentes). 'video/webm' es un video
    // corto de verificación (Pantalla N° de serie / Cámaras ADAS).
    mimeType: { type: String, enum: ['image/jpeg', 'image/png', 'video/webm'] },
  },
  { _id: false, timestamps: { createdAt: true, updatedAt: false } },
);

const FirmaSchema = new Schema(
  {
    url: { type: String },
    key: { type: String },
    firmedAt: { type: Date },
    satisfaccion: { type: String, enum: ['satisfecho', 'insatisfecho', 'no_firma_insatisfecho'], default: null },
    motivo: { type: String },
    nombreFirmante: { type: String },
    clienteAusente: { type: Boolean, default: false },
  },
  { _id: false },
);

const PhaseSchema = new Schema(
  {
    checklist: { type: ChecklistSchema, default: () => ({}) },
    fallaDetalle: { type: String, default: '' },
    item6AirbagDetalle: { type: String, default: '' },
    item6GuineDetalle: { type: String, default: '' },
    item6AlternadorDetalle: { type: String, default: '' },
    item6PresionDetalle: { type: String, default: '' },
    item6TempDetalle: { type: String, default: '' },
    item7Detalle: { type: String, default: '' },
    item8Detalle: { type: String, default: '' },
    observaciones: { type: String, default: '' },
    fotos: { type: [FotoSchema], default: [] },
    firma: { type: FirmaSchema, default: null },
  },
  { _id: false },
);

const AltaCheckSchema = new Schema(
  {
    checked: { type: Boolean, default: false },
    usuarioId: { type: Schema.Types.ObjectId, ref: 'Usuario', default: null },
    fecha: { type: Date, default: null },
  },
  { _id: false },
);

const AltaEquipoSchema = new Schema(
  {
    mesaAyuda: { type: AltaCheckSchema, default: () => ({}) },
    coordinacion: { type: AltaCheckSchema, default: () => ({}) },
  },
  { _id: false },
);

const equipoFields = {
  ...Object.fromEntries(EQUIP_TEXT_KEYS.map((key) => [key, { type: String, default: '' }])),
  ...Object.fromEntries(EQUIP_CHECK_KEYS.map((key) => [key, { type: String, enum: ['SI', 'NO'], default: null }])),
  // No es parte de EQUIP_TEXT_KEYS (no viene de EQUIP_GROUPS) — ver
  // Equipo.equipoRetiradoSinSerie en @wara/shared/equipo.ts.
  equipoRetiradoSinSerie: { type: String, default: '' },
};
const EquipoSchema = new Schema(equipoFields, { _id: false });

const TicketOdooSchema = new Schema(
  {
    numero: { type: String, required: true },
    odooId: { type: Number, default: null },
    clienteOdoo: { type: String, default: '' },
    verified: { type: Boolean, default: false },
  },
  { _id: false },
);

// La tarea de FSM (project.task) de la que nace esta visita cuando se creó
// desde /agenda — distinta de TicketOdooSchema (helpdesk.ticket, usado para
// postear el PDF): no todas las tareas tienen un ticket vinculado, así que
// no se puede reusar un solo campo para las dos cosas. Es el id que dispara
// el aviso de "trabajo finalizado" por Telegram — ver notificarEstadoVisita.
const TareaOdooSchema = new Schema(
  {
    id: { type: Number, required: true },
    nombre: { type: String, default: '' },
  },
  { _id: false },
);

// La subtarea (unidad puntual, ej. una patente dentro de un lote de "instalar
// N unidades") de la que nace esta hoja — ver ALCANCE_BACKOFFICE.md §14.
// Deliberadamente separada de TareaOdooSchema, que sigue apuntando siempre a
// la tarea padre: VisitaNotificacion/Telegram (notificarEstadoVisita) siguen
// atados al lote completo, no a la unidad individual — no tocar tareaOdoo acá.
const SubtareaOdooSchema = new Schema(
  {
    id: { type: Number, required: true },
    nombre: { type: String, default: '' },
    // Ver conformidad.schema.ts — otras project.task reales colapsadas en
    // esta misma unidad (§15.9b), a cerrar junto con `id` en Odoo.
    mergedTaskIds: { type: [Number], default: undefined },
  },
  { _id: false },
);

const OdooSyncSchema = new Schema(
  {
    status: { type: String, enum: ['PENDING', 'SYNCED', 'FAILED'], default: 'PENDING' },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: '' },
    syncedAt: { type: Date },
    // Cuándo fue el último intento (éxito o falla) — usado para no reintentar
    // un envío a Odoo que falló hace segundos en cada auto-retry del cliente.
    lastAttemptAt: { type: Date },
  },
  { _id: false },
);

const PdfReporteSchema = new Schema(
  {
    url: { type: String, required: true },
    key: { type: String, required: true },
  },
  { _id: false },
);

// Solo se completa cuando tipoServicio === 'cambio_equipo' Y la hoja usa el
// esquema nuevo de 2 hojas vinculadas (retiro + instalación, cada una con su
// propio checklist/fotos/firma) — las hojas cambio_equipo históricas (1 sola
// hoja con equipo.modeloInstalado/imeiInstalado) no tienen esto seteado y
// siguen funcionando como antes, ver conformidades.controller.ts. `parejaId`
// se escribe cruzado en ambos documentos al vincularlos (linkCambioEquipoPareja)
// — no hay backref automático de Mongoose, es responsabilidad del controller
// mantener los dos lados en sync.
const CambioEquipoSchema = new Schema(
  {
    rol: { type: String, enum: ['retiro', 'instalacion'], default: null },
    parejaId: { type: Schema.Types.ObjectId, ref: 'Conformidad', default: null },
  },
  { _id: false },
);

const ConformidadSchema = new Schema(
  {
    clientId: { type: String, required: true, unique: true },
    codigoActa: { type: String, required: true, unique: true },

    tipoServicio: {
      type: String,
      enum: ['instalacion', 'desinstalacion', 'reparacion', 'cambio_equipo'],
      default: null,
    },

    numero: { type: String, default: '', index: true },
    cliente: { type: String, default: '' },
    fecha: { type: String, required: true },
    hora: { type: String, default: '' },
    fechaHora: { type: Date, index: true },

    matricula: { type: String, default: '', uppercase: true, trim: true, index: true },
    instalador: { type: String, default: '' },
    tecnicoId: { type: Schema.Types.ObjectId, ref: 'Usuario', index: true },
    // Se completa solo cuando un técnico distinto a tecnicoId cierra el POST
    // de una hoja cambio_equipo que le quedó asignada por subtarea de Odoo
    // (ver isAssignedToPendingSwap) — no reemplaza a tecnicoId, es auditoría.
    tecnicoIdPost: { type: Schema.Types.ObjectId, ref: 'Usuario', default: null },
    responsableEmpresa: { type: String, default: '' },

    status: {
      type: String,
      enum: ['borrador_pre', 'pendiente_post', 'completo'],
      default: 'borrador_pre',
      index: true,
    },
    origen: { type: String, default: 'mobile' },

    pre: { type: PhaseSchema, default: () => ({}) },
    post: { type: PhaseSchema, default: () => ({}) },
    equipo: { type: EquipoSchema, default: () => ({}) },
    altaEquipo: { type: AltaEquipoSchema, default: () => ({}) },

    ticketOdoo: { type: TicketOdooSchema, default: null },
    tareaOdoo: { type: TareaOdooSchema, default: null },
    subtareaOdoo: { type: SubtareaOdooSchema, default: null },
    odooSync: { type: OdooSyncSchema, default: () => ({}) },
    pdfReporte: { type: PdfReporteSchema, default: null },
    cambioEquipo: { type: CambioEquipoSchema, default: () => ({}) },

    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

ConformidadSchema.index({ status: 1, fechaHora: -1 });
ConformidadSchema.index({ 'equipo.imei': 1 }, { sparse: true });
// Búsqueda de hojas de cambio_equipo pendientes de emparejar por patente (ver
// GET /conformidades/cambio-equipo/retiros-pendientes) — sirve para buscar
// tanto retiros como instalaciones pendientes (rol es parte del filtro real).
ConformidadSchema.index({ matricula: 1, 'cambioEquipo.rol': 1, 'cambioEquipo.parejaId': 1 });

ConformidadSchema.pre('save', function () {
  if (this.fecha) {
    const iso = this.hora ? `${this.fecha}T${this.hora}:00` : `${this.fecha}T00:00:00`;
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime())) this.fechaHora = parsed;
  }
});

export type Conformidad = InferSchemaType<typeof ConformidadSchema>;
export const ConformidadModel = model('Conformidad', ConformidadSchema);
