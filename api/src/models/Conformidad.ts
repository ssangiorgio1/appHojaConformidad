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
    url: { type: String, required: true },
    key: { type: String, required: true },
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
  },
  { _id: false },
);

const PhaseSchema = new Schema(
  {
    checklist: { type: ChecklistSchema, default: () => ({}) },
    fallaDetalle: { type: String, default: '' },
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
    odooSync: { type: OdooSyncSchema, default: () => ({}) },
    pdfReporte: { type: PdfReporteSchema, default: null },

    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

ConformidadSchema.index({ status: 1, fechaHora: -1 });
ConformidadSchema.index({ 'equipo.imei': 1 }, { sparse: true });

ConformidadSchema.pre('save', function () {
  if (this.fecha) {
    const iso = this.hora ? `${this.fecha}T${this.hora}:00` : `${this.fecha}T00:00:00`;
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime())) this.fechaHora = parsed;
  }
});

export type Conformidad = InferSchemaType<typeof ConformidadSchema>;
export const ConformidadModel = model('Conformidad', ConformidadSchema);
