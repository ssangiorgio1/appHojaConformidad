'use client';

import { Fragment, type CSSProperties, useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { GraficasEquipo } from '@/components/equipo/GraficasEquipo';
import { EquipoEstadoLoader } from '@/components/equipo/EquipoEstadoLoader';
import type { FlotaUnidad } from '@/lib/types';
import { FLOTA_CATEGORIA_COLOR, FLOTA_CATEGORIA_LABEL } from './categorias';

const MAX_FILAS = 300;
const DURACION_MS = 350;

function fechaReporte(ts: number | null): string {
  return ts
    ? new Date(ts * 1000).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour12: false })
    : 'Nunca reportó';
}

// Unidades dentro del área elegida en el mapa. Cada fila se despliega con todos sus datos; el
// estado en vivo (bo3) se pide recién al desplegar esa fila, nunca para toda la tabla.
export function FlotaAreaTabla({ unidades, onLimpiar, titulo = 'Unidades en el área' }: { unidades: FlotaUnidad[]; onLimpiar: () => void; titulo?: string }) {
  const [abierta, setAbierta] = useState<number | null>(null);
  // `visible` maneja la animación: se abre en el frame siguiente al montaje y, al cerrar, la fila
  // se desmonta recién cuando terminó de colapsar.
  const [visible, setVisible] = useState(false);
  // El contenido (y sus consultas en vivo) se monta recién cuando la fila empezó a abrirse.
  const [listo, setListo] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (abierta === null) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => { setVisible(true); setListo(true); }));
    return () => cancelAnimationFrame(id);
  }, [abierta]);

  function alternar(movilId: number) {
    clearTimeout(timer.current);
    if (abierta === movilId) {
      setVisible(false);
      timer.current = setTimeout(() => setAbierta(null), DURACION_MS);
    } else {
      setVisible(false);
      setListo(false);
      setAbierta(movilId);
    }
  }
  const visibles = unidades.slice(0, MAX_FILAS);

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-extrabold text-text">
          {titulo} · {unidades.length.toLocaleString('es-AR')}
        </h2>
        <button type="button" onClick={onLimpiar} className="text-xs font-bold text-primary-600">
          Limpiar selección
        </button>
      </div>
      {unidades.length === 0 ? (
        <p className="text-sm text-muted">No hay unidades (con los filtros actuales) dentro del área.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-bold uppercase text-muted">Cliente</TableHead>
                <TableHead className="text-xs font-bold uppercase text-muted">Unidad</TableHead>
                <TableHead className="text-xs font-bold uppercase text-muted">Patente</TableHead>
                <TableHead className="text-xs font-bold uppercase text-muted">Estado</TableHead>
                <TableHead className="text-xs font-bold uppercase text-muted">Último reporte</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibles.map((u) => {
                const open = abierta === u.movilId;
                return (
                  <Fragment key={u.movilId}>
                    <TableRow
                      onClick={() => alternar(u.movilId)}
                      className="cursor-pointer"
                      aria-expanded={open && visible}
                    >
                      <TableCell className="font-medium text-text">
                        <span className="inline-flex items-center gap-2">
                          <span aria-hidden className={`inline-block text-xs text-muted transition-transform duration-200 ${open && visible ? 'rotate-90' : ''}`}>
                            ▸
                          </span>
                          {u.clienteNombre ?? `Cliente #${u.clienteId}`}
                        </span>
                      </TableCell>
                      <TableCell>{u.nombre}</TableCell>
                      <TableCell>{u.matricula ?? '—'}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-2 text-xs font-bold">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: FLOTA_CATEGORIA_COLOR[u.categoria] }}
                          />
                          {FLOTA_CATEGORIA_LABEL[u.categoria]}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted">{fechaReporte(u.ultimoReporte)}</TableCell>
                    </TableRow>
                    {open && (
                      <TableRow className="bg-neutral-50 hover:bg-neutral-50">
                        <TableCell colSpan={5} className="p-0">
                          <div
                            className={`grid transition-[grid-template-rows,opacity] ease-out ${visible ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                            style={{ transitionDuration: `${DURACION_MS}ms` }}
                          >
                            <div className="min-h-0 overflow-hidden">
                              <div className="px-4 py-4">
                              {listo && (
                                <>
                          <dl className="reveal mb-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                            <Dato label="Cliente" valor={u.clienteNombre ?? `#${u.clienteId}`} />
                            <Dato label="Unidad" valor={u.nombre} />
                            <Dato label="Patente" valor={u.matricula} />
                            <Dato label="Interno" valor={u.interno} />
                            <Dato label="Estado" valor={FLOTA_CATEGORIA_LABEL[u.categoria]} />
                            <Dato label="Último reporte" valor={fechaReporte(u.ultimoReporte)} />
                            <Dato label="Posición" valor={`${u.latitud.toFixed(5)}, ${u.longitud.toFixed(5)}`} />
                            <Dato label="Equipo" valor={u.equipoId ? `#${u.equipoId}` : null} />
                          </dl>
                          {u.equipoId ? (
                            <div className="reveal flex flex-col gap-4" style={{ '--reveal-delay': '150ms' } as CSSProperties}>
                              <EquipoEstadoLoader equipoId={u.equipoId} />
                              <GraficasEquipo equipoId={u.equipoId} />
                            </div>
                          ) : (
                            <p className="text-sm text-muted">Esta unidad no tiene equipo asociado en VisionBLO.</p>
                          )}
                                </>
                              )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {unidades.length > MAX_FILAS && (
        <p className="text-xs text-muted">
          Se muestran las primeras {MAX_FILAS}. Achicá el área o sumá filtros para ver el resto.
        </p>
      )}
    </Card>
  );
}

function Dato({ label, valor }: { label: string; valor: string | null }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase text-muted">{label}</dt>
      <dd className="font-medium text-text">{valor || '—'}</dd>
    </div>
  );
}
