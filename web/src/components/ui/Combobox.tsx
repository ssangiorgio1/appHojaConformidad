'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

// Máximo de filas montadas a la vez: cmdk registra un ítem por fila y se vuelve lento con miles.
const MAX_VISIBLES = 80;

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export interface ComboboxOpcion {
  value: string;
  label: string;
  /** Texto de la derecha (ej. cantidad). */
  detalle?: string;
}

// Combobox de shadcn (Popover + Command) con selección múltiple y búsqueda interna.
// Vacío = sin filtro. El popover queda abierto al elegir para poder marcar varias opciones.
export function Combobox({
  opciones,
  values,
  onChange,
  placeholder,
  etiquetaPlural = 'seleccionados',
  buscarPlaceholder = 'Buscar…',
  vacio = 'Sin resultados.',
  ariaLabel,
  className,
}: {
  opciones: ComboboxOpcion[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  etiquetaPlural?: string;
  buscarPlaceholder?: string;
  vacio?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const q = useDeferredValue(busqueda);
  const elegidos = useMemo(() => new Set(values), [values]);
  // Etiquetas normalizadas una sola vez (no por tecla).
  const indice = useMemo(() => opciones.map((o) => ({ o, n: normalizar(o.label) })), [opciones]);
  const { visibles, total } = useMemo(() => {
    const nq = normalizar(q.trim());
    const coinciden = indice.filter(({ n }) => !nq || n.includes(nq)).map(({ o }) => o);
    // Sin búsqueda, las ya marcadas van primero para verlas sin scrollear.
    if (!nq && elegidos.size > 0) coinciden.sort((a, b) => Number(elegidos.has(b.value)) - Number(elegidos.has(a.value)));
    return { visibles: coinciden.slice(0, MAX_VISIBLES), total: coinciden.length };
  }, [indice, q, elegidos]);
  const texto =
    values.length === 0
      ? placeholder
      : values.length === 1
        ? (opciones.find((o) => o.value === values[0])?.label ?? values[0])
        : `${values.length} ${etiquetaPlural}`;

  function alternar(v: string) {
    onChange(elegidos.has(v) ? values.filter((x) => x !== v) : [...values, v]);
  }

  return (
    <Popover
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (!v) setBusqueda('');
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={abierto}
          aria-label={ariaLabel ?? placeholder}
          className={cn(
            'flex h-10 w-64 items-center justify-between gap-2 rounded-md border border-neutral-100 bg-white px-3 text-sm text-text',
            className,
          )}
        >
          <span className="truncate">{texto}</span>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 shrink-0 opacity-50">
            <path d="m7 15 5 5 5-5M7 9l5-5 5 5" />
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder={buscarPlaceholder} value={busqueda} onValueChange={setBusqueda} />
          <CommandList>
            <CommandEmpty>{vacio}</CommandEmpty>
            <CommandGroup>
              {visibles.map((o) => {
                const marcado = elegidos.has(o.value);
                return (
                  <CommandItem key={o.value} value={o.label} onSelect={() => alternar(o.value)}>
                    <span
                      aria-hidden
                      className={cn(
                        'flex size-4 shrink-0 items-center justify-center rounded border text-[10px] leading-none',
                        marcado ? 'border-primary-600 bg-primary-600 text-white' : 'border-neutral-300',
                      )}
                    >
                      {marcado ? '✓' : ''}
                    </span>
                    <span className={cn('truncate', marcado && 'font-bold')}>{o.label}</span>
                    {o.detalle && <span className="ml-auto text-xs text-muted">{o.detalle}</span>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {total > MAX_VISIBLES && (
              <div className="px-3 py-2 text-xs text-muted">
                Mostrando {MAX_VISIBLES} de {total.toLocaleString('es-AR')}. Escribí para acotar.
              </div>
            )}
          </CommandList>
          {values.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="border-t border-neutral-100 px-3 py-2 text-left text-xs font-bold text-primary-600 hover:bg-neutral-50"
            >
              Limpiar selección ({values.length})
            </button>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
