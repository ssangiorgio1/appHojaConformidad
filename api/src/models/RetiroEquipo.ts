import { Schema, model, type InferSchemaType } from 'mongoose';

// Acta de retiro o entrega de equipo (5º tipo de servicio): el cliente desinstaló el equipo por su cuenta y se lo
// entrega al técnico o lo deja para retirar. No se interviene la unidad, así que no hay PRE, paso intermedio ni POST
// y por eso no vive en Conformidad. Ver docs-retiro-entrega-equipo.md.
const FirmaRetiroSchema = new Schema(
  {
    // Sin url cuando no hubo quien firmara (entonces va `motivo`).
    url: { type: String },
    key: { type: String },
    firmedAt: { type: Date },
    nombreFirmante: { type: String, default: '' },
    motivo: { type: String, default: '' },
  },
  { _id: false },
);

const AdicionalSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true },
    recibido: { type: Boolean, required: true },
  },
  { _id: false },
);

const RetiroEquipoSchema = new Schema(
  {
    // uuid generado en el dispositivo: el envío sin señal es idempotente (mismo criterio que SubtareaIncidencia).
    clientId: { type: String, index: { unique: true, sparse: true } },
    tareaOdooId: { type: Number, required: true, index: true },
    // Unidad (subtarea) cuando la tarea es un lote; null en una tarea suelta.
    subtareaOdooId: { type: Number, default: null, index: true },
    mergedTaskIds: { type: [Number], default: undefined },
    subtareaNombre: { type: String, default: '' },
    ticketOdooId: { type: Number, default: null },
    clienteNombre: { type: String, default: '' },
    tecnicoId: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
    // Día de la visita (YYYY-MM-DD).
    fecha: { type: String, required: true, index: true },
    // 'entrega': el cliente se lo da en mano al técnico. 'deja_para_retirar': queda en un lugar o con una persona.
    modalidad: { type: String, enum: ['entrega', 'deja_para_retirar'], required: true },
    equipo: {
      numero: { type: String, default: '' },
      imei: { type: String, default: '' },
      estado: { type: String, enum: ['', 'completo', 'danado', 'incompleto'], default: '' },
    },
    adicionales: { type: [AdicionalSchema], default: [] },
    // Quién entrega el equipo o con quién/dónde queda.
    entrega: {
      nombre: { type: String, default: '' },
      telefono: { type: String, default: '' },
      lugar: { type: String, default: '' },
    },
    observaciones: { type: String, default: '' },
    firma: { type: FirmaRetiroSchema, default: null },
    // Resultado del envío del PDF al ticket (best-effort: no bloquea el guardado).
    pdfAt: { type: Date, default: null },
    pdfError: { type: String, default: '' },
  },
  { timestamps: true },
);

export type RetiroEquipo = InferSchemaType<typeof RetiroEquipoSchema>;
export const RetiroEquipoModel = model('RetiroEquipo', RetiroEquipoSchema);
