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
// `tecnicoId` es opcional porque 'completo' se dispara server-side desde
// patchConformidad, que sí lo tiene a mano (record.tecnicoId) — pero solo se
// graba la primera vez (ver más abajo), así que no importa si en_camino/
// en_sitio ya lo habían fijado antes.
export async function notificarEstadoVisita(
  tareaOdooId: number,
  estado: 'en_camino' | 'en_sitio' | 'completo',
  tecnicoId?: Types.ObjectId | string | null,
) {
  const visita = await upsertViajeAbierto(tareaOdooId, estado);

  // Timestamp por transición, seteado una sola vez: un reintento o un PATCH
  // duplicado del mismo estado no debe correr el reloj de traslado/trabajo.
  const now = new Date();
  if (estado === 'en_camino' && !visita.enCaminoAt) visita.enCaminoAt = now;
  if (estado === 'en_sitio' && !visita.enSitioAt) visita.enSitioAt = now;
  if (estado === 'completo' && !visita.completoAt) visita.completoAt = now;
  if (tecnicoId && !visita.tecnicoId) visita.tecnicoId = new Types.ObjectId(tecnicoId);

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

// Filtra por `{tareaOdooId, abierta: true}` en vez de solo `{tareaOdooId}` —
// así, si el viaje anterior a esta tarea ya se cerró (completo, o cancelado
// vía cancelarVisita), el upsert abre uno NUEVO en vez de reusar/pisar el
// viejo (ver VisitaNotificacion.ts). Llegar a 'completo' cierra el viaje en
// la misma escritura.
//
// Mongo no garantiza atomicidad de un upsert contra su propio índice único
// parcial bajo dos requests concurrentes para el mismo tareaOdooId cuando el
// documento todavía no existe — el segundo puede pisar el insert del primero
// y recibir E11000 (que error.middleware.ts traduce a 409) en vez de
// simplemente encontrar el doc recién creado. Doble tap, reintento de red, o
// dos pestañas: cualquiera de esos dispara la carrera — nunca debería
// tumbarse en el técnico, así que el segundo intento reintenta como update
// simple (ya sabemos que el doc existe, lo insertó el otro request).
async function upsertViajeAbierto(tareaOdooId: number, estado: 'en_camino' | 'en_sitio' | 'completo') {
  const abierta = estado !== 'completo';
  try {
    return await VisitaNotificacionModel.findOneAndUpdate(
      { tareaOdooId, abierta: true },
      { $set: { estado, abierta } },
      { new: true, upsert: true },
    );
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 11000) {
      const retried = await VisitaNotificacionModel.findOneAndUpdate(
        { tareaOdooId, abierta: true },
        { $set: { estado, abierta } },
        { new: true },
      );
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
export async function registrarOptIn(tareaOdooId: number, chatId: string) {
  return VisitaNotificacionModel.findOneAndUpdate(
    { tareaOdooId },
    { $set: { chatId } },
    { new: true, upsert: true, setDefaultsOnInsert: true, sort: { abierta: -1, createdAt: -1 } },
  );
}
