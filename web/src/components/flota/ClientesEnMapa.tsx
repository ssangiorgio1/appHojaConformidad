'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { FlotaCategoria, FlotaUnidad } from '@/lib/types';
import { FLOTA_CATEGORIAS_ORDEN, FLOTA_CATEGORIA_COLOR, FLOTA_CATEGORIA_LABEL } from './categorias';

// Clientes con sus unidades en los estados que están marcados (las píldoras de arriba). Tocar un
// cliente lo suma o saca del filtro del mapa. `minimo` deja solo a los que tienen X unidades o más.
export function ClientesEnMapa({
  unidades,
  seleccion,
  onToggle,
  onLimpiar,
}: {
  /** Unidades según las píldoras y la búsqueda, sin recortar por cliente. */
  unidades: FlotaUnidad[];
  seleccion: Set<string>;
  onToggle: (nombre: string) => void;
  onLimpiar: () => void;
}) {
  const [minimo, setMinimo] = useState(1);
  const [limite, setLimite] = useState(50);

  const clientes = useMemo(() => {
    const m = new Map<string, { nombre: string; total: number; porEstado: Partial<Record<FlotaCategoria, number>> }>();
    for (const u of unidades) {
      const nombre = u.clienteNombre ?? `Cliente #${u.clienteId}`;
      const c = m.get(nombre) ?? { nombre, total: 0, porEstado: {} };
      c.total++;
      c.porEstado[u.categoria] = (c.porEstado[u.categoria] ?? 0) + 1;
      m.set(nombre, c);
    }
    return [...m.values()].sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, 'es'));
  }, [unidades]);

  const visibles = clientes.filter((c) => c.total >= minimo);
  const mostrados = visibles.slice(0, limite);

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-extrabold text-text">
          Clientes con unidades en estos estados · {visibles.length.toLocaleString('es-AR')}
        </h2>
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-muted">
          <label className="inline-flex items-center gap-2">
            Con
            <Input
              type="number"
              min={1}
              value={minimo}
              onChange={(e) => setMinimo(Math.max(1, Number(e.target.value) || 1))}
              className="!w-20 !py-1.5"
              aria-label="Mínimo de unidades"
            />
            unidades o más
          </label>
          {seleccion.size > 0 && (
            <button type="button" onClick={onLimpiar} className="text-primary-600">
              Quitar los {seleccion.size} elegidos del mapa
            </button>
          )}
        </div>
      </div>
      {visibles.length === 0 ? (
        <p className="text-sm text-muted">Ningún cliente tiene {minimo} unidades o más en los estados marcados.</p>
      ) : (
        <div className="max-h-[420px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead className="text-xs font-bold uppercase text-muted">Cliente</TableHead>
                <TableHead className="text-xs font-bold uppercase text-muted">Unidades</TableHead>
                <TableHead className="text-xs font-bold uppercase text-muted">Por estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mostrados.map((c) => {
                const on = seleccion.has(c.nombre);
                return (
                  <TableRow key={c.nombre} onClick={() => onToggle(c.nombre)} className={`cursor-pointer ${on ? 'bg-primary-50' : ''}`} aria-selected={on}>
                    <TableCell>
                      <input type="checkbox" checked={on} onChange={() => onToggle(c.nombre)} onClick={(e) => e.stopPropagation()} aria-label={`Mostrar solo ${c.nombre}`} />
                    </TableCell>
                    <TableCell className="font-medium text-text">{c.nombre}</TableCell>
                    <TableCell>{c.total.toLocaleString('es-AR')}</TableCell>
                    <TableCell>
                      <span className="flex flex-wrap gap-x-3 gap-y-1">
                        {FLOTA_CATEGORIAS_ORDEN.filter((cat) => c.porEstado[cat]).map((cat) => (
                          <span key={cat} className="inline-flex items-center gap-1.5 text-xs font-bold" title={FLOTA_CATEGORIA_LABEL[cat]}>
                            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: FLOTA_CATEGORIA_COLOR[cat] }} />
                            {c.porEstado[cat]}
                          </span>
                        ))}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {visibles.length > limite && (
        <button type="button" onClick={() => setLimite((l) => l + 100)} className="self-start text-xs font-bold text-primary-600">
          Mostrar 100 más ({(visibles.length - limite).toLocaleString('es-AR')} restantes)
        </button>
      )}
    </Card>
  );
}
