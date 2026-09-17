'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { IconX } from '@/components/ui/Icons';
import { updateUsuario, resetUsuarioPassword, listTechnicians, ApiError } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import { useAuth } from '@/auth/AuthContext';
import type { Usuario } from '@/lib/types';

export function EditUsuarioPanel({
  usuario,
  onClose,
  onUpdated,
}: {
  usuario: Usuario;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { getIdToken } = useAuth();
  const [nombre, setNombre] = useState(usuario.nombre);
  const [legajo, setLegajo] = useState(usuario.legajo);
  const [odooUserId, setOdooUserId] = useState(usuario.odooUserId != null ? String(usuario.odooUserId) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: technicians } = useApiData(listTechnicians, []);

  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSave() {
    if (!nombre.trim()) {
      setError('Ingresá un nombre.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const token = await getIdToken();
      await updateUsuario(token, usuario._id, {
        nombre: nombre.trim(),
        legajo: legajo.trim(),
        odooUserId: odooUserId === '' ? null : Number(odooUserId),
      });
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword() {
    setResetting(true);
    setResetError(null);
    try {
      const token = await getIdToken();
      const { tempPassword: pw } = await resetUsuarioPassword(token, usuario._id);
      setTempPassword(pw);
    } catch (err) {
      setResetError(err instanceof ApiError ? err.message : 'No se pudo restablecer la contraseña.');
    } finally {
      setResetting(false);
    }
  }

  async function handleCopy() {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable — the password is still visible on screen.
    }
  }

  return (
    <div className="fixed inset-0 z-20">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <Card className="absolute bottom-6 right-6 top-6 flex w-[440px] flex-col p-5">
        <div className="flex items-center justify-between">
          <div className="text-lg font-extrabold">Editar usuario</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition hover:text-text"
          >
            <IconX />
          </button>
        </div>

        <div className="mt-6 flex flex-1 flex-col gap-4">
          <div className="text-[12.5px] font-semibold text-muted">{usuario.email}</div>

          <div>
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">
              Nombre completo
            </div>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellido" />
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">Legajo</div>
            <Input value={legajo} onChange={(e) => setLegajo(e.target.value)} placeholder="Legajo" />
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">
              Cuenta Odoo (calendario)
            </div>
            <Select value={odooUserId} onChange={(e) => setOdooUserId(e.target.value)}>
              <option value="">(sin vincular)</option>
              {technicians?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            <div className="mt-1.5 text-[11.5px] font-semibold text-muted">
              Vincula esta cuenta con el técnico de Odoo para que el calendario de Field Service lo
              muestre con este nombre.
            </div>
          </div>

          {error && <div className="text-[12.5px] font-semibold text-bad">{error}</div>}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>

          <div className="h-px w-full bg-line" />

          <div>
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">Contraseña</div>
            {tempPassword ? (
              <div className="rounded-md bg-surface p-3.5 shadow-inset">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate font-mono text-sm font-bold">{tempPassword}</div>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex-none rounded-md px-2.5 py-1.5 text-xs font-bold text-primary shadow-soft-sm"
                  >
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
                <div className="mt-2 text-[11.5px] font-semibold text-muted">
                  Contraseña nueva — compartila de forma segura, no se va a volver a mostrar.
                </div>
              </div>
            ) : (
              <>
                <div className="mb-2.5 text-[12.5px] font-semibold text-muted">
                  Genera una contraseña temporal nueva para esta cuenta.
                </div>
                <Button
                  variant="ghost"
                  className="rounded-md bg-surface shadow-inset"
                  onClick={handleResetPassword}
                  disabled={resetting}
                >
                  {resetting ? 'Restableciendo...' : 'Restablecer contraseña'}
                </Button>
              </>
            )}
            {resetError && <div className="mt-2 text-[12.5px] font-semibold text-bad">{resetError}</div>}
          </div>

          <Button variant="ghost" className="mt-auto" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </Card>
    </div>
  );
}
