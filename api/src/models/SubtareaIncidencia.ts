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
    // Ticket de Odoo al que se adjunta el PDF de reprogramación (lo manda la PWA, que ya lo tiene en la tarea) y
    // nombre del cliente para imprimirlo. Opcionales: sin ticket no se genera el PDF.
    ticketOdooId: { type: Number, default: null },
    clienteNombre: { type: String, default: '' },
    // Resultado del envío del PDF de reprogramación al ticket (best-effort: no bloquea la reprogramación).
    pdfReprogramacionAt: { type: Date, default: null },
    pdfReprogramacionError: { type: String, default: '' },
    tecnicoId: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
    // Día del intento de visita (YYYY-MM-DD) — no createdAt: es el dato que
    // importa para reprogramar, y podría diferir si se reporta con demora.
    fecha: { type: String, required: true, index: true },
    // Obligatorio: coordinación necesita saber por qué no estaba la unidad
    // para poder reprogramarla, no solo que faltó.
    motivo: { type: String, required: true, trim: true },
    // 'pre_cancelado': el técnico empezó el PRE y no puede quedarse ni volver el mismo día; cancela y puede
    // proponer otra fecha y hora (ver propuestaInicio). Ver docs-cancelar-pre-reprogramar.md.
    // 'llegada_tarde': el técnico llegó pasada la tolerancia de la hora agendada y la unidad ya no estaba — es una
    // reprogramación por demora de WARA, no una visita fallida (no se cobra VIS.003). Ver clasificarIncidencia.ts.
    tipo: { type: String, enum: ['no_encontrada', 'pre_cancelado', 'llegada_tarde', 'requiere_otro_tecnico', 'reprogramado_cliente'], default: 'no_encontrada' },
    // 'reprogramado_cliente': el técnico fue al lugar y el cliente pidió reprogramar para otro día; la fecha ya está
    // acordada con el cliente (propuestaInicio/Fin) y queda firmada por él, o con "no hay quien firme". El PDF sale
    // al crearla, no al resolver; coordinación puede aceptar, cambiar la hora o rechazar. Se cobra VIS.003 (visita fallida).
    firmaCliente: {
      type: new Schema(
        {
          // URL pública de la firma en R2; vacía si no hubo quien firmara.
          url: { type: String, default: '' },
          nombre: { type: String, default: '' },
          dni: { type: String, default: '' },
          sinFirma: { type: Boolean, default: false },
          motivoSinFirma: { type: String, default: '' },
        },
        { _id: false },
      ),
      default: undefined,
    },
    // 'requiere_otro_tecnico': una intervención quedó diagnosticada pero la reparación le toca a otro técnico; la incidencia
    // apunta a la subtarea NUEVA creada para eso (ver derivacion.service.ts) y coordinación la agenda y asigna.
    // Hora agendada de la visita y hora a la que el técnico marcó "llegué" (enSitioAt), y el tipo que sugirió el
    // sistema al comparar ambas. Coordinación puede corregir `tipo` al resolver; tipoSugerido queda como registro.
    horaAgendada: { type: Date, default: null },
    // Fin del rango horario de la tarea (las visitas se agendan por rango, ej. 12:00 a 13:00).
    horaFinAgendada: { type: Date, default: null },
    // El técnico llegó DESPUÉS de que terminó el rango: la reprogramación es en parte culpa de WARA y va sin cargo para el
    // cliente. Se calcula al reportar (ver clasificarLlegada); coordinación puede corregirlo al resolver.
    fueraDeRango: { type: Boolean, default: false },
    llegadaAt: { type: Date, default: null },
    tipoSugerido: { type: String, enum: ['no_encontrada', 'llegada_tarde'], default: null },
    tipoCorregidoPor: { type: Schema.Types.ObjectId, ref: 'Usuario', default: null },
    // 'propuesta_pendiente': el técnico propuso fecha y hora y coordinación todavía no respondió.
    // 'rechazada': coordinación no aceptó la propuesta; queda para reprogramar por el camino de siempre.
    estado: {
      type: String,
      enum: ['pendiente_reprogramar', 'propuesta_pendiente', 'rechazada', 'reprogramada'],
      default: 'pendiente_reprogramar',
      index: true,
    },
    // Propuesta del técnico para esta unidad (subtarea): la fecha y hora se escriben en la SUBTAREA, no en la
    // tarea padre. Ambas van juntas o ninguna.
    propuestaInicio: { type: Date, default: null },
    propuestaFin: { type: Date, default: null },
    motivoRechazo: { type: String, default: '' },
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
