import { env } from '../config/env.js';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import puppeteer, { type Browser } from 'puppeteer';
import sharp from 'sharp';
import { buildPrintHtml, type PrintableConformidad } from '@wara/shared';
import { buildObjectKey, uploadBuffer } from './r2.service.js';
import { buildReprogramacionHtml, type ReprogramacionPdfData } from './reprogramacionPdf.js';
import { buildReprogramacionClienteHtml, type ReprogramacionClienteData } from './reprogramacionClientePdf.js';
import { buildConstanciaVisitaFallidaHtml, type ConstanciaVisitaFallidaData } from './constanciaVisitaFallidaPdf.js';
import { buildRetiroEquipoHtml, type RetiroEquipoPdfData } from './retiroEquipoPdf.js';

// Se embebe como data URI (no una URL de R2/Odoo) para que el PDF no dependa
// de que Chromium resuelva una request de red aparte al renderizar — el
// mismo motivo por el que las fotos ya vienen resueltas antes de setContent.
const LOGO_DATA_URI = `data:image/png;base64,${readFileSync(new URL('../assets/logo-wara.png', import.meta.url)).toString('base64')}`;

// Semáforo mínimo: como mucho `max` tareas a la vez, el resto espera en cola (FIFO).
function crearSemaforo(max: number) {
  let activos = 0;
  const cola: Array<() => void> = [];
  return async function <T>(tarea: () => Promise<T>): Promise<T> {
    if (activos >= max) await new Promise<void>((resolve) => cola.push(resolve));
    activos++;
    try {
      return await tarea();
    } finally {
      activos--;
      cola.shift()?.();
    }
  };
}

// Las fotos ya vienen resizeadas a ~1100px/JPEG 72% del lado del técnico
// (para poder hacer zoom en el panel web) — pero en el PDF se imprimen en
// cajas de apenas 120x120px, y Chromium al exportar a PDF embebe el archivo
// fuente completo tal cual lo carga, no lo reescala a lo que realmente se ve
// impreso. Un acta con 15-19 fotos terminaba pesando varios MB. Se vuelven a
// re-encodar acá, server-side, a un tamaño apropiado para ese layout — el
// original en R2 nunca se toca, sigue sirviendo para el zoom del panel.
const PDF_PHOTO_MAX_DIM = 420;
const PDF_PHOTO_QUALITY = 60;

// Las fotos de R2 no cambian (cada una tiene su propia URL): se guarda el resultado ya reescalado para no volver a
// bajarlas y re-encodarlas en cada "Ver PDF" ni en cada envío a Odoo de la misma hoja. LRU simple (el orden de
// inserción del Map): ~20 KB por foto reescalada, así que 400 entradas son unos pocos MB.
const PHOTO_CACHE_MAX = 400;
const photoCache = new Map<string, string>();

// Tope de fotos descargándose/reescalándose a la vez (en total, entre todos los PDFs en curso): un acta trae hasta
// ~19 y varias a la vez disparaban la memoria de la instancia.
const PHOTO_FETCH_TIMEOUT_MS = 15_000;
const photoSlots = crearSemaforo(4);

async function resizePhotoForPdf(url: string): Promise<string | undefined> {
  const hit = photoCache.get(url);
  if (hit) {
    photoCache.delete(url);
    photoCache.set(url, hit);
    return hit;
  }
  const resized = await photoSlots(() => resizePhotoUncached(url));
  if (resized) {
    photoCache.set(url, resized);
    if (photoCache.size > PHOTO_CACHE_MAX) photoCache.delete(photoCache.keys().next().value as string);
  }
  return resized;
}

async function resizePhotoUncached(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(PHOTO_FETCH_TIMEOUT_MS) });
    if (!res.ok) return undefined;
    const original = Buffer.from(await res.arrayBuffer());
    const resized = await sharp(original)
      .rotate() // respeta la orientación EXIF antes de descartarla al re-encodar
      .resize(PDF_PHOTO_MAX_DIM, PDF_PHOTO_MAX_DIM, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: PDF_PHOTO_QUALITY })
      .toBuffer();
    return `data:image/jpeg;base64,${resized.toString('base64')}`;
  } catch {
    // Si falla el resize (foto corrupta, R2 momentáneamente inaccesible, etc.)
    // mejor imprimir la foto pesada que dejar el PDF sin esa foto.
    return undefined;
  }
}

