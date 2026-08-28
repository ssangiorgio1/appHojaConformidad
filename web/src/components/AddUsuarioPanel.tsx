'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { IconX } from '@/components/ui/Icons';
import { createUsuario, ApiError } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import type { UsuarioRole } from '@/lib/types';

const ROLE_OPTIONS: { value: UsuarioRole; label: string }[] = [
  { value: 'tecnico', label: 'Técnico' },
  { value: 'coordinacion', label: 'Coordinación' },
  { value: 'mesa_ayuda', label: 'Mesa de ayuda' },
  { value: 'admin', label: 'Admin' },
  { value: 'superadmin', label: 'Superadmin' },
];

export function AddUsuarioPanel({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { getIdToken } = useAuth();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [legajo, setLegajo] = useState('');
  const [role, setRole] = useState<UsuarioRole>('tecnico');
  const [activo, setActivo] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ email: string; tempPassword?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCreate() {
    if (!nombre.trim() || !email.trim()) {
      setError('Completá nombre y email.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const token = await getIdToken();
      const { usuario, tempPassword } = await createUsuario(token, {
        nombre: nombre.trim(),
        email: email.trim(),
        legajo: legajo.trim() || undefined,
        role,
        activo,
      });
      setResult({ email: usuario.email, tempPassword });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el usuario.');
    } finally {
      setSaving(false);
    }
  }

  function handleFinish() {
    onCreated();
  }

  async function handleCopy() {
    if (!result?.tempPassword) return;
    try {
      await navigator.clipboard.writeText(result.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable — the password is still visible on screen.
    }
  }

  return (
    <div className="fixed inset-0 z-20">
      <div className="absolute inset-0 bg-[#26201f]/28" onClick={onClose} />
      <Card className="absolute bottom-6 right-6 top-6 flex w-[440px] flex-col p-5">
        <div className="flex items-center justify-between">
          <div className="text-lg font-extrabold">{result ? 'Usuario creado' : 'Dar de alta usuario'}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition hover:text-text"
          >
            <IconX />
          </button>
        </div>

        {result ? (
          <div className="mt-6 flex flex-1 flex-col">
            <div className="text-sm font-semibold text-muted">
              La cuenta de <span className="font-bold text-text">{result.email}</span> está lista.
            </div>

            {result.tempPassword ? (
              <div className="mt-4 rounded-md bg-surface p-3.5 shadow-inset">
                <div className="text-[11px] font-extrabold uppercase tracking-wide text-muted">
                  Contraseña temporal
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <div className="truncate font-mono text-sm font-bold">{result.tempPassword}</div>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex-none rounded-md px-2.5 py-1.5 text-xs font-bold text-primary shadow-soft-sm"
                  >
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
                <div className="mt-2 text-[11.5px] font-semibold text-muted">
                  Compartila de forma segura — no se va a volver a mostrar.
                </div>
              </div>
            ) : (
              <div className="mt-4 text-[12.5px] font-semibold text-muted">
                Ya existía una cuenta de Firebase con ese email; se usó la contraseña actual.
              </div>
            )}

            <Button className="mt-auto" onClick={handleFinish}>
              Listo
            </Button>
          </div>
        ) : (
          <div className="mt-6 flex flex-1 flex-col gap-4">
            <div>
              <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">
                Nombre completo
              </div>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellido" />
            </div>

            <div>
              <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">Email</div>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@waragps.com"
                autoCapitalize="none"
              />
            </div>

            <div>
              <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">
                Legajo (opcional)
              </div>
              <Input value={legajo} onChange={(e) => setLegajo(e.target.value)} placeholder="Legajo" />
            </div>

            <div>
              <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">Rol</div>
              <div className="flex gap-1.5 rounded-md bg-surface p-1 shadow-inset">
                {ROLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRole(opt.value)}
                    className={`flex-1 rounded-md px-2 py-2 text-xs font-bold transition ${
                      role === opt.value ? 'bg-surface text-primary shadow-soft-sm' : 'text-muted'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md bg-surface p-3.5 shadow-inset">
              <div className="text-[13px] font-bold">Cuenta activa</div>
              <ToggleSwitch checked={activo} onChange={setActivo} />
            </div>

            {error && <div className="text-[12.5px] font-semibold text-bad">{error}</div>}

            <div className="mt-auto flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? 'Creando...' : 'Crear usuario'}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
