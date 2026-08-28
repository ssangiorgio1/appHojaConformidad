import type { Types } from 'mongoose';

export interface AuthUser {
  usuarioId: Types.ObjectId;
  firebaseUid: string;
  email: string;
  nombre: string;
  role: 'tecnico' | 'admin' | 'superadmin' | 'coordinacion' | 'mesa_ayuda';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
