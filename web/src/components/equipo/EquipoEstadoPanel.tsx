'use client';

import { Card } from '@/components/ui/Card';
import { IconX } from '@/components/ui/Icons';
import { EquipoEstadoLoader } from './EquipoEstadoLoader';
import { GraficasEquipo } from './GraficasEquipo';

// Panel lateral con el estado en vivo de UN equipo (mismo contenido que Atilio, en versión
// compacta). Cambiar de equipo reemplaza la consulta.
export function EquipoEstadoPanel({ equipoId, onClose }: { equipoId: number; onClose: () => void }) {
  return (
    <Card className="flex h-[calc(100vh-15rem)] min-h-[420px] w-[440px] flex-none flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3">
        <span className="text-sm font-extrabold text-text">Estado del equipo</span>
        <div className="flex items-center gap-3">
          <a href={`/atilio?equipo=${equipoId}`} target="_blank" rel="noopener" className="text-xs font-bold text-primary-600">
            Abrir en Atilio
          </a>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-muted transition hover:text-text">
            <IconX />
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <EquipoEstadoLoader key={equipoId} equipoId={equipoId} />
        <GraficasEquipo key={`g-${equipoId}`} equipoId={equipoId} compacto />
      </div>
    </Card>
  );
}
