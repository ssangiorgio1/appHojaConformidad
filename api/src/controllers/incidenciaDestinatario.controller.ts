import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../middleware/error.middleware.js';
import { IncidenciaDestinatarioModel } from '../models/IncidenciaDestinatario.js';
import { searchOdooUsers } from '../services/odoo.service.js';
import type { CreateIncidenciaDestinatarioInput, SearchOdooUsersQuery } from '../schemas/incidenciaDestinatario.schema.js';

export const listIncidenciaDestinatarios = asyncHandler(async (_req: Request, res: Response) => {
  const data = await IncidenciaDestinatarioModel.find().sort({ nombre: 1 });
  res.json({ data });
});

export const createIncidenciaDestinatario = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as CreateIncidenciaDestinatarioInput;
  const existing = await IncidenciaDestinatarioModel.findOne({ odooUserId: body.odooUserId });
  if (existing) throw new HttpError(409, 'Ese usuario de Odoo ya está en la lista.');
  const destinatario = await IncidenciaDestinatarioModel.create(body);
  res.status(201).json(destinatario);
});

export const deleteIncidenciaDestinatario = asyncHandler(async (req: Request, res: Response) => {
  const deleted = await IncidenciaDestinatarioModel.findByIdAndDelete(req.params.id);
  if (!deleted) throw new HttpError(404, 'Destinatario not found');
  res.status(204).send();
});

// Buscador de res.users en Odoo (ver searchOdooUsers en odoo.service.ts) para
// elegir a quién agregar arriba por nombre, sin tener que conocer su id de
// memoria.
export const searchOdooUsersController = asyncHandler(async (req: Request, res: Response) => {
  const { q } = req.query as unknown as SearchOdooUsersQuery;
  const data = await searchOdooUsers(q);
  res.json({ data });
});
