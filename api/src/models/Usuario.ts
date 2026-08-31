import { Schema, model, type InferSchemaType } from 'mongoose';

const usuarioSchema = new Schema(
  {
    firebaseUid: { type: String, unique: true, sparse: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    nombre: { type: String, default: '' },
    role: {
      type: String,
      enum: ['tecnico', 'admin', 'superadmin', 'coordinacion', 'mesa_ayuda'],
      default: 'tecnico',
    },
    legajo: { type: String, default: '' },
    activo: { type: Boolean, default: true },
    // Técnico's personal Odoo account, linked from the profile screen so the
    // hoja de conformidad PDF can be posted to a ticket as them instead of
    // the shared service account. passwordEnc is AES-256-GCM (see
    // utils/secretBox.ts) — never sent to the client.
    odoo: {
      type: {
        login: { type: String, required: true },
        passwordEnc: { type: String, required: true },
        displayName: { type: String, required: true },
        linkedAt: { type: Date, required: true },
      },
      default: undefined,
    },
  },
  { timestamps: true },
);

export type Usuario = InferSchemaType<typeof usuarioSchema>;
export const UsuarioModel = model('Usuario', usuarioSchema);
