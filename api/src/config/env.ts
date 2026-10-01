import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  FIREBASE_PROJECT_ID: z.string().min(1, 'FIREBASE_PROJECT_ID is required'),
  FIREBASE_CLIENT_EMAIL: z.string().min(1, 'FIREBASE_CLIENT_EMAIL is required'),
  FIREBASE_PRIVATE_KEY: z.string().min(1, 'FIREBASE_PRIVATE_KEY is required'),

  ALLOWED_EMAIL_DOMAIN: z.string().min(1).default('waragps.com'),

  // The one superadmin account that no one — not even other admins/superadmins —
  // can demote or deactivate through the API. Keeps there always being a way in.
  PROTECTED_SUPERADMIN_EMAIL: z.string().min(1).default('joacosangiorgio1@gmail.com'),

  R2_ACCOUNT_ID: z.string().min(1, 'R2_ACCOUNT_ID is required'),
  R2_ACCESS_KEY_ID: z.string().min(1, 'R2_ACCESS_KEY_ID is required'),
  R2_SECRET_ACCESS_KEY: z.string().min(1, 'R2_SECRET_ACCESS_KEY is required'),
  R2_BUCKET_NAME: z.string().min(1, 'R2_BUCKET_NAME is required'),
  R2_PUBLIC_BASE_URL: z.string().min(1, 'R2_PUBLIC_BASE_URL is required'),

  ODOO_URL: z.string().min(1, 'ODOO_URL is required'),
  ODOO_DB: z.string().min(1, 'ODOO_DB is required'),
  ODOO_EMAIL: z.string().min(1, 'ODOO_EMAIL is required'),
  ODOO_API_KEY: z.string().min(1, 'ODOO_API_KEY is required'),

  // Encrypts each técnico's personal Odoo password at rest (see utils/secretBox.ts).
  ODOO_LINK_SECRET: z.string().min(16, 'ODOO_LINK_SECRET is required (min 16 chars)'),

  // Sólo el VALOR de la cookie BO3SESSION de ssl.visionblo.com/bo3 (F12 → Application → Cookies).
  // Opcional: sin esto, /api/flota/refrescar responde 503 y el resto de la API sigue igual.
  VISIONBLO_SESSION_COOKIE: z.string().optional(),

  // Firma de los crons de QStash (routes/internal.routes.ts). Opcionales: sin ellas, /api/internal responde 503.
  QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().optional(),

  CORS_ORIGINS: z.string().default(''),

  // Alertas al cliente por Telegram (seguimiento de visita) — opcionales:
  // sin configurar, notificarEstadoVisita loguea y sigue sin mandar nada, no
  // tira el resto de la API abajo. Se completan cuando el bot esté creado.
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_BOT_USERNAME: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = {
  ...parsed.data,
  CORS_ORIGINS_LIST: parsed.data.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  // Render/most dashboards store multi-line PEM keys with literal "\n" sequences
  FIREBASE_PRIVATE_KEY: parsed.data.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  ODOO_URL: parsed.data.ODOO_URL.replace(/\/+$/, ''),
};
