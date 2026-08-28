import { randomBytes } from 'node:crypto';
import { firebaseAuth } from '../config/firebase.js';
import { env } from '../config/env.js';
import type { UsuarioModel } from '../models/Usuario.js';

// The one superadmin account that must always stay reachable — its role and
// active status are immutable through the API, regardless of who's asking.
export function isProtectedSuperadmin(email: string): boolean {
  return email.toLowerCase() === env.PROTECTED_SUPERADMIN_EMAIL.toLowerCase();
}

// Adds the client-facing `protegido` flag so the UI can grey out role/activo
// controls for the protected account without hardcoding its email itself.
export function serializeUsuario(usuario: InstanceType<typeof UsuarioModel>) {
  return { ...usuario.toObject(), protegido: isProtectedSuperadmin(usuario.email) };
}

function generatePassword(): string {
  // Not meant to be memorized — the real user resets it (or is given it once
  // and told to change it). Just needs to satisfy Firebase's min length.
  return randomBytes(16).toString('base64url');
}

// Finds the Firebase Auth account for `email`, creating one with a random
// temporary password if it doesn't exist yet. `tempPassword` is only set
// when a new account was created — the caller is responsible for showing it
// exactly once.
export async function ensureFirebaseUser(email: string): Promise<{ uid: string; tempPassword?: string }> {
  try {
    const existing = await firebaseAuth.getUserByEmail(email);
    return { uid: existing.uid };
  } catch {
    const tempPassword = generatePassword();
    const created = await firebaseAuth.createUser({ email, password: tempPassword, emailVerified: true });
    return { uid: created.uid, tempPassword };
  }
}

// Sets a fresh random password on an existing Firebase account — used by an
// admin to reset a user's password. Same one-time-display contract as
// ensureFirebaseUser's tempPassword.
export async function resetFirebasePassword(uid: string): Promise<string> {
  const tempPassword = generatePassword();
  await firebaseAuth.updateUser(uid, { password: tempPassword });
  return tempPassword;
}
