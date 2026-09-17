import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { env } from '../config/env.js';
import { registrarOptIn, sendTelegramMessage } from '../services/telegram.service.js';

// Shape mínimo que nos interesa del Update de Telegram — el resto (edited_message,
// callback_query, etc.) lo ignoramos, nunca vamos a habilitar botones inline acá.
interface TelegramUpdate {
  message?: {
    chat?: { id?: number | string };
    text?: string;
  };
}

// Público a propósito (el bot de Telegram no manda Bearer token) — la única
// defensa es el secret token que Telegram reenvía en el header cuando se
// registra el webhook con `secret_token` (ver setWebhook), chequeado acá
// mismo en vez de un middleware aparte porque es un caso de uso único.
export const telegramWebhook = asyncHandler(async (req: Request, res: Response) => {
  const secret = req.headers['x-telegram-bot-api-secret-token'];
  if (!env.TELEGRAM_WEBHOOK_SECRET || secret !== env.TELEGRAM_WEBHOOK_SECRET) {
    res.status(401).end();
    return;
  }

  // Siempre 200 de acá para abajo — devolverle un error a Telegram hace que
  // reintente el mismo update indefinidamente, y un /start mal formado no es
  // algo que vaya a arreglarse solo con un reintento.
  res.status(200).end();

  const update = req.body as TelegramUpdate;
  const chatId = update.message?.chat?.id;
  const text = update.message?.text?.trim() ?? '';
  if (chatId == null) return;

  const match = text.match(/^\/start(?:@\w+)?\s+(\d+)$/);
  if (!match) {
    if (text.startsWith('/start')) {
      await sendTelegramMessage(String(chatId), 'Este link tiene que abrirse desde el aviso de tu visita técnica de WARA.').catch(() => {});
    }
    return;
  }

  const tareaOdooId = Number(match[1]);
  await registrarOptIn(tareaOdooId, String(chatId));
  await sendTelegramMessage(
    String(chatId),
    '✅ Listo — te vamos a avisar por acá cuando el técnico salga hacia tu domicilio y cuando llegue.',
  ).catch(() => {});
});
