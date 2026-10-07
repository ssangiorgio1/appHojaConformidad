// Herramienta interna de stock de VisionBLO: dado un IMEI devuelve en texto plano el número de
// equipo (ej. "2408912"). Sin autenticación. Si el IMEI no existe responde 200 con
// "No está en la base de datos", y para equipos viejos algo como "Stock 396 (Tanda 23)": sólo se
// acepta una respuesta puramente numérica, cualquier otra cosa se trata como "no encontrado".
// La usa la PWA cuando el QR de la etiqueta trae sólo el IMEI (sin "numequipo;imei").
const STOCK_URL = 'https://apps.visionblo.com/stock/';
const TIMEOUT_MS = 8_000;

export const IMEI_RE = /^\d{15}$/;

export function parseNumeroEquipo(respuesta: string): string | null {
  const t = respuesta.trim();
  return /^\d{4,10}$/.test(t) ? t : null;
}

export async function numeroEquipoPorImei(imei: string): Promise<string | null> {
  if (!IMEI_RE.test(imei)) return null;
  const res = await fetch(`${STOCK_URL}?imei=${imei}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) return null;
  return parseNumeroEquipo(await res.text());
}
