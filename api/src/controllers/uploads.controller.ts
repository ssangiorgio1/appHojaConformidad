import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ConformidadModel } from '../models/Conformidad.js';
import { assertOwnedByRequester } from './conformidades.controller.js';
import { deriveCodigoActa } from '../services/codigoActa.service.js';
import { buildObjectKey, createPresignedUploadUrl } from '../services/r2.service.js';
import type { PresignedUrlInput } from '../schemas/upload.schema.js';

export const createPresignedUrl = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as PresignedUrlInput;

  // localId is the conformidad's clientId. If one already claimed it, only
  // its own técnico may request upload URLs for it — otherwise any
  // authenticated user could get a presigned PUT for another técnico's
  // already-submitted photos/firma and silently overwrite them in R2. A
  // record that doesn't exist yet is safe to allow: clientId is unique at
  // creation time (see createConformidad), so at worst a race here just gets
  // clobbered by the real owner's own later upload to the same deterministic
  // key — it can never be used to plant content under someone else's acta.
  const existing = await ConformidadModel.findOne({ clientId: body.localId, deletedAt: null }).select('tecnicoId');
  if (existing) assertOwnedByRequester(req, existing.tecnicoId);

  const codigoActa = deriveCodigoActa(body.localId, body.fecha);
  const key = buildObjectKey({
    codigoActa,
    localId: body.localId,
    fecha: body.fecha,
    fase: body.fase,
    tipo: body.tipo,
    contentType: body.contentType,
    indice: body.indice,
  });
  const { uploadUrl, publicUrl } = await createPresignedUploadUrl(key, body.contentType);

  res.json({ codigoActa, key, uploadUrl, publicUrl });
});
