'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { curveLinear, curveStepAfter } from '@visx/curve';
import { ChartTooltip } from '@/components/charts/tooltip';
import { setEjeConDia } from '@/components/charts/chart-formatters';
import { createSyncBus, type SyncBus } from '@/components/charts/sync-bus';
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

// Ventana visible [ini, fin] en ms; null = todo el rango consultado.
type Ventana = [number, number] | null;
type Dominio = [number, number];

// Zoom puro: `factor` < 1 acerca, > 1 aleja; `frac` (0..1) es el punto fijo dentro de la ventana.
function zoomVentana(ventana: Ventana, [a, b]: Dominio, factor: number, frac: number): Ventana {
  const [ini, fin] = ventana ?? [a, b];
  const span = fin - ini;
  const full = Math.max(b - a, 1);
  const nSpan = Math.min(Math.max(span * factor, Math.min(60_000, full)), full);
  if (nSpan >= full) return null;
  const centro = ini + span * frac;
  const nIni = Math.min(Math.max(centro - nSpan * frac, a), b - nSpan);
  return [nIni, nIni + nSpan];
}

// Barra de control de la ventana: zoom, desplazamiento (scroll horizontal) y reset.
// En la vista principal es UNA sola para todos los gráficos, así comparten siempre el mismo tramo.
function ControlesVentana({
  dominio,
  ventana,
  onVentana,
  zoomActivo,
}: {
  dominio: Dominio;
  ventana: Ventana;
  onVentana: (v: Ventana) => void;
  zoomActivo: boolean;
}) {
  const span = ventana ? ventana[1] - ventana[0] : dominio[1] - dominio[0];
  const btn = 'rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs font-bold text-primary-600 transition hover:bg-neutral-50';
  return (
    <div className="flex items-center gap-2 text-xs text-muted">
      <button type="button" aria-label="Alejar" className={btn} onClick={() => onVentana(zoomVentana(ventana, dominio, 1.5, 0.5))}>
        −
      </button>
      <button type="button" aria-label="Acercar" className={btn} onClick={() => onVentana(zoomVentana(ventana, dominio, 0.6, 0.5))}>
        +
      </button>
      {ventana ? (
        <>
          <input
            type="range"
            aria-label="Desplazar gráficos"
            className="min-w-0 flex-1"
            min={dominio[0]}
            max={dominio[1] - span}
            step={Math.max(Math.round(span / 200), 1)}
            value={ventana[0]}
            onChange={(e) => onVentana([Number(e.target.value), Number(e.target.value) + span])}
          />
          <button type="button" onClick={() => onVentana(null)} className="font-bold text-primary-600 hover:underline">
            Ver todo
          </button>
        </>
      ) : (
        <span>
          {zoomActivo
            ? 'Zoom con rueda ACTIVO (click en un gráfico para desactivar) · Shift + rueda: desplazar'
            : 'Click en un gráfico para activar el zoom con la rueda · o usá − / +'}
        </span>
      )}
    </div>
  );
}

