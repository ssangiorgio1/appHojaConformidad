'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { IconLock } from '@/components/ui/Icons';

export default function LoginPage() {
  const { signIn, usuario, authError } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Only navigate once the API has actually accepted the account (`usuario`
  // populated) — signIn() resolving just means Firebase liked the password;
  // the API's own checks (domain, activo, email verificado) happen after,
  // asynchronously, in AuthContext's onAuthStateChanged handler.
  useEffect(() => {
    if (usuario) router.replace('/');
  }, [usuario, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const message = error || authError;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg">
      <div className="w-[420px] rounded-lg bg-surface p-11 pb-9 shadow-soft">
        <div className="flex flex-col items-center gap-6">
          <Image src="/logo-wara.png" alt="WARA" width={160} height={44} className="h-10 w-auto" priority />

          <div className="text-center">
            <div className="text-xl font-extrabold">Panel administrativo</div>
            <div className="mt-1.5 text-sm font-medium text-muted">Hojas de conformidad de instalación</div>
          </div>

          <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3.5">
            <Input
              type="email"
              placeholder="nombre@waragps.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <Input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            {message && <div className="text-xs font-semibold text-bad">{message}</div>}
            <Button type="submit" disabled={submitting} className="w-full justify-center">
              {submitting ? 'Ingresando...' : 'Ingresar'}
            </Button>
          </form>

          <div className="flex items-center gap-2 rounded-full bg-bg px-4 py-2 text-xs font-semibold text-muted">
            <IconLock size={13} />
            Solo cuentas <b className="text-text">@waragps.com</b>
          </div>

          <div className="h-px w-full bg-line" />

          <div className="text-center text-xs leading-relaxed text-muted">
            ¿No tenés acceso todavía? Pedile a un administrador que revise tu cuenta.
          </div>
        </div>
      </div>
    </div>
  );
}
