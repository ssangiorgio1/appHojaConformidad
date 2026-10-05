import { Schema, model, type InferSchemaType } from 'mongoose';

// Rastro de acciones sensibles (cambios de rol/estado de cuentas, reset de
// password, borrado de conformidades). Append-only: nada en la API lo edita
// ni lo borra. `detalle` guarda sólo lo necesario para reconstruir qué pasó,
// nunca secretos (ej. la password temporal NO se registra).
const AuditLogSchema = new Schema(
  {
    accion: { type: String, required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
    actorEmail: { type: String, required: true },
    objetivo: { type: String },
    detalle: { type: Schema.Types.Mixed },
    ip: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type AuditLog = InferSchemaType<typeof AuditLogSchema>;
export const AuditLogModel = model('AuditLog', AuditLogSchema);
