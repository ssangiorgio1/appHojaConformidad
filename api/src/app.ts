import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { authRouter } from './routes/auth.routes.js';
import { uploadsRouter } from './routes/uploads.routes.js';
import { conformidadesRouter } from './routes/conformidades.routes.js';
import { odooRouter } from './routes/odoo.routes.js';
import { calendarTaskRouter } from './routes/calendarTask.routes.js';
import { visitasRouter } from './routes/visitas.routes.js';
import { telegramRouter } from './routes/telegram.routes.js';
import { reportesRouter } from './routes/reportes.routes.js';
import { subtareaIncidenciaRouter } from './routes/subtareaIncidencia.routes.js';
import { incidenciaDestinatarioRouter } from './routes/incidenciaDestinatario.routes.js';
import { flotaRouter } from './routes/flota.routes.js';
import { equipoRouter } from './routes/equipo.routes.js';
import { internalRouter } from './routes/internal.routes.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import { apiLimiter } from './middleware/rateLimit.middleware.js';

export const app = express();

// Render pone un único proxy/load balancer delante — sin esto, Express toma
// `req.ip` como la IP de ESE proxy (la misma para todo el mundo) en vez de la
// del cliente real que viene en X-Forwarded-For, y el rate limiter de abajo
// termina agrupando a todos los usuarios en un solo balde compartido.
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    // Fail-closed en producción: si CORS_ORIGINS no está seteado, se rechaza
    // todo origin cross-origin en vez de reflejar cualquiera (era el
    // comportamiento anterior — permisivo por default, silencioso). En
    // desarrollo sigue siendo permisivo para no tener que setear el env var
    // localmente. Mobile no manda Origin, así que no lo afecta esto.
    origin: env.CORS_ORIGINS_LIST.length > 0 ? env.CORS_ORIGINS_LIST : env.NODE_ENV !== 'production',
  }),
);
app.use(express.json({ limit: '2mb' }));
app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
app.use('/api', apiLimiter);

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/conformidades', conformidadesRouter);
app.use('/api/odoo', odooRouter);
app.use('/api/calendar', calendarTaskRouter);
app.use('/api/visitas', visitasRouter);
app.use('/api/telegram', telegramRouter);
app.use('/api/reportes', reportesRouter);
app.use('/api/subtareas/incidencias', subtareaIncidenciaRouter);
app.use('/api/incidencia-destinatarios', incidenciaDestinatarioRouter);
app.use('/api/flota', flotaRouter);
app.use('/api/equipos', equipoRouter);
app.use('/api/internal', internalRouter);

app.use(errorMiddleware);
