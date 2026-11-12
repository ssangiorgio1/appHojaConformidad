import { Schema, model, type InferSchemaType } from 'mongoose';

// Con quién viaja cada técnico en cada tarea y fecha, según la última agenda que la API le sirvió (que viene de Odoo):
// los técnicos que comparten al menos una unidad con él. Con esto los banners y avisos de "tu compañero salió/llegó"
// se deciden solo con Mongo, sin volver a preguntarle a Odoo en cada refresco (Odoo tiene límite de pedidos). Se pisa en
// cada pedido de agenda (así un cambio de asignación del coordinador se toma al actualizar) y vence solo a los 3 días.
const AgendaCompartidaSchema = new Schema(
  {
    usuarioId: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
    tareaOdooId: { type: Number, required: true },
    // 'YYYY-MM-DD' (hora de Argentina), mismo formato que VisitaNotificacion.fecha.
    fecha: { type: String, required: true },
    // Ids de usuario de Odoo de los compañeros de viaje (sin el propio técnico). Vacío = la hace solo.
    companerosOdooIds: { type: [Number], default: [] },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

AgendaCompartidaSchema.index({ usuarioId: 1, tareaOdooId: 1, fecha: 1 }, { unique: true });
AgendaCompartidaSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type AgendaCompartida = InferSchemaType<typeof AgendaCompartidaSchema>;
export const AgendaCompartidaModel = model('AgendaCompartida', AgendaCompartidaSchema);
