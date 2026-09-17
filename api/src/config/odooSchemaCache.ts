// Cache en memoria (vive mientras el proceso esté arriba) para lecturas de
// Odoo que cambian poco (fields_get, detección de proyectos de Field
// Service, lista de técnicos) — ver el mismo patrón, con la misma razón de
// ser, en el dashboard de reportes (lib/odoo-cache.ts). Guarda la PROMESA
// (no el valor resuelto) para que pedidos concurrentes compartan un mismo
// viaje de red (single-flight) en vez de disparar uno cada uno.
interface Entry {
  expires: number;
  value: Promise<unknown>;
}

const store = new Map<string, Entry>();

export function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.value as Promise<T>;

  const value = fn().catch((err) => {
    // Si la llamada real falla, no dejamos la promesa rechazada pegada en el
    // cache — el próximo pedido tiene que poder reintentar en vez de repetir
    // el mismo error hasta que expire el TTL.
    store.delete(key);
    throw err;
  });
  store.set(key, { expires: now + ttlMs, value });
  return value;
}
