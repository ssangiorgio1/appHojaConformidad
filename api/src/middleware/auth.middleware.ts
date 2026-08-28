import type { NextFunction, Request, Response } from 'express';
import { firebaseAuth } from '../config/firebase.js';
import { env } from '../config/env.js';
import { UsuarioModel } from '../models/Usuario.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import type { AuthUser } from '../types/express.js';

export const requireAuth = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }

  let decoded;
  try {
    decoded = await firebaseAuth.verifyIdToken(token);
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  const email = decoded.email;
  const emailVerified = decoded.email_verified;

  if (!email || !emailVerified) {
    res.status(403).json({ error: 'Email not verified' });
    return;
  }

  let usuario = await UsuarioModel.findOne({ firebaseUid: decoded.uid });

  if (!usuario) {
    // First login for this Firebase account: try to claim a user pre-seeded
    // by email (no firebaseUid yet) instead of creating a duplicate. This is
    // also how domain exceptions work — a pre-seeded Usuario is allowed in
    // regardless of email domain, since an admin already vetted it.
    usuario = await UsuarioModel.findOneAndUpdate(
      { email: email.toLowerCase(), firebaseUid: { $exists: false } },
      {
        $set: {
          firebaseUid: decoded.uid,
          nombre: decoded.name ?? '',
        },
      },
      { new: true },
    );
  }

  if (!usuario) {
    // No pre-seeded record for this email — this is a brand-new, unvetted
    // account, so the domain restriction applies here, server-side. The
    // client's Google `hd` param is only a UX hint and must never be trusted
    // on its own.
    if (!email.toLowerCase().endsWith(`@${env.ALLOWED_EMAIL_DOMAIN.toLowerCase()}`)) {
      res.status(403).json({ error: `Only @${env.ALLOWED_EMAIL_DOMAIN} accounts are allowed` });
      return;
    }

    usuario = await UsuarioModel.create({
      firebaseUid: decoded.uid,
      email: email.toLowerCase(),
      nombre: decoded.name ?? '',
      role: 'tecnico',
    });
  }

  if (!usuario.activo) {
    res.status(403).json({ error: 'Account disabled' });
    return;
  }

  const authUser: AuthUser = {
    usuarioId: usuario._id,
    firebaseUid: usuario.firebaseUid ?? decoded.uid,
    email: usuario.email,
    nombre: usuario.nombre,
    role: usuario.role as AuthUser['role'],
  };
  req.user = authUser;
  next();
});

export function requireRole(roles: Array<AuthUser['role']>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
