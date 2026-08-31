import { buildPrintHtml as buildPrintHtmlShared, type ConformidadRecord } from '@wara/shared';
import { shrinkForPdf } from './pdfImage';

// Re-encode down to the size the PDF actually displays (120x120 CSS box)
// instead of embedding the full on-screen-resolution copy — that's what
// was blowing up the PDF to several MB per photo set. Mobile-only: local
// drafts can still have a dataUrl; the API's records only ever have `url`.
export async function buildPrintHtml(record: ConformidadRecord, opts?: { logoDataUri?: string }): Promise<string> {
  return buildPrintHtmlShared(record, {
    logoDataUri: opts?.logoDataUri,
    resolvePhotoSrc: async (foto) => (foto.dataUrl ? await shrinkForPdf(foto.dataUrl) : foto.url),
  });
}
