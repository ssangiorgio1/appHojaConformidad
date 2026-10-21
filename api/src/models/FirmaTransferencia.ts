import { Schema, model, type InferSchemaType } from 'mongoose';

// Pedido de firma de una hoja de ruta del depósito: el panel genera un link/QR, el técnico firma desde su celular y
// la firma vuelve al panel. Guarda una copia de lo que se firma (la transferencia todavía vive en el panel).
const LineaSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true },
    cantidad: { type: Number, required: true },
    series: { type: [String], default: [] },
  },
  { _id: false },
);

const FirmaTransferenciaSchema = new Schema(
  {
    // Secreto del link: quien lo tiene puede firmar una vez, nada más. No se reutiliza entre transferencias.
    token: { type: String, required: true, unique: true },
    transferenciaId: { type: String, required: true, index: true },
    tecnicoNombre: { type: String, required: true, trim: true },
    sentido: { type: String, enum: ['a_tecnico', 'a_deposito'], required: true },
    lineas: { type: [LineaSchema], default: [] },
    creadaPor: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
    // PNG en data URL. Mientras es null el link sigue pendiente.
    firma: { type: String, default: null },
    firmedAt: { type: Date, default: null },
    // Mongo borra el pedido solo al vencer (TTL).
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true },
);

export type FirmaTransferencia = InferSchemaType<typeof FirmaTransferenciaSchema>;
export const FirmaTransferenciaModel = model('FirmaTransferencia', FirmaTransferenciaSchema);