// Gráfico de línea (bklit LineChart): ejes, grilla y tooltip con crosshair al pasar el mouse.
// `escalon` dibuja las series on/off (ignición, cargador) como escalones. `grande` = versión ampliada.
// El dominio X es siempre el del rango completo (no el de la serie), así los gráficos apilados quedan
// alineados en el tiempo y se pueden comparar a la misma hora.
function Grafico({
  titulo,
  unidad,
  datos,
  escalon,
  grande,
  tamano,
  dominio,
  ventana,
  onVentana,
  multiDia,
  zoomActivo,
  onToggleZoom,
  altura,
  syncBus,
}: {
  titulo: string;
  unidad: string;
  datos: PuntoSerie[];
  escalon: boolean;
  grande: boolean;
  tamano: Tamano;
  dominio: Dominio;
  ventana: Ventana;
  onVentana: (v: Ventana) => void;
  multiDia: boolean;
  /** La rueda sólo hace zoom con el zoom activo (se activa/desactiva con un click en el gráfico). */
  zoomActivo: boolean;
  onToggleZoom: () => void;
  /** Alto fijo en px (vista apilada); sin esto se usa la relación de aspecto del tamaño. */
  altura?: number;
  /** Cursor compartido con los demás gráficos. */
  syncBus?: SyncBus;
}) {
  const ratio = TAMANOS.find((t) => t.id === tamano)!.ratio;
  const caja = useRef<HTMLDivElement>(null);
  const estado = useRef({ ventana, dominio, onVentana, zoomActivo });
  useEffect(() => {
    estado.current = { ventana, dominio, onVentana, zoomActivo };
  });
  setEjeConDia(multiDia);

  // Listener nativo no pasivo: con el zoom activo la rueda hace zoom sobre el gráfico y NO scrollea
  // el panel; inactivo, la rueda scrollea la página como siempre.
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!estado.current.zoomActivo) return;
      e.preventDefault();
      const { ventana: v, dominio: d, onVentana: set } = estado.current;
      const [ini, fin] = v ?? d;
      const span = fin - ini;
      const full = Math.max(d[1] - d[0], 1);
      // Shift o rueda horizontal: desplaza; rueda normal: zoom centrado en el cursor.
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        const delta = ((e.deltaX || e.deltaY) / 400) * span;
        const nIni = Math.min(Math.max(ini + delta, d[0]), d[1] - span);
        set(span >= full ? null : [nIni, nIni + span]);
        return;
      }
      const rect = el.getBoundingClientRect();
      const plotW = Math.max(rect.width - 40 - 16, 1);
      const frac = Math.min(Math.max((e.clientX - rect.left - 40) / plotW, 0), 1);
      set(zoomVentana(v, d, e.deltaY < 0 ? 0.8 : 1.25, frac));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const [x0, x1] = ventana ?? dominio;

  return (
    <div
      ref={caja}
      onClick={onToggleZoom}
      className={`rounded-md ${zoomActivo ? 'ring-2 ring-primary-500/60' : ''}`}
    >
      <LineChart
        data={datos}
        aspectRatio={altura ? '' : grande ? ratio.replace(/^[d.]+/, (n) => String(Math.max(1.2, Number(n) - 0.2))) : ratio}
        style={altura ? { height: altura } : undefined}
        margin={{ top: 16, right: 16, bottom: 28, left: 40 }}
        xDomain={[new Date(x0), new Date(x1)]}
        xDomainSlotCount={datos.length}
        // Sin animar el eje Y al cambiar la ventana: al arrastrar la barra o hacer zoom se encadenaban
        // tweens y React cortaba con "Maximum update depth exceeded" (use-animated-y-domains).
        yDomainTween={false}
        syncBus={syncBus}
      >
        <Grid horizontal />
        <Line dataKey="value" curve={escalon ? curveStepAfter : curveLinear} strokeWidth={grande ? 2.5 : 2} fadeEdges={false} />
        <XAxis numTicks={grande ? 8 : 5} tickMode="domain" tickerHalfWidth={multiDia ? 38 : 30} />
        <YAxis numTicks={escalon ? 2 : grande ? 6 : 4} formatLargeNumbers={false} formatValue={(v) => fmt(v, escalon)} />
        <ChartTooltip
          rows={(p) => [{ color: 'var(--chart-line-primary)', label: titulo, value: `${p.value as number} ${unidad}`.trim() }]}
        />
      </LineChart>
    </div>
  );
}

