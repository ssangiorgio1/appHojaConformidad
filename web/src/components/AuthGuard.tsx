'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/auth/AuthContext';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { firebaseUser, usuario, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!firebaseUser || !usuario)) {
      router.replace('/login');
    }
  }, [loading, firebaseUser, usuario, router]);

  if (loading || !firebaseUser || !usuario) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="text-sm font-semibold text-muted">Cargando...</div>
      </div>
    );
  }

  return <>{children}</>;
}
