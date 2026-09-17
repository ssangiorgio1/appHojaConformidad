'use client';

import { Card } from '@/components/ui/Card';
import { IconX } from '@/components/ui/Icons';
import type { OdooTechnician } from '@/lib/types';
import { TECHNICIAN_PALETTE, resolveTechnicianSwatch, type TechnicianColorMap } from '@/lib/technicianColors';

export function TechnicianColorPicker({
  technicians,
  overrides,
  onChange,
  onClose,
}: {
  technicians: OdooTechnician[];
  overrides: TechnicianColorMap;
  onChange: (technicianId: number, key: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-20">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <Card className="absolute bottom-6 right-6 top-6 flex w-[380px] flex-col p-5">
        <div className="flex items-center justify-between">
          <div className="text-lg font-extrabold">Colores por técnico</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition hover:text-text"
          >
            <IconX />
          </button>
        </div>

        <div className="mt-5 flex flex-1 flex-col gap-4 overflow-y-auto">
          {technicians.map((t) => {
            const current = resolveTechnicianSwatch(t.id, overrides);
            return (
              <div key={t.id}>
                <div className="mb-1.5 truncate text-[12.5px] font-bold">{t.name}</div>
                <div className="flex flex-wrap gap-2">
                  {TECHNICIAN_PALETTE.map((swatch) => (
                    <button
                      key={swatch.key}
                      type="button"
                      title={swatch.label}
                      onClick={() => onChange(t.id, swatch.key)}
                      className={`h-7 w-7 rounded-full ${swatch.dot} transition ${
                        current.key === swatch.key ? 'ring-2 ring-offset-2 ring-primary-600' : 'opacity-60 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {!technicians.length && <div className="text-sm font-semibold text-muted">No hay técnicos para mostrar.</div>}
        </div>
      </Card>
    </div>
  );
}
