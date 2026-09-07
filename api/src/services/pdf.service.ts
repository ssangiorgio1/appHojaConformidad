import puppeteer, { type Browser } from 'puppeteer';
import sharp from 'sharp';
import { buildPrintHtml, type PrintableConformidad } from '@wara/shared';
import { buildObjectKey, uploadBuffer } from './r2.service.js';

// Las fotos ya vienen resizeadas a ~1100px/JPEG 72% del lado del técnico
// (para poder hacer zoom en el panel web) — pero en el PDF se imprimen en
// cajas de apenas 120x120px, y Chromium al exportar a PDF embebe el archivo
// fuente completo tal cual lo carga, no lo reescala a lo que realmente se ve
// impreso. Un acta con 15-19 fotos terminaba pesando varios MB. Se vuelven a
// re-encodar acá, server-side, a un tamaño apropiado para ese layout — el
// original en R2 nunca se toca, sigue sirviendo para el zoom del panel.
const PDF_PHOTO_MAX_DIM = 420;
const PDF_PHOTO_QUALITY = 60;

async function resizePhotoForPdf(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url);
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

async function renderPdfBuffer(record: PrintableConformidad): Promise<Buffer> {
  const html = await buildPrintHtml(record, {
    resolvePhotoSrc: async (foto) => {
      if (!foto.url) return foto.dataUrl;
      return (await resizePhotoForPdf(foto.url)) ?? foto.url;
    },
  });
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // 'load' (not just 'domcontentloaded') so the <img> tags pointing at R2
    // photo/signature URLs finish loading before the page is printed —
    // otherwise they render blank. setContent doesn't support networkidle0.
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

export async function generateConformidadPdf(
  record: PrintableConformidad & { codigoActa: string },
): Promise<{ url: string; key: string }> {
  const buffer = await renderPdfBuffer(record);
  const key = buildObjectKey({ codigoActa: record.codigoActa, fecha: record.fecha, fase: 'post', tipo: 'pdf', contentType: 'application/pdf' });
  const { publicUrl } = await uploadBuffer(key, buffer, 'application/pdf');
  return { url: publicUrl, key };
}
