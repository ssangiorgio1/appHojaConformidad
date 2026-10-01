import { Router } from 'express';
import { requireQstashSignature } from '../middleware/qstash.middleware.js';
import { VisionbloError, visionbloKeepalive } from '../config/visionblo.js';

export const internalRouter = Router();

// Endpoints para crons de QStash (sin usuario): se protegen por firma, no por requireAuth.
internalRouter.use(requireQstashSignature);

// Mantiene viva la cookie de VisionBLO. Responde 503 si venció/no está configurada, así el
// historial de QStash muestra el fallo apenas pasa en vez de enterarnos cuando un técnico diagnostica.
internalRouter.post('/visionblo/keepalive', async (_req, res) => {
  try {
    await visionbloKeepalive();
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof VisionbloError) {
      console.error('VISIONBLO_KEEPALIVE_FAILED', err.code, err.message);
      res.status(503).json({ ok: false, code: err.code, error: err.message });
      return;
    }
    console.error('VISIONBLO_KEEPALIVE_FAILED', err);
    res.status(502).json({ ok: false });
  }
});
