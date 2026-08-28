import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { authRouter } from './routes/auth.routes.js';
import { uploadsRouter } from './routes/uploads.routes.js';
import { conformidadesRouter } from './routes/conformidades.routes.js';
import { odooRouter } from './routes/odoo.routes.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import { apiLimiter } from './middleware/rateLimit.middleware.js';

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGINS_LIST.length > 0 ? env.CORS_ORIGINS_LIST : true,
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

app.use(errorMiddleware);
