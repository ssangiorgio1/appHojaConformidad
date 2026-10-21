'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { IconX } from '@/components/ui/Icons';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import { htmlHojaRuta, imprimirHojaRuta } from './imprimirHojaRuta';
import type { Estado } from './logica';
import type { TransferenciaMock } from './mock';

// Visor de la hoja de ruta tal como se imprime (mismo documento), con las firmas si ya se firmó.
export function HojaRutaVisor({ estado, transferencia: t, onClose }: { estado: Estado; transferencia: TransferenciaMock; onClose: () => void }) {
  useBodyScrollLock();
  const html = useMemo(() => htmlHojaRuta(estado, t), [estado, t]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 lg:p-6">
      <div className="absolute inset-0 animate-sheet-fade bg-black/45" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-3xl flex-col overflow-hidden bg-surface lg:h-[92dvh] lg:rounded-lg">
        <div className="flex items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-primary-500">Hoja de ruta</div>
            <div className="text-base font-extrabold">{t.id}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button className="text-xs" onClick={() => imprimirHojaRuta(estado, t)}>
              Imprimir
            </Button>
            <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition hover:text-text">
              <IconX size={18} />
            </button>
          </div>
        </div>
        <iframe title={`Hoja de ruta ${t.id}`} srcDoc={html} className="min-h-0 w-full flex-1 bg-white" />
      </div>
    </div>
  );
}
