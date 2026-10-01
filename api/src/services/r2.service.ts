import { createHmac } from 'node:crypto';
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

// codigoActa is a short, human-facing display code (8 hex chars — see
// codigoActa.service.ts) meant to be read off a printed PDF, not to gate
// access. Firmas/reportes/fotos live on a public-read R2 bucket with no auth
// of their own, so deriving their object key from codigoActa alone made them
// enumerable: a 32-bit space is brute-forceable via plain HTTP requests
// against the CDN, no API access needed. This HMAC (keyed off the same
// secret already used to encrypt técnicos' Odoo passwords, domain-separated
// by the prefix so it's never the same derived key material) appends a
// 128-bit opaque suffix per (localId, fecha) that can't be guessed or
// brute-forced without the server secret — codigoActa stays short for
// display, the actual file path doesn't.
function deriveOpaqueSuffix(localId: string): string {
  return createHmac('sha256', `r2-object-key:${env.ODOO_LINK_SECRET}`).update(localId).digest('hex').slice(0, 32);
}

export function buildObjectKey(params: {
  codigoActa: string;
  localId: string;
  fecha: string;
  fase: Fase;
  tipo: TipoArchivo;
  contentType: string;
  indice?: number;
}): string {
  const [year, month] = params.fecha.split('-');
  const ext = params.contentType === 'image/png' ? 'png' : params.contentType === 'video/webm' ? 'webm' : 'jpg';
  const timestamp = Date.now();
  const suffix = deriveOpaqueSuffix(params.localId);

  if (params.tipo === 'pdf') {
    return `reportes/${year}/${month}/${params.codigoActa}_${suffix}.pdf`;
  }

  if (params.tipo === 'firma') {
    return `firmas/${year}/${month}/${params.codigoActa}_${params.fase}_${suffix}_firma.png`;
  }

  return `fotos/${year}/${month}/${params.codigoActa}_${params.fase}_${suffix}_${timestamp}_${params.indice ?? 0}.${ext}`;
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
