import { Types } from 'mongoose';
import { env } from '../config/env.js';
import { VisitaNotificacionModel } from '../models/VisitaNotificacion.js';

export class TelegramError extends Error {}

const MENSAJES: Record<'en_camino' | 'en_sitio' | 'completo', string> = {
  en_camino: '🚐 Tu técnico de WARA está en camino a tu domicilio.',
  en_sitio: '📍 Tu técnico de WARA llegó y va a comenzar el trabajo.',
  completo: '✅ El trabajo fue finalizado. ¡Gracias por confiar en WARA!',
};

// El link de opt-in es deliberadamente simple (sin firma/token opaco): el
// plan es pegarlo tal cual en el template de notificación de Odoo, que solo
// puede interpolar campos de la propia tarea (ej. ${object.id}) — no puede
// llamar a un endpoint nuestro para pedir un token firmado. El peor caso de
// que alguien adivine un tareaOdooId ajeno es que reciba avisos de estado de
// una visita que no es la suya, no una fuga de datos sensibles.
export function buildOptInLink(tareaOdooId: number): string | null {
  if (!env.TELEGRAM_BOT_USERNAME) return null;
  return `https://t.me/${env.TELEGRAM_BOT_USERNAME}?start=${tareaOdooId}`;
}

export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) throw new TelegramError('TELEGRAM_BOT_TOKEN no configurado');

  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new TelegramError(`Telegram respondió ${res.status}: ${body}`);
  }
}

