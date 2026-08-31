import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Client } from '../config/r2.js';
import { env } from '../config/env.js';

function publicUrlFor(key: string): string {
  return `${env.R2_PUBLIC_BASE_URL.replace(/\/$/, '')}/${key}`;
}

const UPLOAD_TTL_SECONDS = 10 * 60;

export type Fase = 'pre' | 'post';
export type TipoArchivo = 'foto' | 'firma' | 'pdf';

export function buildObjectKey(params: {
  codigoActa: string;
  fecha: string;
  fase: Fase;
  tipo: TipoArchivo;
  contentType: string;
  indice?: number;
}): string {
  const [year, month] = params.fecha.split('-');
  const ext = params.contentType === 'image/png' ? 'png' : 'jpg';
  const timestamp = Date.now();

  if (params.tipo === 'pdf') {
    return `reportes/${year}/${month}/${params.codigoActa}.pdf`;
  }

  if (params.tipo === 'firma') {
    return `firmas/${year}/${month}/${params.codigoActa}_${params.fase}_firma.png`;
  }

  return `fotos/${year}/${month}/${params.codigoActa}_${params.fase}_${timestamp}_${params.indice ?? 0}.${ext}`;
}

export async function createPresignedUploadUrl(key: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: UPLOAD_TTL_SECONDS });
  const publicUrl = publicUrlFor(key);
  return { uploadUrl, publicUrl };
}

// For bytes the API itself produces (e.g. a server-rendered PDF) — no client
// round-trip needed, unlike the presigned-upload flow above which exists so
// the mobile app can upload straight from the device.
export async function uploadBuffer(key: string, body: Buffer, contentType: string): Promise<{ publicUrl: string }> {
  await r2Client.send(new PutObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key, Body: body, ContentType: contentType }));
  return { publicUrl: publicUrlFor(key) };
}