// One Chromium instance shared across requests — launching it per-request
// would add several seconds to every PDF generation.
let browserPromise: Promise<Browser> | null = null;

// Chromium de larga vida va acumulando memoria: se lo recicla cada tantos renders y tras un rato ocioso. Un solo
// render a la vez (PDF_RENDER_CONCURRENCY) porque cada pestaña pesa 100-200 MB y compite por CPU con el resto de la API.
const PDF_RENDER_CONCURRENCY = 1;
const RENDERS_ANTES_DE_RECICLAR = 40;
const BROWSER_IDLE_MS = 5 * 60_000;
const RENDER_TIMEOUT_MS = 45_000;
const renderSlots = crearSemaforo(PDF_RENDER_CONCURRENCY);
let rendersEnBrowser = 0;
let rendersActivos = 0;
let idleTimer: NodeJS.Timeout | undefined;

function programarCierreOcioso(): void {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => void cerrarBrowser(), BROWSER_IDLE_MS);
  idleTimer.unref();
}

async function cerrarBrowser(): Promise<void> {
  if (rendersActivos > 0 || !browserPromise) return;
  const p = browserPromise;
  browserPromise = null;
  rendersEnBrowser = 0;
  const b = await p.catch(() => null);
  await b?.close().catch(() => {});
}

// Si el launch() de más abajo rechaza una sola vez (ej. un cold start
// apretado de recursos en Render), browserPromise quedaba cacheado como una
// promesa rechazada para siempre — cada PDF después de esa primera falla
// tiraba "Internal server error" sin volver a intentar levantar Chromium,
// hasta que el proceso se reiniciara solo. Ahora se limpia el caché ante
// cualquier falla (de lanzamiento o de una instancia que se desconectó) para
// que el próximo pedido reintente con un browser nuevo.
async function getBrowser(): Promise<Browser> {
  if (browserPromise) {
    const existing = await browserPromise.catch(() => null);
    if (existing?.connected) return existing;
    browserPromise = null;
  }
  browserPromise = puppeteer
    .launch({
      headless: true,
      // Required to run Chromium as root in most container hosts (e.g. Render).
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    .catch((err) => {
      browserPromise = null;
      throw err;
    });
  return browserPromise;
}

function renderPdfBuffer(makeHtml: () => Promise<string>): Promise<Buffer> {
  return renderSlots(async () => {
    rendersActivos++;
    clearTimeout(idleTimer);
    try {
      if (rendersEnBrowser >= RENDERS_ANTES_DE_RECICLAR) {
        rendersActivos--; // este render todavía no usa el browser viejo
        await cerrarBrowser();
        rendersActivos++;
      }
      rendersEnBrowser++;
      return await renderPdfBufferNow(await makeHtml());
    } finally {
      rendersActivos--;
      programarCierreOcioso();
    }
  });
}

async function renderPdfBufferNow(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  // Defensa en profundidad: el HTML se arma con datos del técnico; si algún
  // campo lograra inyectar un <img>/<link>, Chromium (que corre dentro de la
  // red del servidor) no puede pegarle a nada que no sea el bucket R2.
  const r2Prefix = `${env.R2_PUBLIC_BASE_URL.replace(/\/$/, '')}/`;
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    const u = r.url();
    if (u.startsWith('data:') || u === 'about:blank' || u.startsWith(r2Prefix)) void r.continue();
    else void r.abort();
  });
  try {
    // 'load' (not just 'domcontentloaded') so the <img> tags pointing at R2
    // photo/signature URLs finish loading before the page is printed —
    // otherwise they render blank. setContent doesn't support networkidle0.
    await page.setContent(html, { waitUntil: 'load', timeout: RENDER_TIMEOUT_MS });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, timeout: RENDER_TIMEOUT_MS });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

// Caché de PDFs ya generados: el mismo contenido (ver contentKey) devuelve el mismo PDF sin volver a renderizar.
// Sirve para "Ver PDF" repetido y para que el PDF que se generó al enviar a Odoo ya esté listo cuando el técnico
// lo abre. En memoria y acotada por peso; se vacía sola al reiniciar el servicio (nada persistente).
// Subir PDF_CACHE_VERSION si cambia el layout (buildPrintHtml) para no servir PDFs viejos tras un deploy sin reinicio.
const PDF_CACHE_VERSION = 1;
const PDF_CACHE_MAX_BYTES = 40 * 1024 * 1024;
const pdfCache = new Map<string, Buffer>();
let pdfCacheBytes = 0;
const pdfEnCurso = new Map<string, Promise<Buffer>>();

