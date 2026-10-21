'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { IconX } from '@/components/ui/Icons';
import { useToast } from '@/components/ui/Toast';
import { rechazarPropuestaIncidencia, ApiError } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import type { SubtareaIncidencia } from '@/lib/types';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';

// Coordinación rechaza la propuesta de fecha y hora del técnico. No toca Odoo: la unidad ya está "En espera" y
// queda en Pendientes para reprogramarla a mano. El motivo es obligatorio.
export function RechazarPropuestaPanel({
  incidencia,
  onClose,
  onUpdated,
}: {
  incidencia: SubtareaIncidencia;
  onClose: () => void;
  onUpdated: () => Promise<void> | void;
}) {
  useBodyScrollLock();
  const { getIdToken } = useAuth();
  const toast = useToast();
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRechazar() {
    if (!motivo.trim()) {
      setError('Escribí por qué se rechaza.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await rechazarPropuestaIncidencia(await getIdToken(), incidencia._id, motivo.trim());
      await onUpdated();
      toast('Propuesta rechazada correctamente.');
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo rechazar la propuesta.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 animate-sheet-fade bg-black/45" onClick={onClose} />
      <Card className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col overflow-y-auto overscroll-contain rounded-b-none p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] animate-sheet-up lg:overflow-visible lg:rounded-b-lg lg:animate-none lg:inset-x-auto lg:bottom-6 lg:right-6 lg:top-6 lg:max-h-none lg:w-[440px] lg:pb-5">
        <div className="flex items-center justify-between">
          <div className="text-lg font-extrabold">Rechazar propuesta</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition hover:text-text"
          >
            <IconX />
          </button>
        </div>

        <div className="mt-2 text-[12.5px] font-semibold text-muted">
          {incidencia.subtareaNombre || `Subtarea #${incidencia.subtareaOdooId}`} — la unidad sigue &ldquo;En espera&rdquo; y pasa a
          Pendientes para reprogramarla a mano.
        </div>

        <div className="mt-5 flex flex-1 flex-col gap-4">
          <div>
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">Motivo del rechazo</div>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: ese día no hay técnicos disponibles"
              className="min-h-[90px] w-full resize-none rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm font-medium outline-none"
            />
          </div>

          {error && <div className="text-[12.5px] font-semibold text-bad">{error}</div>}

          <div className="mt-auto flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleRechazar} disabled={saving}>
              {saving ? 'Rechazando...' : 'Rechazar'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