// Tarjeta de una serie. El botón de la esquina la abre ampliada en un diálogo (con su propio zoom).
function Linea({
  titulo,
  unidad,
  puntos,
  escalon = false,
  orden = 0,
  tamano,
  dominio,
  ventana,
  onVentana,
  multiDia,
  zoomActivo,
  onToggleZoom,
  altura,
  syncBus,
}: {
  titulo: string;
  unidad: string;
  puntos: PuntoGrafica[];
  escalon?: boolean;
  orden?: number;
  tamano: Tamano;
  dominio: Dominio;
  ventana: Ventana;
  onVentana: (v: Ventana) => void;
  multiDia: boolean;
  zoomActivo: boolean;
  onToggleZoom: () => void;
  altura?: number;
  syncBus?: SyncBus;
}) {
  const [ampliado, setAmpliado] = useState(false);
  // En el diálogo el zoom con rueda arranca activo (ahí no hay página que scrollear).
  const [zoomModal, setZoomModal] = useState(true);
  const [tamanoModal, setTamanoModal] = useState<Tamano>('normal');
  const [ventanaModal, setVentanaModal] = useState<Ventana>(null);
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
        <div className="py-3 text-xs text-muted">Sin datos en el rango.</div>
      </div>
    );
  }
  const vals = datos.map((p) => p.value);
  const vMin = Math.min(...vals);
  const vMax = Math.max(...vals);
  const promedio = vals.reduce((a, b) => a + b, 0) / vals.length;
  const ultimo = vals[vals.length - 1];
  const resumen = `mín ${fmt(vMin, escalon)} · máx ${fmt(vMax, escalon)} ${unidad} · último ${ultimo}`;
  const props = { titulo, unidad, datos, escalon, dominio, multiDia };
  const dia = (d: Date) => d.toLocaleDateString('es-AR', { timeZone: TZ });
  const fechas = multiDia ? `${dia(datos[0].date)} – ${dia(datos[datos.length - 1].date)}` : dia(datos[0].date);

  return (
    <div className={tarjeta} style={delay}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-bold text-muted">{titulo}</span>
        <span className="flex items-baseline gap-2">
          <span className="text-xs text-muted">{resumen}</span>
          <button
            type="button"
            onClick={() => {
              setVentanaModal(ventana);
              setAmpliado(true);
            }}
            aria-label={`Ampliar ${titulo}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm font-bold text-primary-600 shadow-sm transition hover:bg-neutral-50"
          >
            <span className="text-base leading-none">⤢</span> Ampliar
          </button>
        </span>
      </div>
      <Grafico
        {...props}
        grande={false}
        tamano={tamano}
        ventana={ventana}
        onVentana={onVentana}
        zoomActivo={zoomActivo}
        onToggleZoom={onToggleZoom}
        altura={altura}
        syncBus={syncBus}
      />
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
                    {fechas} · mín {fmt(vMin, escalon)} · máx {fmt(vMax, escalon)} · promedio {promedio.toFixed(escalon ? 2 : 1)} · último{' '}
                    {ultimo} {unidad} · {vals.length} puntos
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
              <Grafico
                {...props}
                grande
                tamano={tamanoModal}
                ventana={ventanaModal}
                onVentana={setVentanaModal}
                zoomActivo={zoomModal}
                onToggleZoom={() => setZoomModal((z) => !z)}
              />
              <div className="mt-1">
                <ControlesVentana dominio={dominio} ventana={ventanaModal} onVentana={setVentanaModal} zoomActivo={zoomModal} />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

const MAX_DIAS = 7;
// Hasta cuántos días atrás deja elegir el calendario (bo3 no tiene datos confiables más atrás).
const MAX_DIAS_ATRAS = 7;
const DIA_MS = 86_400_000;

function sumarDias(fecha: string, n: number): string {
  return new Date(Date.parse(fecha) + n * DIA_MS).toISOString().slice(0, 10);
}

type SerieId = keyof Graficas['series'];

// El orden es el de apilado.
const SERIES: { id: SerieId; titulo: string; unidad: string; escalon?: boolean }[] = [
  { id: 'bateriaInterna', titulo: 'Batería interna', unidad: 'V' },
  { id: 'cargador', titulo: 'Batería externa / cargador', unidad: 'V' },
  { id: 'senalDbm', titulo: 'Señal del módem', unidad: 'dBm' },
  { id: 'velocidad', titulo: 'Velocidad', unidad: 'km/h' },
  { id: 'satelites', titulo: 'Satélites', unidad: '' },
  { id: 'hdop', titulo: 'Dilución de la precisión horizontal', unidad: '' },
  { id: 'ignicion', titulo: 'Ignición (1 = encendida)', unidad: '', escalon: true },
  { id: 'presenciaCargador', titulo: 'Cargador conectado (1 = sí)', unidad: '', escalon: true },
];
const TODAS = SERIES.map((x) => x.id);
const LS_VISIBLES = 'wara:graficas:visibles';
const LS_DISPOSICION = 'wara:graficas:disposicion';

type Disposicion = 'apiladas' | 'columnas';

// Alto (px) de cada gráfico en la vista apilada: bajo, para ver varios a la vez y compararlos.
const ALTURA_APILADA: Record<Tamano, number> = { compacto: 120, normal: 170, alto: 250 };

// Consulta bajo demanda (no se guarda en Mongo): el usuario elige el rango y recién ahí se pide a bo3.
// `compacto`: para contenedores angostos (panel lateral) — una sola columna y tamaño fijo.
export function GraficasEquipo({ equipoId, compacto = false }: { equipoId: number; compacto?: boolean }) {
  const { getIdToken } = useAuth();
  const minFecha = sumarDias(hoyAr(), -MAX_DIAS_ATRAS);
  const [desde, setDesde] = useState(hoyAr);
  const [hasta, setHasta] = useState(hoyAr);
  const [data, setData] = useState<Graficas | null>(null);
  const [multiDia, setMultiDia] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [tamano, setTamano] = useState<Tamano>('compacto');
  const [error, setError] = useState<string | null>(null);
  const [visibles, setVisibles] = useState<SerieId[]>(TODAS);
  const [disposicion, setDisposicion] = useState<Disposicion>('apiladas');
  // Una sola ventana de zoom/desplazamiento para todos los gráficos: así siempre muestran el mismo tramo.
  const [ventana, setVentana] = useState<Ventana>(null);
  // La rueda sólo hace zoom si el usuario lo activó con un click en un gráfico (otro click lo apaga).
  const [zoomActivo, setZoomActivo] = useState(false);
  // Instante bajo el mouse en cualquiera de los gráficos: los demás marcan el mismo momento.
  const syncBus = useMemo(() => createSyncBus(), []);

  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(LS_VISIBLES) ?? 'null');
      // eslint-disable-next-line react-hooks/set-state-in-effect -- preferencias sólo del cliente (localStorage)
      if (Array.isArray(v)) setVisibles(TODAS.filter((id) => v.includes(id)));
      const d = localStorage.getItem(LS_DISPOSICION);
      if (d === 'apiladas' || d === 'columnas') setDisposicion(d);
    } catch {
      /* sin storage: valores por defecto */
    }
  }, []);

  const guardarVisibles = (v: SerieId[]) => {
    setVisibles(v);
    try {
      localStorage.setItem(LS_VISIBLES, JSON.stringify(v));
    } catch {
      /* ignorar */
    }
  };
  const elegirDisposicion = (d: Disposicion) => {
    setDisposicion(d);
    try {
      localStorage.setItem(LS_DISPOSICION, d);
    } catch {
      /* ignorar */
    }
  };

  const cambiarDesde = (v: string) => {
    if (!v || v < minFecha) return;
    setDesde(v);
    if (hasta < v) setHasta(v);
    else if (hasta > sumarDias(v, MAX_DIAS - 1)) setHasta(sumarDias(v, MAX_DIAS - 1));
  };
  const cambiarHasta = (v: string) => {
    if (!v || v < minFecha) return;
    setHasta(v);
    if (desde > v) setDesde(v);
    else if (desde < sumarDias(v, -(MAX_DIAS - 1))) setDesde(sumarDias(v, -(MAX_DIAS - 1)));
  };

  const consultar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const r = await getGraficasEquipo(await getIdToken(), equipoId, desde, hasta);
      setData(r);
      setMultiDia(desde !== hasta);
      setVentana(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }, [equipoId, desde, hasta, getIdToken]);

  const s = data?.series;
  // Dominio común: del primer al último punto de TODAS las series (no sólo las visibles, para que no
  // cambie al tildar/destildar).
  const dominio = useMemo<Dominio | null>(() => {
    if (!s) return null;
    let a = Infinity;
    let b = -Infinity;
    for (const serie of Object.values(s)) {
      for (const [t, v] of serie) {
        if (v === null) continue;
        if (t < a) a = t;
        if (t > b) b = t;
      }
    }
    return a <= b ? [a, Math.max(b, a + 1)] : null;
  }, [s]);

  const apiladas = compacto || disposicion === 'apiladas';
  const mostrar = SERIES.filter((x) => visibles.includes(x.id));

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full text-sm font-extrabold text-text sm:w-auto">Gráficas de estado</div>
        {/* Celular: Desde/Hasta en dos columnas iguales (los inputs de fecha de iOS/Android tienen ancho propio y,
            con ancho fijo y poco espacio, se pisaban entre sí). */}
        <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto">
          <label className="flex min-w-0 flex-col gap-0.5 text-xs font-bold text-muted">
            Desde
            <Input type="date" className="min-w-0 sm:w-40" value={desde} min={minFecha} max={hoyAr()} onChange={(e) => cambiarDesde(e.target.value)} />
          </label>
          <label className="flex min-w-0 flex-col gap-0.5 text-xs font-bold text-muted">
            Hasta
            <Input type="date" className="min-w-0 sm:w-40" value={hasta} min={minFecha} max={hoyAr()} onChange={(e) => cambiarHasta(e.target.value)} />
          </label>
        </div>
        <Button onClick={consultar} disabled={cargando || !desde || !hasta} className="w-full justify-center sm:w-auto">
          {cargando ? 'Consultando…' : 'Consultar'}
        </Button>
        <span className="pb-2 text-xs text-muted">Hasta {MAX_DIAS} días</span>
        {!compacto && (
          <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 sm:ml-auto sm:w-auto">
            {/* Con una sola columna (celular) elegir disposición no tiene efecto: solo se ofrece desde md. */}
            <div role="group" aria-label="Disposición" className="hidden overflow-hidden md:inline-flex rounded-md border border-neutral-200">
              {(['apiladas', 'columnas'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={disposicion === d}
                  onClick={() => elegirDisposicion(d)}
                  className={`px-2.5 py-1 text-xs font-bold transition ${disposicion === d ? 'bg-primary-600 text-white' : 'bg-white text-muted hover:bg-neutral-50'}`}
                >
                  {d === 'apiladas' ? 'Apiladas' : '2 columnas'}
                </button>
              ))}
            </div>
            <span className="text-xs font-bold text-muted">Tamaño</span>
            <SelectorTamano valor={tamano} onChange={setTamano} />
          </div>
        )}
      </div>

      <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md border border-neutral-200 px-3 py-2">
        <legend className="px-1 text-xs font-bold text-muted">Gráficas a ver</legend>
        {SERIES.map((x) => (
          <label key={x.id} className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-text">
            <input
              type="checkbox"
              checked={visibles.includes(x.id)}
              onChange={(e) => guardarVisibles(TODAS.filter((id) => (id === x.id ? e.target.checked : visibles.includes(id))))}
            />
            {x.titulo}
          </label>
        ))}
        <span className="ml-auto flex gap-3 text-xs font-bold text-primary-600">
          <button type="button" className="hover:underline" onClick={() => guardarVisibles(TODAS)}>
            Todas
          </button>
          <button type="button" className="hover:underline" onClick={() => guardarVisibles([])}>
            Ninguna
          </button>
        </span>
      </fieldset>

      {error && <div className="text-sm font-medium text-danger-700">{error}</div>}
      {s && mostrar.length === 0 && <div className="text-sm text-muted">Tildá al menos una gráfica para verla.</div>}
      {s && !dominio && mostrar.length > 0 && <div className="text-sm text-muted">Sin datos en el rango elegido.</div>}
      {s && dominio && mostrar.length > 0 && (
        <div className="sticky top-0 z-10 rounded-md border border-neutral-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
          <ControlesVentana dominio={dominio} ventana={ventana} onVentana={setVentana} zoomActivo={zoomActivo} />
        </div>
      )}
      {s && dominio && (
        <div key={data?.consultadoAt} className={`grid ${apiladas ? 'gap-2' : 'gap-4 md:grid-cols-2'}`}>
          {mostrar.map((x, i) => (
            <Linea
              key={x.id}
              tamano={tamano}
              orden={i}
              titulo={x.titulo}
              unidad={x.unidad}
              puntos={s[x.id]}
              escalon={x.escalon}
              dominio={dominio}
              ventana={ventana}
              onVentana={setVentana}
              multiDia={multiDia}
              zoomActivo={zoomActivo}
              onToggleZoom={() => setZoomActivo((z) => !z)}
              altura={compacto || !apiladas ? undefined : ALTURA_APILADA[tamano]}
              syncBus={syncBus}
            />
          ))}
        </div>
      )}
    </div>
  );
}
