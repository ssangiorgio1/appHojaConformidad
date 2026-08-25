import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { deriveCodigoActa } from '../services/codigoActa.service.js';
import { buildObjectKey, createPresignedUploadUrl } from '../services/r2.service.js';
import type { PresignedUrlInput } from '../schemas/upload.schema.js';

export const createPresignedUrl = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as PresignedUrlInput;

  const codigoActa = deriveCodigoActa(body.localId, body.fecha);
  const key = buildObjectKey({
    codigoActa,
    fecha: body.fecha,
    fase: body.fase,
    tipo: body.tipo,
    contentType: body.contentType,
    indice: body.indice,
  });
  const { uploadUrl, publicUrl } = await createPresignedUploadUrl(key, body.contentType);

  res.json({ codigoActa, key, uploadUrl, publicUrl });
});
