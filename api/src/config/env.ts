import 'dotenv/config';
import { z } from 'zod';
import { motivosDeBloqueo } from './entornoPruebas.js';

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

  // Token Bearer de la API de preinstalación de VisionBLO (config/visionbloApi.ts). Opcional: sin esto, el estado de equipo
  // usa solo la cookie, como antes. Por ahora solo local — todavía no está cargado en Render.
  VISIONBLO_API_TOKEN: z.string().optional(),
  VISIONBLO_API_URL: z.string().url().default('http://apps4.visionblo.com:8001'),

  // Firma de los crons de QStash (routes/internal.routes.ts). Opcionales: sin ellas, /api/internal responde 503.
  QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().optional(),

  // Servidor de rutas por calle (OSRM, ver routing/ en la raíz del repo), ej. http://localhost:5000. Opcional: sin
  // esto /api/ruteo responde que no está disponible y el panel usa las zonas por radio en línea recta.
  ROUTING_URL: z.string().url().optional(),

  // Apagada por defecto: con '1', la constancia de visita fallida se manda al ticket de Odoo en el momento en que el técnico
  // reporta "No está en el lugar" (regla por rango horario, ver docs-visita-fallida-pdf.md). Sin esto el reporte no
  // manda nada a Odoo y la constancia sigue saliendo al resolver, como antes.
  CONSTANCIA_AL_REPORTAR: z.enum(['0', '1']).optional(),

  CORS_ORIGINS: z.string().default(''),

  // 'pruebas' (lo pone .env.pruebas, ver `pnpm dev:pruebas`) activa el freno de config/entornoPruebas.ts: la API solo
  // arranca con Mongo local y Odoo de desarrollo. Sin esto, no cambia nada.
  WARA_ENTORNO: z.string().optional(),
  // '1' permite que un script o la API local usen una Mongo remota (Atlas, la que usa Render). Por defecto, fuera de
  // Render la API se niega: ver config/entornoPruebas.ts. Nunca va en Render.
  PERMITIR_BASE_REAL: z.string().optional(),

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

// RENDER=true lo pone Render en todos sus servicios: ahí no se frena nada. En cualquier otro lado (la compu) sí.
const bloqueos = motivosDeBloqueo({ ...parsed.data, EN_RENDER: Boolean(process.env.RENDER) });
if (bloqueos.length) {
  console.error('Arranque bloqueado: la configuración local tocaría datos reales.');
  for (const m of bloqueos) console.error(`  - ${m}`);
  console.error('Usá `pnpm dev` (Mongo local, .env.pruebas) y revisá el bloque de Odoo activo de .env.');
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
  ROUTING_URL: parsed.data.ROUTING_URL?.replace(/\/+$/, ''),
  VISIONBLO_API_URL: parsed.data.VISIONBLO_API_URL.replace(/\/+$/, ''),
  CONSTANCIA_AL_REPORTAR: parsed.data.CONSTANCIA_AL_REPORTAR === '1',
};
