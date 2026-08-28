import { createPresignedUploadUrl } from '../api/client';

export interface UploadResult {
  url: string;
  key: string;
}

// `source` is a data: URI (JPEG photo or PNG signature) or, for a PDF, a
// local file:// URI (what expo-print's printToFileAsync returns) — fetch()
// handles both on native. The presigned-url endpoint's contentType accepts
// image/jpeg|image/png|application/pdf (api/src/schemas/upload.schema.ts).
export async function uploadAsset(
  idToken: string,
  params: {
    localId: string;
    fecha: string;
    fase: 'pre' | 'post';
    tipo: 'foto' | 'firma' | 'pdf';
    source: string;
    indice?: number;
  },
): Promise<UploadResult> {
  const contentType =
    params.tipo === 'pdf' ? 'application/pdf' : params.source.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';

  const { uploadUrl, publicUrl, key } = await createPresignedUploadUrl(idToken, {
    localId: params.localId,
    fecha: params.fecha,
    fase: params.fase,
    tipo: params.tipo,
    contentType,
    indice: params.indice,
  });

  const blob = await (await fetch(params.source)).blob();
  const putRes = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: blob });
  if (!putRes.ok) throw new Error(`Upload failed with status ${putRes.status}`);

  return { url: publicUrl, key };
}
