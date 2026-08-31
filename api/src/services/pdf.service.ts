import puppeteer, { type Browser } from 'puppeteer';
import { buildPrintHtml, type PrintableConformidad } from '@wara/shared';
import { buildObjectKey, uploadBuffer } from './r2.service.js';

// One Chromium instance shared across requests — launching it per-request
// would add several seconds to every PDF generation.
let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      // Required to run Chromium as root in most container hosts (e.g. Render).
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browserPromise;
}

async function renderPdfBuffer(record: PrintableConformidad): Promise<Buffer> {
  const html = await buildPrintHtml(record);
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
