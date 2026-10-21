'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconX } from '@/components/ui/Icons';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import { disponiblesOrigen, type Estado } from './logica';
import { productoPorId, TECNICOS, type LineaTransferencia, type SentidoTransferencia } from './mock';

export type PresetTransferencia = {
  sentido: SentidoTransferencia;
  tecnicoId?: string;
  lineas?: { productoId: string; cantidad: number }[];
};

// Panel lateral para armar una transferencia (depósito → técnico o devolución técnico → depósito).
// Solo ofrece lo que el origen tiene libre: lo ya prometido en otras transferencias abiertas no aparece.
export function TransferenciaPanel({
  estado,
  preset,
  onClose,
  onCrear,
}: {
  estado: Estado;
  preset: PresetTransferencia;
  onClose: () => void;
  onCrear: (sentido: SentidoTransferencia, tecnicoId: string, lineas: LineaTransferencia[]) => void;
}) {
  useBodyScrollLock();
  const [sentido, setSentido] = useState(preset.sentido);
  const [tecnicoId, setTecnicoId] = useState(preset.tecnicoId ?? TECNICOS[0].id);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [series, setSeries] = useState<Record<string, string[]>>({});
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});
  const [inicializado, setInicializado] = useState(false);

  const disponibles = useMemo(() => disponiblesOrigen(estado, sentido, tecnicoId), [estado, sentido, tecnicoId]);
  const tecnico = TECNICOS.find((t) => t.id === tecnicoId)!;

  // Aplica la selección inicial (producto elegido desde la fila o faltante a reponer) una sola vez.
  if (!inicializado) {
    const c: Record<string, number> = {};
    const s: Record<string, string[]> = {};
    for (const l of preset.lineas ?? []) {
      const d = disponibles.find((x) => x.productoId === l.productoId);
      if (!d) continue;
      const n = Math.min(l.cantidad, d.cantidad);
      if (d.series) s[l.productoId] = d.series.slice(0, n).map((x) => x.serie);
      else c[l.productoId] = n;
    }
    setCantidades(c);
    setSeries(s);
    setInicializado(true);
  }

  function reiniciar() {
    setCantidades({});
    setSeries({});
    setAbiertos({});
  }

  const cantidadSel = (productoId: string) => series[productoId]?.length ?? cantidades[productoId] ?? 0;

  function mover(productoId: string, delta: 1 | -1) {
    const d = disponibles.find((x) => x.productoId === productoId)!;
    if (d.series) {
      const actuales = series[productoId] ?? [];
      if (delta === 1) {
        const prox = d.series.find((x) => !actuales.includes(x.serie));
        if (prox) setSeries({ ...series, [productoId]: [...actuales, prox.serie] });
      } else setSeries({ ...series, [productoId]: actuales.slice(0, -1) });
    } else {
      setCantidades({ ...cantidades, [productoId]: Math.min(d.cantidad, Math.max(0, (cantidades[productoId] ?? 0) + delta)) });
    }
  }

  function alternarSerie(productoId: string, serie: string) {
    const actuales = series[productoId] ?? [];
    setSeries({ ...series, [productoId]: actuales.includes(serie) ? actuales.filter((x) => x !== serie) : [...actuales, serie] });
  }

  const lineas: LineaTransferencia[] = disponibles
    .map((d) => ({ productoId: d.productoId, cantidad: cantidadSel(d.productoId), series: d.series ? series[d.productoId] : undefined }))
    .filter((l) => l.cantidad > 0);
  const total = lineas.reduce((n, l) => n + l.cantidad, 0);

  const origen = sentido === 'a_tecnico' ? 'Depósito' : tecnico.nombre;
  const destino = sentido === 'a_tecnico' ? tecnico.nombre : 'Depósito';

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 animate-sheet-fade bg-black/45" onClick={onClose} />
      <Card className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-b-none p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] animate-sheet-up lg:inset-x-auto lg:bottom-6 lg:right-6 lg:top-6 lg:max-h-none lg:w-[520px] lg:animate-none lg:rounded-b-lg lg:pb-5">
        <div className="flex items-center justify-between">
          <div className="text-lg font-extrabold">Nueva transferencia</div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition hover:text-text">
            <IconX size={18} />
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          {(
            [
              ['a_tecnico', 'Depósito → Técnico'],
              ['a_deposito', 'Técnico → Depósito (devolución)'],
            ] as [SentidoTransferencia, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setSentido(id);
                reiniciar();
              }}
              className={`flex-1 rounded-md px-3 py-2 text-[13px] font-bold transition ${sentido === id ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-muted hover:text-text'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="mt-3 flex flex-col gap-1 text-[12px] font-bold uppercase tracking-wide text-muted">
          Técnico
          <select
            value={tecnicoId}
            onChange={(e) => {
              setTecnicoId(e.target.value);
              reiniciar();
            }}
            className="rounded-md border border-neutral-300 bg-surface px-3 py-2 text-sm font-semibold normal-case tracking-normal text-text"
          >
            {TECNICOS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre} · {t.zona}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-3 text-[12.5px] font-semibold text-muted">
          Sale de <b className="text-text">{origen}</b> hacia <b className="text-text">{destino}</b>.
          {sentido === 'a_deposito' && ' Los equipos retirados de unidades van al laboratorio; los que el técnico no usó vuelven al depósito.'}
        </div>

        <div className="mt-2 min-h-0 flex-1 overflow-y-auto rounded-md border border-neutral-200">
          {!disponibles.length && <div className="p-4 text-sm font-semibold text-muted">{origen} no tiene nada libre para transferir.</div>}
          {disponibles.map((d) => {
            const p = productoPorId(d.productoId);
            const n = cantidadSel(d.productoId);
            return (
              <div key={d.productoId} className="border-t border-neutral-200 px-3 py-2.5 first:border-t-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-bold">{p.nombre}</div>
                    <div className="text-[12px] font-semibold text-muted">
                      {d.cantidad} libres
                      {d.series && (
                        <button type="button" onClick={() => setAbiertos({ ...abiertos, [d.productoId]: !abiertos[d.productoId] })} className="ml-2 font-bold text-primary-700">
                          {abiertos[d.productoId] ? 'Ocultar series' : 'Elegir series'}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => mover(d.productoId, -1)} disabled={n === 0} className="h-8 w-8 rounded-md border border-neutral-300 text-lg font-bold disabled:opacity-30">
                      −
                    </button>
                    <span className={`min-w-[1.75rem] text-center text-lg font-extrabold ${n > 0 ? 'text-primary-700' : 'text-muted'}`}>{n}</span>
                    <button type="button" onClick={() => mover(d.productoId, 1)} disabled={n >= d.cantidad} className="h-8 w-8 rounded-md border border-neutral-300 text-lg font-bold disabled:opacity-30">
                      +
                    </button>
                  </div>
                </div>
                {d.series && abiertos[d.productoId] && (
                  <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {d.series.map((s) => (
                      <label key={s.serie} className="flex items-center gap-2 rounded-md bg-neutral-100 px-2 py-1.5 text-[12px] font-semibold">
                        <input type="checkbox" checked={series[d.productoId]?.includes(s.serie) ?? false} onChange={() => alternarSerie(d.productoId, s.serie)} />
                        <span>{s.serie}</span>
                        <span className="font-mono text-muted">{s.imei}</span>
                        {s.estado === 'retirado' && <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[11px] font-bold text-warning-700">Retirado</span>}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="text-[13px] font-bold">{total} ítems en {lineas.length} productos</div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button disabled={!total} onClick={() => onCrear(sentido, tecnicoId, lineas)}>
              Crear transferencia
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
