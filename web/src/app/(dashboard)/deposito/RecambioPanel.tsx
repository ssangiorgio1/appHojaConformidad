'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconX } from '@/components/ui/Icons';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import { disponiblesOrigen, type DatosRecambio, type Estado } from './logica';
import { PRODUCTOS, productoPorId, TECNICOS } from './mock';

const campo = 'rounded-md border border-neutral-300 bg-surface px-3 py-2 text-sm font-semibold normal-case tracking-normal text-text';
const etiqueta = 'flex flex-col gap-1 text-[12px] font-bold uppercase tracking-wide text-muted';

// Cambio de equipo en una unidad: el técnico instala uno nuevo de su inventario y retira el viejo, que después trae al laboratorio.
export function RecambioPanel({
  estado,
  tecnicoId,
  onClose,
  onRegistrar,
}: {
  estado: Estado;
  tecnicoId: string;
  onClose: () => void;
  onRegistrar: (datos: Omit<DatosRecambio, 'fecha'>) => void;
}) {
  useBodyScrollLock();
  const tecnico = TECNICOS.find((t) => t.id === tecnicoId)!;
  const serializados = PRODUCTOS.filter((p) => p.tipo === 'serializado');

  // Solo equipos nuevos del técnico que no estén ya en una devolución abierta.
  const nuevos = useMemo(
    () =>
      disponiblesOrigen(estado, 'a_deposito', tecnicoId).flatMap((d) =>
        (d.series ?? []).filter((s) => s.estado === 'en_tecnico').map((s) => ({ productoId: d.productoId, ...s })),
      ),
    [estado, tecnicoId],
  );

  const [unidad, setUnidad] = useState('');
  const [nuevoSerie, setNuevoSerie] = useState(nuevos[0]?.serie ?? '');
  const [productoRetirado, setProductoRetirado] = useState(nuevos[0]?.productoId ?? serializados[0].id);
  const [serieRetirado, setSerieRetirado] = useState('');
  const [imeiRetirado, setImeiRetirado] = useState('');

  const repetida = estado.tecnicos.some((t) => t.series?.some((s) => s.serie === serieRetirado.trim().toUpperCase()));
  const completo = unidad.trim() && nuevoSerie && serieRetirado.trim() && /^\d{15}$/.test(imeiRetirado.trim()) && !repetida;

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 animate-sheet-fade bg-black/45" onClick={onClose} />
      <Card className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col overflow-y-auto rounded-b-none p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] animate-sheet-up lg:inset-x-auto lg:bottom-6 lg:right-6 lg:top-6 lg:max-h-none lg:w-[480px] lg:animate-none lg:rounded-b-lg lg:pb-5">
        <div className="flex items-center justify-between">
          <div className="text-lg font-extrabold">Registrar recambio</div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition hover:text-text">
            <IconX size={18} />
          </button>
        </div>
        <div className="mt-1 text-[12.5px] font-semibold text-muted">
          {tecnico.nombre} cambia el equipo de una unidad. El nuevo sale de su inventario; el retirado queda en su poder hasta que lo devuelva al laboratorio.
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <label className={etiqueta}>
            Unidad (patente)
            <input value={unidad} onChange={(e) => setUnidad(e.target.value.toUpperCase())} placeholder="AB 123 CD" className={campo} />
          </label>

          <div className="rounded-md border border-neutral-200 p-3">
            <div className="text-[13px] font-extrabold">Equipo que se instala</div>
            {nuevos.length ? (
              <label className={`${etiqueta} mt-2`}>
                De su inventario
                <select value={nuevoSerie} onChange={(e) => setNuevoSerie(e.target.value)} className={campo}>
                  {nuevos.map((s) => (
                    <option key={s.serie} value={s.serie}>
                      {productoPorId(s.productoId).nombre} · {s.serie} · {s.imei}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="mt-1 text-[13px] font-semibold text-danger-700">
                {tecnico.nombre} no tiene equipos nuevos con serie. Primero hay que transferirle uno desde el depósito.
              </div>
            )}
          </div>

          <div className="rounded-md border border-neutral-200 p-3">
            <div className="text-[13px] font-extrabold">Equipo que se retira de la unidad</div>
            <div className="mt-2 flex flex-col gap-2">
              <label className={etiqueta}>
                Modelo
                <select value={productoRetirado} onChange={(e) => setProductoRetirado(e.target.value)} className={campo}>
                  {serializados.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className={etiqueta}>
                Nº de serie
                <input value={serieRetirado} onChange={(e) => setSerieRetirado(e.target.value.toUpperCase())} className={campo} />
              </label>
              <label className={etiqueta}>
                IMEI (15 dígitos)
                <input value={imeiRetirado} onChange={(e) => setImeiRetirado(e.target.value.replace(/\D/g, '').slice(0, 15))} inputMode="numeric" className={`${campo} font-mono`} />
              </label>
              {repetida && <div className="text-[12.5px] font-semibold text-danger-700">Ese nº de serie ya figura en el inventario de un técnico.</div>}
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!completo}
            onClick={() =>
              onRegistrar({
                tecnicoId,
                unidad: unidad.trim(),
                nuevoSerie,
                retirado: { productoId: productoRetirado, serie: serieRetirado.trim(), imei: imeiRetirado.trim() },
              })
            }
          >
            Registrar recambio
          </Button>
        </div>
      </Card>
    </div>
  );
}
