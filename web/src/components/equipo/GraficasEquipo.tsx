'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { curveLinear, curveStepAfter } from '@visx/curve';
import { ChartTooltip } from '@/components/charts/tooltip';
import { Grid } from '@/components/charts/grid';
import { Line } from '@/components/charts/line';
import { LineChart } from '@/components/charts/line-chart';
import { XAxis } from '@/components/charts/x-axis';
import { YAxis } from '@/components/charts/y-axis';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getGraficasEquipo } from '@/lib/api';
import type { GraficasEquipo as Graficas, PuntoGrafica } from '@/lib/types';

const TZ = 'America/Argentina/Buenos_Aires';

function hoyAr(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

// Tamaños preestablecidos (relación ancho/alto: más chico el número, más alto el gráfico).
export type Tamano = 'compacto' | 'normal' | 'alto';
const TAMANOS: { id: Tamano; label: string; ratio: string }[] = [
  { id: 'compacto', label: 'Compacto', ratio: '3.6 / 1' },
  { id: 'normal', label: 'Normal', ratio: '2.6 / 1' },
  { id: 'alto', label: 'Alto', ratio: '1.7 / 1' },
];

function SelectorTamano({ valor, onChange }: { valor: Tamano; onChange: (t: Tamano) => void }) {
  return (
    <div role="group" aria-label="Tamaño de los gráficos" className="inline-flex overflow-hidden rounded-md border border-neutral-200">
      {TAMANOS.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-pressed={valor === t.id}
          onClick={() => onChange(t.id)}
          className={`px-2.5 py-1 text-xs font-bold transition ${valor === t.id ? 'bg-primary-600 text-white' : 'bg-white text-muted hover:bg-neutral-50'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function fmt(v: number, escalon: boolean): string {
  return escalon ? String(Math.round(v)) : Number.isInteger(v) ? String(v) : v.toFixed(1);
}

interface PuntoSerie extends Record<string, unknown> {
  date: Date;
  value: number;
}

// Gráfico de línea (bklit LineChart): ejes, grilla y tooltip con crosshair al pasar el mouse.
// `escalon` dibuja las series on/off (ignición, cargador) como escalones. `grande` = versión ampliada.
function Grafico({
  titulo,
  unidad,
  datos,
  escalon,
  grande,
  tamano,
}: {
  titulo: string;
  unidad: string;
  datos: PuntoSerie[];
  escalon: boolean;
  grande: boolean;
  tamano: Tamano;
}) {
  const ratio = TAMANOS.find((t) => t.id === tamano)!.ratio;
  const [tMin, tMax] = useMemo(() => [datos[0].date.getTime(), datos[datos.length - 1].date.getTime()], [datos]);
  const total = Math.max(tMax - tMin, 1);
  // Zoom horizontal: ventana visible [ini, fin] en ms (null = todo el día).
  const [ventana, setVentana] = useState<[number, number] | null>(null);
  const caja = useRef<HTMLDivElement>(null);
  const estado = useRef({ ventana, tMin, tMax });
  estado.current = { ventana, tMin, tMax };

  useEffect(() => setVentana(null), [datos]);

  // Listener nativo no pasivo: la rueda hace zoom sobre el gráfico y NO scrollea el panel.
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { ventana: v, tMin: a, tMax: b } = estado.current;
      const [ini, fin] = v ?? [a, b];
      const span = fin - ini;
      const full = Math.max(b - a, 1);
      const minSpan = Math.min(60_000, full);
      // Shift o rueda horizontal: desplaza; rueda normal: zoom centrado en el cursor.
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        const delta = ((e.deltaX || e.deltaY) / 400) * span;
        const nIni = Math.min(Math.max(ini + delta, a), b - span);
        setVentana(span >= full ? null : [nIni, nIni + span]);
        return;
      }
      const rect = el.getBoundingClientRect();
      const plotW = Math.max(rect.width - 40 - 16, 1);
      const frac = Math.min(Math.max((e.clientX - rect.left - 40) / plotW, 0), 1);
      const nSpan = Math.min(Math.max(span * (e.deltaY < 0 ? 0.8 : 1.25), minSpan), full);
      if (nSpan >= full) return setVentana(null);
      const centro = ini + span * frac;
      const nIni = Math.min(Math.max(centro - nSpan * frac, a), b - nSpan);
      setVentana([nIni, nIni + nSpan]);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const zoom = ventana !== null;
  const span = ventana ? ventana[1] - ventana[0] : total;
  const mover = (ini: number) => setVentana([ini, ini + span]);

  return (
    <div>
      <div ref={caja}>
        <LineChart
          data={datos}
          aspectRatio={grande ? ratio.replace(/^[d.]+/, (n) => String(Math.max(1.2, Number(n) - 0.2))) : ratio}
          margin={{ top: 16, right: 16, bottom: 28, left: 40 }}
          xDomain={ventana ? [new Date(ventana[0]), new Date(ventana[1])] : undefined}
          xDomainSlotCount={ventana ? datos.length : undefined}
        >
          <Grid horizontal />
          <Line dataKey="value" curve={escalon ? curveStepAfter : curveLinear} strokeWidth={grande ? 2.5 : 2} fadeEdges={false} />
          <XAxis numTicks={grande ? 8 : 4} tickMode="domain" tickerHalfWidth={30} />
          <YAxis numTicks={escalon ? 2 : grande ? 6 : 4} formatLargeNumbers={false} formatValue={(v) => fmt(v, escalon)} />
          <ChartTooltip
            rows={(p) => [{ color: 'var(--chart-line-primary)', label: titulo, value: `${p.value as number} ${unidad}`.trim() }]}
          />
        </LineChart>
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs text-muted">
        {zoom ? (
          <>
            <input
              type="range"
              aria-label="Desplazar gráfico"
              className="min-w-0 flex-1"
              min={tMin}
              max={tMax - span}
              step={Math.max(Math.round(span / 200), 1)}
              value={ventana![0]}
              onChange={(e) => mover(Number(e.target.value))}
            />
            <button type="button" onClick={() => setVentana(null)} className="font-bold text-primary-600 hover:underline">
              Restablecer
            </button>
          </>
        ) : (
          <span>Rueda del mouse: zoom · Shift + rueda: desplazar</span>
        )}
      </div>
    </div>
  );
}

// Tarjeta de una serie. El botón de la esquina la abre ampliada en un diálogo.
function Linea({
  titulo,
  unidad,
  puntos,
  escalon = false,
  orden = 0,
  tamano,
}: {
  titulo: string;
  unidad: string;
  puntos: PuntoGrafica[];
  escalon?: boolean;
  orden?: number;
  tamano: Tamano;
}) {
  const [ampliado, setAmpliado] = useState(false);
  const [tamanoModal, setTamanoModal] = useState<Tamano>('normal');
  const delay = { '--reveal-delay': `${orden * 140}ms` } as CSSProperties;
  const datos = useMemo<PuntoSerie[]>(
    () => puntos.filter((p): p is [number, number] => p[1] !== null).map(([t, v]) => ({ date: new Date(t), value: v })),
    [puntos],
  );

  useEffect(() => {
    if (!ampliado) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAmpliado(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ampliado]);

  const tarjeta = 'reveal rounded-lg border border-neutral-200 bg-white p-3 shadow-sm';
  if (datos.length === 0) {
    return (
      <div className={tarjeta} style={delay}>
        <div className="text-xs font-bold text-muted">{titulo}</div>
        <div className="py-3 text-xs text-muted">Sin datos ese día.</div>
      </div>
    );
  }
  const vals = datos.map((p) => p.value);
  const vMin = Math.min(...vals);
  const vMax = Math.max(...vals);
  const promedio = vals.reduce((a, b) => a + b, 0) / vals.length;
  const ultimo = vals[vals.length - 1];
  const resumen = `mín ${fmt(vMin, escalon)} · máx ${fmt(vMax, escalon)} ${unidad} · último ${ultimo}`;
  const props = { titulo, unidad, datos, escalon };

  return (
    <div className={tarjeta} style={delay}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-bold text-muted">{titulo}</span>
        <span className="flex items-baseline gap-2">
          <span className="text-xs text-muted">{resumen}</span>
          <button
            type="button"
            onClick={() => setAmpliado(true)}
            aria-label={`Ampliar ${titulo}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm font-bold text-primary-600 shadow-sm transition hover:bg-neutral-50"
          >
            <span className="text-base leading-none">⤢</span> Ampliar
          </button>
        </span>
      </div>
      <Grafico {...props} grande={false} tamano={tamano} />
      {ampliado &&
        createPortal(
          <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4"
            onClick={() => setAmpliado(false)}
            role="dialog"
            aria-modal="true"
            aria-label={titulo}
          >
            <div className="reveal w-full max-w-[1400px] rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-extrabold text-text">{titulo}</div>
                  <div className="text-sm text-muted">
                    {datos[0].date.toLocaleDateString('es-AR', { timeZone: TZ })} · mín {fmt(vMin, escalon)} · máx {fmt(vMax, escalon)} ·
                    promedio {promedio.toFixed(escalon ? 2 : 1)} · último {ultimo} {unidad} · {vals.length} puntos
                  </div>
                </div>
                <SelectorTamano valor={tamanoModal} onChange={setTamanoModal} />
                <button
                  type="button"
                  onClick={() => setAmpliado(false)}
                  aria-label="Cerrar"
                  className="text-2xl leading-none text-muted transition hover:text-text"
                >
                  ×
                </button>
              </div>
              <Grafico {...props} grande tamano={tamanoModal} />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

// Consulta bajo demanda (no se guarda en Mongo): el usuario elige fecha y recién ahí se pide a bo3.
// `compacto`: para contenedores angostos (panel lateral) — una sola columna y tamaño fijo.
export function GraficasEquipo({ equipoId, compacto = false }: { equipoId: number; compacto?: boolean }) {
  const { getIdToken } = useAuth();
  const [fecha, setFecha] = useState(hoyAr);
  const [data, setData] = useState<Graficas | null>(null);
  const [cargando, setCargando] = useState(false);
  const [tamano, setTamano] = useState<Tamano>('normal');
  const [error, setError] = useState<string | null>(null);

  const consultar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setData(await getGraficasEquipo(await getIdToken(), equipoId, fecha));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }, [equipoId, fecha, getIdToken]);

  const s = data?.series;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="text-sm font-extrabold text-text">Gráficas de estado</div>
        <Input type="date" className="w-44" value={fecha} max={hoyAr()} onChange={(e) => setFecha(e.target.value)} />
        <Button onClick={consultar} disabled={cargando || !fecha}>
          {cargando ? 'Consultando…' : 'Consultar'}
        </Button>
        {!compacto && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs font-bold text-muted">Tamaño</span>
            <SelectorTamano valor={tamano} onChange={setTamano} />
          </div>
        )}
      </div>
      {error && <div className="text-sm font-medium text-danger-700">{error}</div>}
      {s && (
        <div key={data?.consultadoAt} className={`grid gap-4 ${compacto || tamano === 'alto' ? '' : 'md:grid-cols-2'}`}>
          <Linea tamano={tamano} orden={0} titulo="Batería interna" unidad="V" puntos={s.bateriaInterna} />
          <Linea tamano={tamano} orden={1} titulo="Batería externa / cargador" unidad="V" puntos={s.cargador} />
          <Linea tamano={tamano} orden={2} titulo="Señal del módem" unidad="dBm" puntos={s.senalDbm} />
          <Linea tamano={tamano} orden={3} titulo="Velocidad" unidad="km/h" puntos={s.velocidad} />
          <Linea tamano={tamano} orden={4} titulo="Satélites" unidad="" puntos={s.satelites} />
          <Linea tamano={tamano} orden={5} titulo="Dilución de la precisión horizontal" unidad="" puntos={s.hdop} />
          <Linea tamano={tamano} orden={6} titulo="Ignición (1 = encendida)" unidad="" puntos={s.ignicion} escalon />
          <Linea tamano={tamano} orden={7} titulo="Cargador conectado (1 = sí)" unidad="" puntos={s.presenciaCargador} escalon />
        </div>
      )}
    </div>
  );
}