// Punto único para las tres transiciones (en_camino/en_sitio, disparadas
// desde la agenda de la PWA, y completo, disparada desde patchConformidad
// cuando se firma el POST) — decoupled del caller: nunca tira, siempre
// devuelve el doc actualizado con el resultado del envío, así el caller
// decide si bloquea o no la respuesta según si es una acción explícita del
// técnico o un efecto secundario silencioso.
//
// `tecnicoId` ahora es obligatorio — el viaje es único por (tarea, técnico),
// no por tarea a secas (ver VisitaNotificacion.ts, corregido 2026-09-25 para
// que 2 técnicos con subtareas distintas del mismo lote no se bloqueen entre
// sí). Los 4 callers reales (setEstadoVisita, finalizarVisitaLote,
// patchConformidad, cerrarVisitaLoteSiTodoResuelto) siempre lo tienen a mano.
// `fecha` ('YYYY-MM-DD') identifica A QUÉ intento/entrada de calendario
// pertenece este viaje — sin esto, dos entradas de calendario para la misma
// tareaOdooId en fechas distintas (ver calendarTask.service.ts) competirían
// por el mismo documento.
export async function notificarEstadoVisita(
  tareaOdooId: number,
  estado: 'en_camino' | 'en_sitio' | 'completo',
  tecnicoId: Types.ObjectId | string,
  fecha: string,
  ocurrioAt?: string,
) {
  const visita = await upsertViajeAbierto(tareaOdooId, estado, tecnicoId, fecha);

  // Timestamp por transición, seteado una sola vez: un reintento o un PATCH
  // duplicado del mismo estado no debe correr el reloj de traslado/trabajo.
  // `ocurrioAt` (acción encolada sin señal en la PWA) es el momento real del
  // toque: se acepta solo si es razonable (no futuro, no más de 24 h atrás) y
  // sin retroceder más allá de la transición anterior; si no, hora del servidor.
  const now = resolverMomento(ocurrioAt, estado === 'en_sitio' ? visita.enCaminoAt : estado === 'completo' ? (visita.enSitioAt ?? visita.enCaminoAt) : null);
  if (estado === 'en_camino' && !visita.enCaminoAt) visita.enCaminoAt = now;
  if (estado === 'en_sitio' && !visita.enSitioAt) visita.enSitioAt = now;
  if (estado === 'completo' && !visita.completoAt) visita.completoAt = now;

  if (!visita.chatId) {
    visita.ultimoEnvio = { estado, status: 'SKIPPED_NO_CHAT', error: '', at: new Date() };
    await visita.save();
    return visita;
  }

  try {
    await sendTelegramMessage(visita.chatId, MENSAJES[estado]);
    visita.ultimoEnvio = { estado, status: 'SENT', error: '', at: new Date() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('TELEGRAM_SEND_FAILURE', tareaOdooId, estado, message);
    visita.ultimoEnvio = { estado, status: 'FAILED', error: message, at: new Date() };
  }

  await visita.save();
  return visita;
}

export function resolverMomento(ocurrioAt: string | undefined, previo: Date | null | undefined): Date {
  const ahora = new Date();
  if (!ocurrioAt) return ahora;
  const t = new Date(ocurrioAt);
  const ms = t.getTime();
  if (Number.isNaN(ms) || ms > ahora.getTime() + 60_000 || ms < ahora.getTime() - 24 * 3_600_000) return ahora;
  if (previo && ms < previo.getTime()) return ahora;
  return t;
}

// Filtra por `{tareaOdooId, tecnicoId, abierta: true}` en vez de solo
// `{tareaOdooId}` — así, 2 técnicos con subtareas distintas del mismo lote
// tienen cada uno su propio viaje sin pisarse (ver VisitaNotificacion.ts), y
// si el viaje anterior de ESTE técnico a esta tarea ya se cerró (completo, o
// cancelado vía cancelarVisita), el upsert abre uno NUEVO en vez de
// reusar/pisar el viejo. Llegar a 'completo' cierra el viaje en la misma
// escritura. `tecnicoId` va en el filtro (no en un `$set` aparte) para que
// Mongo lo complete solo en el insert — no hace falta asignarlo a mano
// después.
//
// Mongo no garantiza atomicidad de un upsert contra su propio índice único
// parcial bajo dos requests concurrentes para el mismo (tareaOdooId,
// tecnicoId) cuando el documento todavía no existe — el segundo puede pisar
// el insert del primero y recibir E11000 (que error.middleware.ts traduce a
// 409) en vez de simplemente encontrar el doc recién creado. Doble tap,
// reintento de red, o dos pestañas: cualquiera de esos dispara la carrera —
// nunca debería tumbarse en el técnico, así que el segundo intento reintenta
// como update simple (ya sabemos que el doc existe, lo insertó el otro
// request).
async function upsertViajeAbierto(
  tareaOdooId: number,
  estado: 'en_camino' | 'en_sitio' | 'completo',
  tecnicoId: Types.ObjectId | string,
  fecha: string,
) {
  const abierta = estado !== 'completo';
  const filter = { tareaOdooId, tecnicoId, fecha, abierta: true };
  try {
    return await VisitaNotificacionModel.findOneAndUpdate(filter, { $set: { estado, abierta } }, { new: true, upsert: true });
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 11000) {
      const retried = await VisitaNotificacionModel.findOneAndUpdate(filter, { $set: { estado, abierta } }, { new: true });
      if (retried) return retried;
    }
    throw err;
  }
}

// El opt-in de Telegram puede llegar en cualquier momento del viaje (o antes
// de que exista ninguno) — se guarda en el viaje abierto si hay uno, si no
// en el más reciente para esta tarea, y si no existe ninguno todavía se crea
// uno nuevo (abierta, en 'pendiente'). `sort` prioriza abierta:true antes que
// createdAt más reciente para no pisar el chatId de un viaje viejo y ya
// cerrado mientras hay uno en curso.
//
// Sin tocar a propósito (2026-09-25): sigue filtrando solo por `tareaOdooId`,
// sin tecnicoId — con 2 técnicos en viaje simultáneo sobre el mismo lote (ver
// VisitaNotificacion.ts), el opt-in del cliente quedaría pegado a "alguno" de
// los dos viajes, ambiguo. La notificación al cliente por Telegram está
// deprioritizada por ahora (funcionalidad a futuro, no crítica hoy) — cuando
// se retome, hay que decidir ahí si el cliente necesita un solo hilo por
// visita (aunque haya 2 técnicos) o uno por técnico.
export async function registrarOptIn(tareaOdooId: number, chatId: string) {
  return VisitaNotificacionModel.findOneAndUpdate(
    { tareaOdooId },
    { $set: { chatId } },
    { new: true, upsert: true, setDefaultsOnInsert: true, sort: { abierta: -1, createdAt: -1 } },
  );
}
