import { Schema, model, type InferSchemaType } from 'mongoose';

// Cuando el técnico llega al lugar y una unidad puntual del lote no está
// físicamente presente (se la llevaron a lavar, está en otro lado, etc.), no
// hay Conformidad que generar — pero coordinación necesita verlo para
// reprogramar la visita de esa unidad. Ver ALCANCE_BACKOFFICE.md §14 y
// FUNCIONAMIENTO.md §11.3. Independiente de Conformidad a propósito, mismo
// motivo que VisitaNotificacion: esto puede existir sin que exista ninguna
// hoja para esa subtarea ese día.
const SubtareaIncidenciaSchema = new Schema(
  {
    // uuid generado en el dispositivo (reportes encolados sin señal) — ver createSubtareaIncidencia.
    clientId: { type: String, index: { unique: true, sparse: true } },
    tareaOdooId: { type: Number, required: true, index: true },
    subtareaOdooId: { type: Number, required: true, index: true },
    // Ver Conformidad.subtareaOdoo.mergedTaskIds / ALCANCE_BACKOFFICE.md
    // §15.9b — otras project.task reales colapsadas en esta misma unidad.
    mergedTaskIds: { type: [Number], default: undefined },
    // La patente/nombre de la subtarea en Odoo, copiado acá para que el
    // panel web no tenga que volver a pedirle nada a Odoo solo para mostrar
    // la lista de incidencias.
    subtareaNombre: { type: String, default: '' },
    tecnicoId: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
    // Día del intento de visita (YYYY-MM-DD) — no createdAt: es el dato que
    // importa para reprogramar, y podría diferir si se reporta con demora.
    fecha: { type: String, required: true, index: true },
    // Obligatorio: coordinación necesita saber por qué no estaba la unidad
    // para poder reprogramarla, no solo que faltó.
    motivo: { type: String, required: true, trim: true },
    tipo: { type: String, enum: ['no_encontrada'], default: 'no_encontrada' },
    estado: {
      type: String,
      enum: ['pendiente_reprogramar', 'reprogramada'],
      default: 'pendiente_reprogramar',
      index: true,
    },
    resueltaPor: { type: Schema.Types.ObjectId, ref: 'Usuario', default: null },
    resueltaAt: { type: Date, default: null },
    // Nueva fecha y hora a la que se reprogramó la visita (la que se eligió al reprogramar desde el panel);
    // null en las reprogramadas antes de guardarse este dato y en las marcadas sin mover la tarea en Odoo.
    reprogramadaPara: { type: Date, default: null },
  },
  { timestamps: true },
);

export type SubtareaIncidencia = InferSchemaType<typeof SubtareaIncidenciaSchema>;
export const SubtareaIncidenciaModel = model('SubtareaIncidencia', SubtareaIncidenciaSchema);
