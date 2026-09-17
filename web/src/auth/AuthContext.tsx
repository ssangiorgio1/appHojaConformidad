'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { ApiError, getMe } from '@/lib/api';
import type { Usuario } from '@/lib/types';

function friendlyError(err: unknown): string {
  if (err instanceof ApiError) return friendlyApiError(err);
  if (err instanceof TypeError) {
    return 'No se pudo conectar con el servidor de la API. ¿Está corriendo?';
  }
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-email':
      return 'El email no es válido.';
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Email o contraseña incorrectos.';
    default:
      return (err as Error)?.message || 'Ocurrió un error. Intentá de nuevo.';
  }
}

// Messages the server actually sends from auth.middleware.ts — translated
// so a rejected login says WHY instead of just bouncing back to /login.
function friendlyApiError(err: ApiError): string {
  switch (err.message) {
    case 'Account disabled':
      return 'Tu cuenta está desactivada. Contactá a un administrador.';
    case 'Email not verified':
      return 'Todavía no verificaste tu email. Revisá tu casilla de correo.';
    default:
      if (err.message.startsWith('Only @')) {
        return 'Tu cuenta no tiene acceso todavía. Contactá a un administrador.';
      }
      return err.message;
  }
}

interface AuthContextValue {
  firebaseUser: User | null;
  usuario: Usuario | null;
  loading: boolean;
  // Set when a signed-in Firebase user got rejected by the API (account
  // disabled, email unverified, wrong domain, API unreachable...) — the
  // login page shows this so a bounce-back to /login isn't unexplained.
  authError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string>;
  refreshUsuario: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setFirebaseUser(u);
      if (!u) {
        setUsuario(null);
        setLoading(false);
        return;
      }
      try {
        const token = await u.getIdToken();
        const me = await getMe(token);
        if (me.role === 'tecnico') {
          throw new Error('Los técnicos no tienen acceso al panel web. Usá la app móvil para cargar tus hojas de conformidad.');
        }
        setUsuario(me);
        setAuthError(null);
      } catch (err) {
        // Domain rejected, account disabled, unverified email, técnico
        // role, API unreachable... — don't leave a half-authenticated
        // session hanging around, but say why instead of silently bouncing.
        setAuthError(friendlyError(err));
        await fbSignOut(auth);
        setUsuario(null);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      usuario,
      loading,
      authError,
      signIn: async (email, password) => {
        try {
          setAuthError(null);
          await signInWithEmailAndPassword(auth, email.trim(), password);
        } catch (err) {
          throw new Error(friendlyError(err));
        }
      },
      resetPassword: async (email) => {
        try {
          await sendPasswordResetEmail(auth, email.trim());
        } catch (err) {
          throw new Error(friendlyError(err));
        }
      },
      signOut: () => fbSignOut(auth),
      getIdToken: async () => {
        if (!auth.currentUser) throw new Error('No hay sesión activa');
        return auth.currentUser.getIdToken();
      },
      refreshUsuario: async () => {
        if (!auth.currentUser) return;
        const token = await auth.currentUser.getIdToken();
        setUsuario(await getMe(token));
      },
    }),
    [firebaseUser, usuario, loading, authError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
