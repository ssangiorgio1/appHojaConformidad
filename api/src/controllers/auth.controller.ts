import type { Request, Response } from 'express';
import { UsuarioModel } from '../models/Usuario.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../middleware/error.middleware.js';
import type { CreateUsuarioInput, UpdateMeInput, UpdateUsuarioInput } from '../schemas/auth.schema.js';
import { ensureFirebaseUser, isProtectedSuperadmin, resetFirebasePassword, serializeUsuario } from '../services/usuario.service.js';

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const usuario = await UsuarioModel.findById(req.user!.usuarioId);
  if (!usuario) throw new HttpError(404, 'Usuario not found');
  res.json(serializeUsuario(usuario));
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as UpdateMeInput;
  const canRename = req.user!.role === 'admin' || req.user!.role === 'superadmin';
  if (!canRename && (body.nombre !== undefined || body.legajo !== undefined)) {
    throw new HttpError(403, 'Solo un administrador puede modificar tu nombre o tu legajo.');
  }

  const usuario = await UsuarioModel.findByIdAndUpdate(req.user!.usuarioId, { $set: body }, { new: true });
  if (!usuario) throw new HttpError(404, 'Usuario not found');
  res.json(serializeUsuario(usuario));
});

export const listUsuarios = asyncHandler(async (_req: Request, res: Response) => {
  const usuarios = await UsuarioModel.find().sort({ createdAt: -1 });
  res.json(usuarios.map(serializeUsuario));
});

export const updateUsuario = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as UpdateUsuarioInput;

  const target = await UsuarioModel.findById(req.params.id);
  if (!target) throw new HttpError(404, 'Usuario not found');

  if (isProtectedSuperadmin(target.email) && (body.role !== undefined || body.activo !== undefined)) {
    throw new HttpError(403, 'Esta cuenta es intocable: no se puede cambiar su rol ni desactivarla.');
  }

  if (target.role === 'superadmin' && body.activo === false) {
    throw new HttpError(403, 'No se puede desactivar una cuenta superadmin.');
  }

  if (
    target.role === 'superadmin' &&
    body.role !== undefined &&
    body.role !== target.role &&
    req.user!.role !== 'superadmin'
  ) {
    throw new HttpError(403, 'Solo un superadmin puede cambiar el rol de otra cuenta superadmin.');
  }

  const usuario = await UsuarioModel.findByIdAndUpdate(req.params.id, { $set: body }, { new: true });
  if (!usuario) throw new HttpError(404, 'Usuario not found');
  res.json(serializeUsuario(usuario));
});

export const resetUsuarioPassword = asyncHandler(async (req: Request, res: Response) => {
  const usuario = await UsuarioModel.findById(req.params.id);
  if (!usuario) throw new HttpError(404, 'Usuario not found');
  if (!usuario.firebaseUid) throw new HttpError(400, 'Usuario has no Firebase account yet');

  const tempPassword = await resetFirebasePassword(usuario.firebaseUid);
  res.json({ tempPassword });
});

export const createUsuario = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as CreateUsuarioInput;
  const { uid, tempPassword } = await ensureFirebaseUser(body.email);
  const usuario = await UsuarioModel.findOneAndUpdate(
    { email: body.email },
    { $set: { nombre: body.nombre, legajo: body.legajo ?? '', role: body.role, activo: body.activo, firebaseUid: uid } },
    { upsert: true, new: true },
  );
  res.status(201).json({ usuario: serializeUsuario(usuario), tempPassword });
});
