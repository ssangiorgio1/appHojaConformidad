import { Schema, model, type InferSchemaType } from 'mongoose';

// Vive independiente de Conformidad a propósito: el aviso "salí hacia
// destino" pasa antes de que exista una Conformidad (esa recién se crea
// server-side al terminar el PRE, ver conformidades.controller.ts). La clave
// es tareaOdooId — el id de la tarea de FSM (project.task) que la PWA
// muestra en /agenda — y no un id de helpdesk.ticket, porque no todas las
// tareas tienen un ticket vinculado (ver scripts/discoverHelpdeskTaskLink.ts)
// mientras que la tarea agendada siempre existe.
const UltimoEnvioSchema = new Schema(
  {
    estado: { type: String, enum: ['en_camino', 'en_sitio', 'completo'], required: true },
    status: { type: String, enum: ['SENT', 'FAILED', 'SKIPPED_NO_CHAT'], required: true },
    error: { type: String, default: '' },
    at: { type: Date, required: true },
  },
  { _id: false },
);

// Un documento = un VIAJE del técnico a esa tarea, no "el estado de la
// tarea" — una misma tareaOdooId puede tener más de uno en el tiempo (ej.
// coordinación reprograma una unidad de un lote y el técnico vuelve otro
// día: ver ALCANCE_BACKOFFICE.md §14.5). `abierta` marca cuál es el viaje
// EN CURSO — a lo sumo uno por tarea a la vez, garantizado por el índice
// único parcial de más abajo (solo aplica cuando abierta:true, así que
// puede haber cualquier cantidad de viajes CERRADOS para la misma tarea).
// Antes esto era `unique: true` sobre tareaOdooId a secas, lo que hacía que
// un segundo viaje a la misma tarea pisara para siempre los timestamps del
// primero (bug real: ver sesión del 2026-09-16, reportes de técnicos).
const VisitaNotificacionSchema = new Schema(
  {
    // Sin `index: true` acá a propósito — el índice único parcial de más
    // abajo ya cubre las consultas por tareaOdooId; declarar los dos generaba
    // un warning de Mongoose por índice duplicado sobre la misma clave.
    tareaOdooId: { type: Number, required: true },
    abierta: { type: Boolean, default: true, index: true },
    // Lo completa el webhook de Telegram cuando el cliente toca el link de
    // opt-in (t.me/<bot>?start=<tareaOdooId>) — null hasta ese momento, y el
    // envío de mensajes queda en SKIPPED_NO_CHAT mientras tanto.
    chatId: { type: String, default: null },
    estado: {
      type: String,
      enum: ['pendiente', 'en_camino', 'en_sitio', 'completo'],
      default: 'pendiente',
    },
    // Quién generó la primera transición (en_camino) — no viene en el token
    // de opt-in del cliente ni en el webhook de Telegram, así que se guarda
    // acá al vuelo desde notificarEstadoVisita, no se pide aparte.
    tecnicoId: { type: Schema.Types.ObjectId, ref: 'Usuario', default: null, index: true },
    // Timestamp de la primera vez que se cruzó cada estado DENTRO DE ESTE
    // VIAJE — separado de `ultimoEnvio.at` (que se pisa en cada transición y
    // por eso no sirve como historial) para poder calcular tiempo de
    // traslado (en_camino → en_sitio) y tiempo en sitio (en_sitio →
    // completo) en /reportes.
    enCaminoAt: { type: Date, default: null },
    enSitioAt: { type: Date, default: null },
    completoAt: { type: Date, default: null },
    ultimoEnvio: { type: UltimoEnvioSchema, default: null },
  },
  { timestamps: true },
);

// Único parcial: como mucho un viaje ABIERTO por tarea a la vez — no un
// único documento por tarea para siempre. Con esto, `findOneAndUpdate(...,
// {upsert:true})` filtrando por `{tareaOdooId, abierta:true}` (ver
// telegram.service.ts) crea un viaje nuevo apenas el anterior se cierra, en
// vez de fallar o pisar el viejo.
VisitaNotificacionSchema.index({ tareaOdooId: 1 }, { unique: true, partialFilterExpression: { abierta: true } });

export type VisitaNotificacion = InferSchemaType<typeof VisitaNotificacionSchema>;
export const VisitaNotificacionModel = model('VisitaNotificacion', VisitaNotificacionSchema);
