import * as ImageManipulator from 'expo-image-manipulator';

// The PDF only ever shows a photo inside a 150x150 CSS box (see printHtml.ts),
// but the stored dataUrl is resized for on-screen detail (1100px wide,
// misc.ts). Re-encoding at PDF-generation time — instead of shrinking the
// stored copy — keeps the higher-res original for in-app/zoom use while
// keeping the exported PDF small.
const PDF_PHOTO_MAX_DIM = 420;
const PDF_PHOTO_QUALITY = 0.5;

export async function shrinkForPdf(dataUrl: string): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(dataUrl, [{ resize: { width: PDF_PHOTO_MAX_DIM } }], {
      compress: PDF_PHOTO_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });
    return `data:image/jpeg;base64,${result.base64}`;
  } catch {
    return dataUrl;
  }
}
