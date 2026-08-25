import { Schema, model, type InferSchemaType } from 'mongoose';
import { CHECKLIST_KEYS, EQUIP_TEXT_KEYS, EQUIP_CHECK_KEYS } from '@wara/shared';

const checklistFields = Object.fromEntries(
  CHECKLIST_KEYS.map((key) => [key, { type: String, enum: ['SI', 'NO'], default: null }]),
);
const ChecklistSchema = new Schema(checklistFields, { _id: false });

const FotoSchema = new Schema(
  {
    id: { type: String, required: true },
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
  },
  { _id: false },
);

const PhaseSchema = new Schema(
  {
    checklist: { type: ChecklistSchema, default: () => ({}) },
    observaciones: { type: String, default: '' },
    fotos: { type: [FotoSchema], default: [] },
    firma: { type: FirmaSchema, default: null },
  },
  { _id: false },
);

const equipoFields = {
  ...Object.fromEntries(EQUIP_TEXT_KEYS.map((key) => [key, { type: String, default: '' }])),
  ...Object.fromEntries(EQUIP_CHECK_KEYS.map((key) => [key, { type: Boolean, default: false }])),
};
const EquipoSchema = new Schema(equipoFields, { _id: false });

const ConformidadSchema = new Schema(
  {
    clientId: { type: String, required: true, unique: true },
    codigoActa: { type: String, required: true, unique: true },

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
