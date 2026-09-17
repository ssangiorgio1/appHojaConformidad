'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { IconLock } from '@/components/ui/Icons';

type Mode = 'signin' | 'reset';

export default function LoginPage() {
  const { signIn, resetPassword, usuario, authError } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
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
    setInfo(null);
    setSubmitting(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        await resetPassword(email);
        setInfo('Te mandamos un email para restablecer tu contraseña.');
        setMode('signin');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function toggleMode() {
    setMode((m) => (m === 'signin' ? 'reset' : 'signin'));
    setError(null);
    setInfo(null);
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
            {mode === 'signin' && (
              <Input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            )}
            {message && <div className="text-xs font-semibold text-bad">{message}</div>}
            {info && <div className="text-xs font-semibold text-ok">{info}</div>}
            <Button type="submit" disabled={submitting} className="w-full justify-center">
              {submitting
                ? mode === 'signin'
                  ? 'Ingresando...'
                  : 'Enviando...'
                : mode === 'signin'
                  ? 'Ingresar'
                  : 'Enviar email'}
            </Button>
          </form>

          <button
            type="button"
            onClick={toggleMode}
            disabled={submitting}
            className="text-xs font-bold text-primary disabled:opacity-40"
          >
            {mode === 'signin' ? '¿Olvidaste tu contraseña?' : 'Volver a iniciar sesión'}
          </button>

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
