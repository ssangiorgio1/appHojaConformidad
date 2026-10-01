import { Schema, model, type InferSchemaType } from 'mongoose';

// Quién recibe el recordatorio (mail.activity en Odoo, ver
// scheduleSubtareaReprogramarActivity en odoo.service.ts) cuando el técnico
// reporta una unidad "no encontrada en el lugar" — ver
// subtareaIncidencia.controller.ts y ALCANCE_BACKOFFICE.md §14.5. Guardado en
// Mongo (no env) a propósito: el pedido fue poder cambiar esta lista desde el
// panel sin redeploy. Independiente de Usuario: estas personas no necesitan
// cuenta en la app, solo un res.users id real en Odoo (resuelto por nombre
// vía /api/incidencia-destinatarios/buscar-odoo).
const IncidenciaDestinatarioSchema = new Schema(
  {
    odooUserId: { type: Number, required: true, unique: true },
    nombre: { type: String, required: true },
  },
  { timestamps: true },
);

export type IncidenciaDestinatario = InferSchemaType<typeof IncidenciaDestinatarioSchema>;
export const IncidenciaDestinatarioModel = model('IncidenciaDestinatario', IncidenciaDestinatarioSchema);
