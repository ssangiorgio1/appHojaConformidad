import type { Request, Response } from 'express';
import { ConformidadModel } from '../models/Conformidad.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../middleware/error.middleware.js';
import { deriveCodigoActa } from '../services/codigoActa.service.js';
import type {
  CreateConformidadInput,
  PatchConformidadInput,
  ListConformidadesQuery,
} from '../schemas/conformidad.schema.js';

function assertOwnedByRequester(req: Request, tecnicoId: unknown) {
  if (req.user!.role === 'tecnico' && String(tecnicoId) !== String(req.user!.usuarioId)) {
    throw new HttpError(403, 'You can only access your own records');
  }
}

export const createConformidad = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as CreateConformidadInput;

  const existing = await ConformidadModel.findOne({ clientId: body.clientId, deletedAt: null });
  if (existing) {
    res.status(200).json(existing);
    return;
  }

  const codigoActa = deriveCodigoActa(body.clientId, body.fecha);

  const record = await ConformidadModel.create({
    clientId: body.clientId,
    codigoActa,
    numero: body.numero,
    cliente: body.cliente,
    fecha: body.fecha,
    hora: body.hora,
    matricula: body.matricula,
    instalador: body.instalador,
    responsableEmpresa: body.responsableEmpresa,
    status: 'pendiente_post',
    tecnicoId: req.user!.usuarioId,
    pre: body.pre,
  });

  res.status(201).json(record);
});

export const patchConformidad = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as PatchConformidadInput;

  const record = await ConformidadModel.findOne({ _id: req.params.id, deletedAt: null });
  if (!record) throw new HttpError(404, 'Conformidad not found');

  assertOwnedByRequester(req, record.tecnicoId);

  if (body.post && record.status === 'borrador_pre') {
    throw new HttpError(400, 'PRE must be finished before submitting POST data');
  }

  const topLevel = ['numero', 'cliente', 'fecha', 'hora', 'matricula', 'instalador', 'responsableEmpresa'] as const;
  for (const key of topLevel) {
    if (body[key] !== undefined) (record as unknown as Record<string, unknown>)[key] = body[key];
  }

  if (body.pre) {
    if (body.pre.checklist) Object.assign(record.pre.checklist, body.pre.checklist);
    if (body.pre.observaciones !== undefined) record.pre.observaciones = body.pre.observaciones;
    if (body.pre.fotos !== undefined) record.pre.fotos = body.pre.fotos as typeof record.pre.fotos;
    if (body.pre.firma !== undefined) record.pre.firma = body.pre.firma as typeof record.pre.firma;
  }

  if (body.post) {
    if (body.post.checklist) Object.assign(record.post.checklist, body.post.checklist);
    if (body.post.observaciones !== undefined) record.post.observaciones = body.post.observaciones;
    if (body.post.fotos !== undefined) record.post.fotos = body.post.fotos as typeof record.post.fotos;
    if (body.post.firma !== undefined) record.post.firma = body.post.firma as typeof record.post.firma;

    if (record.post.firma?.url) {
      record.status = 'completo';
    }
  }

  if (body.equipo) Object.assign(record.equipo, body.equipo);

  await record.save();
  res.json(record);
});

export const listConformidades = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListConformidadesQuery;

  const filter: Record<string, unknown> = { deletedAt: null };

  if (req.user!.role === 'tecnico') {
    filter.tecnicoId = req.user!.usuarioId;
  } else if (query.tecnicoId) {
    filter.tecnicoId = query.tecnicoId;
  }

  if (query.status) filter.status = query.status;
  if (query.matricula) filter.matricula = new RegExp(query.matricula, 'i');
  if (query.imei) filter['equipo.imei'] = new RegExp(query.imei, 'i');
  if (query.numero) filter.numero = new RegExp(query.numero, 'i');

  if (query.fechaDesde || query.fechaHasta) {
    const range: Record<string, Date> = {};
    if (query.fechaDesde) range.$gte = new Date(query.fechaDesde);
    if (query.fechaHasta) range.$lte = new Date(query.fechaHasta);
    filter.fechaHora = range;
  }

  if (query.search) {
    const re = new RegExp(query.search, 'i');
    filter.$or = [{ cliente: re }, { matricula: re }, { instalador: re }, { numero: re }];
  }

  const skip = (query.page - 1) * query.pageSize;
  const [data, total] = await Promise.all([
    ConformidadModel.find(filter).sort({ fechaHora: -1 }).skip(skip).limit(query.pageSize),
    ConformidadModel.countDocuments(filter),
  ]);

  res.json({
    data,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.ceil(total / query.pageSize),
  });
});

export const getConformidadById = asyncHandler(async (req: Request, res: Response) => {
  const record = await ConformidadModel.findOne({ _id: req.params.id, deletedAt: null });
  if (!record) throw new HttpError(404, 'Conformidad not found');
  assertOwnedByRequester(req, record.tecnicoId);
  res.json(record);
});

export const deleteConformidad = asyncHandler(async (req: Request, res: Response) => {
  const record = await ConformidadModel.findOneAndUpdate(
    { _id: req.params.id, deletedAt: null },
    { $set: { deletedAt: new Date() } },
    { new: true },
  );
  if (!record) throw new HttpError(404, 'Conformidad not found');
  res.status(204).send();
});
