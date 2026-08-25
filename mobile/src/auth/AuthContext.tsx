import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signOut as fbSignOut, type User } from '@firebase/auth';
import { auth } from './firebase';

WebBrowser.maybeCompleteAuthSession();

const ALLOWED_DOMAIN = 'waragps.com';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  domainError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [domainError, setDomainError] = useState<string | null>(null);

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    extraParams: { hd: ALLOWED_DOMAIN },
  });

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (response?.type !== 'success') return;

    const { id_token } = response.params;
    const credential = GoogleAuthProvider.credential(id_token);

    signInWithCredential(auth, credential)
      .then((cred) => {
        const email = cred.user.email ?? '';
        if (!email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)) {
          setDomainError(`Solo se permiten cuentas @${ALLOWED_DOMAIN}`);
          fbSignOut(auth);
          return;
        }
        setDomainError(null);
      })
      .catch((err) => {
        console.error('Firebase sign-in failed', err);
        setDomainError('No se pudo iniciar sesión. Intentá de nuevo.');
      });
  }, [response]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      domainError,
      signInWithGoogle: async () => {
        setDomainError(null);
        await promptAsync();
      },
      signOut: () => fbSignOut(auth),
    }),
    [user, loading, domainError, promptAsync],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
