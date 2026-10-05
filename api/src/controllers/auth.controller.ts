import type { Request, Response } from 'express';
import { UsuarioModel } from '../models/Usuario.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../middleware/error.middleware.js';
import type { CreateUsuarioInput, UpdateMeInput, UpdateUsuarioInput } from '../schemas/auth.schema.js';
import { audit } from '../services/audit.service.js';
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

  // Covers both directions — demoting an existing superadmin AND promoting
  // someone else to superadmin — so a plain admin can never touch the
  // superadmin role at all, only another superadmin can.
  if (
    body.role !== undefined &&
    body.role !== target.role &&
    (target.role === 'superadmin' || body.role === 'superadmin') &&
    req.user!.role !== 'superadmin'
  ) {
    throw new HttpError(403, 'Solo un superadmin puede otorgar o quitar el rol superadmin.');
  }

  const usuario = await UsuarioModel.findByIdAndUpdate(req.params.id, { $set: body }, { new: true });
  if (!usuario) throw new HttpError(404, 'Usuario not found');
  await audit(req, 'usuario.update', target.email, {
    cambios: body,
    antes: { role: target.role, activo: target.activo },
  });
  res.json(serializeUsuario(usuario));
});

export const resetUsuarioPassword = asyncHandler(async (req: Request, res: Response) => {
  const usuario = await UsuarioModel.findById(req.params.id);
  if (!usuario) throw new HttpError(404, 'Usuario not found');
  if (!usuario.firebaseUid) throw new HttpError(400, 'Usuario has no Firebase account yet');

  const tempPassword = await resetFirebasePassword(usuario.firebaseUid);
  await audit(req, 'usuario.reset-password', usuario.email);
  res.json({ tempPassword });
});

export const createUsuario = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as CreateUsuarioInput;

  if (body.role === 'superadmin' && req.user!.role !== 'superadmin') {
    throw new HttpError(403, 'Solo un superadmin puede crear una cuenta superadmin.');
  }

  // Este endpoint hace upsert por email (findOneAndUpdate más abajo) — sin
  // este chequeo, cualquier admin podía "crear" un usuario con el email del
  // superadmin protegido y pisarle el rol/activo, exactamente lo que
  // isProtectedSuperadmin dice que nunca debería poder pasar (ver el mismo
  // chequeo en updateUsuario).
  if (isProtectedSuperadmin(body.email)) {
    throw new HttpError(403, 'Esta cuenta es intocable: no se puede crear ni editar por acá.');
  }

  const { uid, tempPassword } = await ensureFirebaseUser(body.email);
  const usuario = await UsuarioModel.findOneAndUpdate(
    { email: body.email },
    { $set: { nombre: body.nombre, legajo: body.legajo ?? '', role: body.role, activo: body.activo, firebaseUid: uid } },
    { upsert: true, new: true },
  );
  await audit(req, 'usuario.create', body.email, { role: body.role, activo: body.activo });
  res.status(201).json({ usuario: serializeUsuario(usuario), tempPassword });
});
