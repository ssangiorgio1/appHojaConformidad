import type { Request, Response } from 'express';
import { UsuarioModel } from '../models/Usuario.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../middleware/error.middleware.js';
import type { UpdateRoleInput } from '../schemas/auth.schema.js';

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const usuario = await UsuarioModel.findById(req.user!.usuarioId);
  if (!usuario) throw new HttpError(404, 'Usuario not found');
  res.json(usuario);
});

export const updateUsuarioRole = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as UpdateRoleInput;
  const usuario = await UsuarioModel.findByIdAndUpdate(req.params.id, { $set: body }, { new: true });
  if (!usuario) throw new HttpError(404, 'Usuario not found');
  res.json(usuario);
});
