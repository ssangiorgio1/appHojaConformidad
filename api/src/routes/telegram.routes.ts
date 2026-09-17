import { Router } from 'express';
import { telegramWebhook } from '../controllers/telegram.controller.js';

export const telegramRouter = Router();

// Sin requireAuth — Telegram llama a esto directo, sin Bearer token. Se
// protege con el secret token de webhook, chequeado dentro del controller.
telegramRouter.post('/webhook', telegramWebhook);
