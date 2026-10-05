import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

// Tighter limit for account-mutation endpoints (create/reset password) —
// these are admin-only but still worth throttling against a compromised
// or scripted admin token.
export const authMutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

// Para mover tareas del calendario — más laxo que authMutationLimiter
// porque una sesión de coordinación reordenando la agenda del día puede
// hacer bastantes más de 30 movimientos en 15 minutos.
export const calendarMutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

// Límite por usuario autenticado (se aplica dentro de requireAuth, ya con
// req.user). El apiLimiter de arriba agrupa por IP, así que varios técnicos
// detrás de la misma IP (oficina, CGNAT del carrier) comparten balde y un
// token robado puede scrapear dentro del cupo de la IP. Este lo acota por
// cuenta. Holgado a propósito: la PWA hace polling de agenda/flota.
export const userLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `u:${String(req.user?.usuarioId ?? req.ip)}`,
  validate: { keyGeneratorIpFallback: false },
});
