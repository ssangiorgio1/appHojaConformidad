'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { IconChevronDown, IconSearch } from './Icons';

export interface OpcionMulti {
  value: string;
  label: string;
}

interface Props {
  opciones: OpcionMulti[];
  seleccionados: string[];
  onChange: (valores: string[]) => void;
  // Texto del botón cuando no hay ninguno elegido (sin filtro).
  todosLabel?: string;
  // "N técnicos" cuando hay varios elegidos: lo que se cuenta, en plural.
  plural?: string;
  buscarPlaceholder?: string;
  sinResultadosLabel?: string;
}

// Sin tildes ni mayúsculas, para que "perez" encuentre "Pérez".
export function normalizarBusqueda(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

// Filtra las opciones por lo escrito (cualquier parte del nombre, todas las palabras).
export function filtrarOpciones(opciones: OpcionMulti[], texto: string): OpcionMulti[] {
  const palabras = normalizarBusqueda(texto).split(/\s+/).filter(Boolean);
  if (!palabras.length) return opciones;
  return opciones.filter((o) => {
    const label = normalizarBusqueda(o.label);
    return palabras.every((p) => label.includes(p));
  });
}

// Selector de varias opciones con buscador: el botón se ve como un select, y al abrirlo hay un campo para escribir (filtra la lista)
// y una casilla por opción. Enter en el buscador marca o desmarca la primera coincidencia; Escape cierra.
export function MultiSelectBuscable({
  opciones,
  seleccionados,
  onChange,
  todosLabel = 'Todos',
  plural = 'elegidos',
  buscarPlaceholder = 'Buscar...',
  sinResultadosLabel = 'Sin resultados',
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const raiz = useRef<HTMLDivElement>(null);
  const buscador = useRef<HTMLInputElement>(null);
  const listaId = useId();

  const elegidos = useMemo(() => new Set(seleccionados), [seleccionados]);
  const visibles = useMemo(() => filtrarOpciones(opciones, texto), [opciones, texto]);

  // Se cierra al tocar afuera o con Escape; al abrir, el cursor ya está en el buscador.
  useEffect(() => {
    if (!abierto) return;
    const afuera = (e: MouseEvent | TouchEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('mousedown', afuera);
    document.addEventListener('touchstart', afuera);
    document.addEventListener('keydown', tecla);
    buscador.current?.focus();
    return () => {
      document.removeEventListener('mousedown', afuera);
      document.removeEventListener('touchstart', afuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  function alternar(valor: string) {
    onChange(elegidos.has(valor) ? seleccionados.filter((v) => v !== valor) : [...seleccionados, valor]);
  }

  function abrirOCerrar() {
    setAbierto((v) => !v);
    setTexto('');
  }

  const resumen =
    seleccionados.length === 0
      ? todosLabel
      : seleccionados.length === 1
        ? (opciones.find((o) => o.value === seleccionados[0])?.label ?? `1 ${plural.replace(/s$/, '')}`)
        : `${seleccionados.length} ${plural}`;

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        onClick={abrirOCerrar}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={listaId}
        className="relative w-full rounded-md bg-surface px-4 py-3 pr-9 text-left text-sm font-semibold text-text shadow-inset outline-none"
      >
        <span className={`block truncate ${seleccionados.length === 0 ? '' : 'text-primary'}`}>{resumen}</span>
        <IconChevronDown className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-transform ${abierto ? 'rotate-180' : ''}`} size={14} />
      </button>

      {abierto && (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-full min-w-[17rem] overflow-hidden rounded-md border border-line bg-surface shadow-soft-sm">
          <div className="relative border-b border-line p-2">
            <IconSearch className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-muted" size={14} />
            <input
              ref={buscador}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (visibles[0]) alternar(visibles[0].value);
                }
              }}
              placeholder={buscarPlaceholder}
              aria-label={buscarPlaceholder}
              className="w-full rounded-md bg-bg py-2 pl-8 pr-3 text-sm font-medium text-text outline-none placeholder:text-muted"
            />
          </div>

          <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-1.5 text-[11.5px] font-bold">
            <span className="text-muted">{seleccionados.length ? `${seleccionados.length} elegidos` : 'Ninguno elegido'}</span>
            <div className="flex gap-3">
              {texto.trim() !== '' && visibles.length > 0 && (
                <button
                  type="button"
                  className="text-primary"
                  onClick={() => onChange([...new Set([...seleccionados, ...visibles.map((o) => o.value)])])}
                >
                  Elegir los {visibles.length}
                </button>
              )}
              {seleccionados.length > 0 && (
                <button type="button" className="text-muted hover:text-text" onClick={() => onChange([])}>
                  Quitar todos
                </button>
              )}
            </div>
          </div>

          <ul id={listaId} role="listbox" aria-multiselectable="true" className="max-h-64 overflow-y-auto py-1">
            {visibles.length === 0 && <li className="px-3 py-3 text-sm font-semibold text-muted">{sinResultadosLabel}</li>}
            {visibles.map((o) => {
              const marcado = elegidos.has(o.value);
              return (
                <li key={o.value} role="option" aria-selected={marcado}>
                  <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm font-semibold hover:bg-neutral-50">
                    <input type="checkbox" checked={marcado} onChange={() => alternar(o.value)} className="h-4 w-4 shrink-0 accent-primary-600" />
                    <span className="truncate">{o.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
