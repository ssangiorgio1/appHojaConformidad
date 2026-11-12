// Freno del entorno de pruebas (`pnpm dev:pruebas`, archivo `.env.pruebas`).
//
// Las pruebas locales NUNCA tienen que tocar la base de producción: el 2026-11-10 una tarea de staging con el mismo id
// que una tarea real de producción (23305) dejó una visita abierta en la Mongo compartida y le apareció a un técnico real.
// Con WARA_ENTORNO=pruebas la API se niega a arrancar si Mongo no es local o si Odoo no es una instancia de desarrollo.

export const ENTORNO_PRUEBAS = 'pruebas';

const HOSTS_MONGO_LOCALES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/** Host del connection string de Mongo (sin credenciales ni puerto), o null si no se puede leer. */
export function hostDeMongo(uri: string): string | null {
  const m = /^mongodb:\/\/(?:[^@/]*@)?([^/?]+)/i.exec(uri.trim());
  if (!m) return null; // mongodb+srv:// (Atlas) no matchea a propósito: nunca es local
  // Puede venir una lista de hosts (réplica); en pruebas se exige que TODOS sean locales.
  const hosts = m[1].split(',').map((h) => h.replace(/:\d+$/, '').toLowerCase());
  return hosts.every((h) => HOSTS_MONGO_LOCALES.has(h)) ? hosts[0] : null;
}

/** Una instancia de Odoo de desarrollo/staging (Odoo.sh): `*.dev.odoo.com`. Producción es wara-v1.odoo.com. */
export function esOdooDeDesarrollo(url: string): boolean {
  try {
    return new URL(url).hostname.toLowerCase().endsWith('.dev.odoo.com');
  } catch {
    return false;
  }
}

/**
 * Motivos por los que NO se puede arrancar ([] = todo en orden).
 *  1. Fuera de Render, Mongo tiene que ser local: lo que se corre en la compu nunca toca la base de Atlas que usa Render.
 *     Se salta con PERMITIR_BASE_REAL=1 (scripts de mantenimiento a propósito) y en los tests (NODE_ENV=test).
 *  2. En modo pruebas, además, Odoo tiene que ser una instancia de desarrollo.
 */
export function motivosDeBloqueo(cfg: {
  WARA_ENTORNO?: string;
  MONGODB_URI: string;
  ODOO_URL: string;
  EN_RENDER?: boolean;
  NODE_ENV?: string;
  PERMITIR_BASE_REAL?: string;
}): string[] {
  const motivos: string[] = [];
  const mongoLocal = hostDeMongo(cfg.MONGODB_URI) !== null;
  const exento = cfg.EN_RENDER || cfg.NODE_ENV === 'test' || cfg.PERMITIR_BASE_REAL === '1';
  const enPruebas = cfg.WARA_ENTORNO === ENTORNO_PRUEBAS;
  if (!mongoLocal && (enPruebas || !exento)) {
    motivos.push(
      enPruebas
        ? 'MONGODB_URI no apunta a un Mongo local (localhost / 127.0.0.1): en pruebas no se usa Atlas ni ninguna base remota.'
        : 'MONGODB_URI no apunta a un Mongo local: fuera de Render la API solo usa el Mongo local (pnpm mongo:pruebas). Para tocar Atlas a propósito, PERMITIR_BASE_REAL=1.',
    );
  }
  if (enPruebas) {
    if (!esOdooDeDesarrollo(cfg.ODOO_URL)) {
      motivos.push('ODOO_URL no es una instancia de desarrollo (*.dev.odoo.com): en pruebas no se escribe en el Odoo de producción.');
    }
  }
  return motivos;
}
