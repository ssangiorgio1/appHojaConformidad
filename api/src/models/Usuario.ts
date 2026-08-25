import { Schema, model, type InferSchemaType } from 'mongoose';

const usuarioSchema = new Schema(
  {
    firebaseUid: { type: String, unique: true, sparse: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    nombre: { type: String, default: '' },
    role: { type: String, enum: ['tecnico', 'admin', 'superadmin'], default: 'tecnico' },
    legajo: { type: String, default: '' },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export type Usuario = InferSchemaType<typeof usuarioSchema>;
export const UsuarioModel = model('Usuario', usuarioSchema);
