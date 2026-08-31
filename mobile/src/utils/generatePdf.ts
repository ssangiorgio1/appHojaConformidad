import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { ConformidadRecord } from '@wara/shared';
import { buildPrintHtml } from './printHtml';
import { getLogoDataUri } from './logo';

export async function generateAndShareRecordPdf(record: ConformidadRecord): Promise<void> {
  const logoDataUri = await getLogoDataUri();
  const html = await buildPrintHtml(record, { logoDataUri });
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Hoja de Conformidad' });
  }
}
