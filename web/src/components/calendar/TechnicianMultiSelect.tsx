'use client';

import { useEffect, useRef, useState } from 'react';
import { IconChevronDown } from '@/components/ui/Icons';
import type { OdooTechnician } from '@/lib/types';

export function TechnicianMultiSelect({
  technicians,
  selected,
  onChange,
}: {
  technicians: OdooTechnician[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  function toggle(id: number) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  const label =
    selected.length === 0
      ? 'Todos los técnicos'
      : selected.length === 1
        ? (technicians.find((t) => t.id === selected[0])?.name ?? '1 técnico')
        : `${selected.length} técnicos`;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-md bg-surface px-4 py-3 text-left text-sm font-semibold text-text shadow-inset"
      >
        <span className="truncate">{label}</span>
        <IconChevronDown className={`flex-none text-muted transition-transform ${open ? 'rotate-180' : ''}`} size={14} />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 max-h-80 w-64 overflow-y-auto rounded-md bg-surface p-2 shadow-lg">
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={!selected.length}
            className="mb-1 w-full rounded px-2.5 py-1.5 text-left text-xs font-bold text-primary transition hover:bg-primary-50 disabled:opacity-40"
          >
            Todos los técnicos
          </button>

          {technicians.map((t) => (
            <label
              key={t.id}
              className="flex cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-[12.5px] font-semibold transition hover:bg-neutral-50"
            >
              <input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggle(t.id)} className="accent-primary-600" />
              <span className="truncate">{t.name}</span>
            </label>
          ))}

          {!technicians.length && <div className="px-2.5 py-1.5 text-xs font-semibold text-muted">Sin técnicos</div>}
        </div>
      )}
    </div>
  );
}