// Campos que cambian sin que cambie lo que se imprime (estado del envío a Odoo, fechas de guardado).
const CAMPOS_VOLATILES = new Set(['updatedAt', 'odooSync', 'preOdooSync', 'pdfReporte', '__v']);

function contentKey(record: PrintableConformidad, soloPre: boolean): string {
  const json = JSON.stringify(record, (k, v) => (CAMPOS_VOLATILES.has(k) ? undefined : v));
  return createHash('sha1').update(`${PDF_CACHE_VERSION}|${soloPre ? 'pre' : 'full'}|`).update(json).digest('hex');
}

function guardarPdf(key: string, buf: Buffer): void {
  if (buf.length > PDF_CACHE_MAX_BYTES / 4) return; // un PDF desmesurado no vale la pena guardarlo
  pdfCache.set(key, buf);
  pdfCacheBytes += buf.length;
  for (const [k, v] of pdfCache) {
    if (pdfCacheBytes <= PDF_CACHE_MAX_BYTES) break;
    pdfCache.delete(k);
    pdfCacheBytes -= v.length;
  }
}

// Lanza Chromium al arrancar el servicio (best-effort): el primer "Ver PDF" ya no paga el arranque del navegador.
export function warmUpPdf(): void {
  void getBrowser().catch((err) => console.error('PDF_WARMUP_FAILED', err));
}

// PDF de reprogramación de una unidad (ver reprogramacionPdf.ts). Sin caché: se genera una vez por reprogramación.
export function buildReprogramacionPdfBuffer(data: ReprogramacionPdfData): Promise<Buffer> {
  return renderPdfBuffer(async () => buildReprogramacionHtml(data, LOGO_DATA_URI));
}

// Constancia de visita fallida (ver constanciaVisitaFallidaPdf.ts). Sin caché, igual que la de reprogramación.
export function buildConstanciaVisitaFallidaPdfBuffer(data: ConstanciaVisitaFallidaData): Promise<Buffer> {
  return renderPdfBuffer(async () => buildConstanciaVisitaFallidaHtml(data, LOGO_DATA_URI));
}

// Constancia de reprogramación a pedido del cliente, con su firma (ver reprogramacionClientePdf.ts).
export function buildReprogramacionClientePdfBuffer(data: ReprogramacionClienteData): Promise<Buffer> {
  return renderPdfBuffer(async () => buildReprogramacionClienteHtml(data, LOGO_DATA_URI));
}

// Acta de retiro / entrega de equipo (ver retiroEquipoPdf.ts). Sin caché: se genera una vez por acta.
export function buildRetiroEquipoPdfBuffer(data: RetiroEquipoPdfData): Promise<Buffer> {
  return renderPdfBuffer(async () => buildRetiroEquipoHtml(data, LOGO_DATA_URI));
}

// Genera el buffer del PDF sin subirlo a R2 — usado por los endpoints que
// responden con streaming binario o adjuntan el PDF directamente a Odoo en
// memoria, sin almacenamiento persistente.
export async function buildConformidadPdfBuffer(
  record: PrintableConformidad,
  opts?: { soloPre?: boolean },
): Promise<Buffer> {
  const soloPre = opts?.soloPre === true;
  const key = contentKey(record, soloPre);
  const hit = pdfCache.get(key);
  if (hit) {
    pdfCache.delete(key);
    pdfCache.set(key, hit);
    return hit;
  }
  // Dos pedidos iguales a la vez (doble toque, o "Ver PDF" justo mientras se envía a Odoo) comparten el render.
  const enCurso = pdfEnCurso.get(key);
  if (enCurso) return enCurso;
  const p = renderPdfBuffer(() =>
    buildPrintHtml(record, {
      soloPre: opts?.soloPre,
      logoDataUri: LOGO_DATA_URI,
      resolvePhotoSrc: async (foto) => {
        if (!foto.url) return foto.dataUrl;
        return (await resizePhotoForPdf(foto.url)) ?? foto.url;
      },
    }),
  )
    .then((buf) => {
      guardarPdf(key, buf);
      return buf;
    })
    .finally(() => pdfEnCurso.delete(key));
  pdfEnCurso.set(key, p);
  return p;
}

