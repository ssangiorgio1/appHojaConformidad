import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from '@firebase/auth';
import { auth } from './firebase';
import { ApiError, getMe, type Usuario } from '../api/client';
import { dbClearSynced } from '../db/database';
import { pullMyConformidades } from '../sync/pull';
import { getLastUid, setLastUid } from '../utils/lastUser';

function friendlyError(err: unknown): string {
  if (err instanceof ApiError) return friendlyApiError(err);
  if (err instanceof TypeError) {
    return 'No se pudo conectar con el servidor. Probá de nuevo en un rato.';
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

// Messages the server actually sends from auth.middleware.ts — translated so
// a rejected login says why instead of just bouncing back to /login.
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
  user: User | null;
  usuario: Usuario | null;
  loading: boolean;
  // Set when a signed-in Firebase user got rejected by the API (account
  // disabled, email unverified, no access, API unreachable...).
  authError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string>;
  refreshUsuario: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setUsuario(null);
        setLoading(false);
        return;
      }
      try {
        const token = await u.getIdToken();
        const me = await getMe(token);
        setUsuario(me);
        setAuthError(null);

        // A shared device that just switched to a different técnico gets its
        // local cache wiped for privacy; the same técnico signing back in
        // never loses anything. Either way, re-pull fills in whatever's
        // missing locally (reinstall, cleared cache, another device).
        const lastUid = await getLastUid();
        if (lastUid && lastUid !== u.uid) {
          await dbClearSynced();
        }
        setLastUid(u.uid);
        pullMyConformidades(token, u.uid).catch(() => {});
      } catch (err) {
        setAuthError(friendlyError(err));
        // Only the API actively rejecting this account (disabled, unverified,
        // no access) should sign the user out. A network hiccup or unreachable
        // server — very common at job sites with weak signal, and exactly what
        // happens right after Android kills/relaunches the app while the camera
        // was foregrounded — must never sign the técnico out mid-service: they'd
        // get bounced to /login and lose the in-progress form.
        if (err instanceof ApiError) {
          await fbSignOut(auth);
          setUsuario(null);
        }
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
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
    [user, usuario, loading, authError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
