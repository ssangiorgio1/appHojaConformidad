'use client';

import dynamic from 'next/dynamic';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { AreaSeleccionada } from '@/components/flota/FlotaMap';
import { FlotaAreaTabla } from '@/components/flota/FlotaAreaTabla';
import { useAuth } from '@/auth/AuthContext';
import { EquipoEstadoPanel } from '@/components/equipo/EquipoEstadoPanel';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { IconChevronDown, IconRefresh } from '@/components/ui/Icons';
import { Combobox } from '@/components/ui/Combobox';
import { Input } from '@/components/ui/Input';
import {
  FLOTA_CATEGORIAS_ORDEN,
  FLOTA_CATEGORIA_COLOR,
  FLOTA_CATEGORIA_DESC,
  FLOTA_CATEGORIA_LABEL,
} from '@/components/flota/categorias';
import { buscarEquipos, getFlota, refrescarFlota } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import { formatIsoDateTime } from '@/lib/format';
import type { FlotaCategoria, FlotaUnidad } from '@/lib/types';

// Leaflet toca `window` al importarse — no puede renderizarse en el servidor.
const FlotaMap = dynamic(() => import('@/components/flota/FlotaMap'), {
  ssr: false,
  loading: () => <div className="h-[420px] w-full animate-pulse rounded-lg bg-neutral-100" />,
});

// Por defecto se ocultan las "al día y reportando" (~75% de la flota): son las que coordinación
// no necesita ver y tapan al resto.
const VISIBLES_POR_DEFECTO = new Set<FlotaCategoria>(FLOTA_CATEGORIAS_ORDEN.filter((c) => c !== 'activo_reportando'));

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export default function FlotaPage() {
  const { getIdToken } = useAuth();
  const { data, loading, error, refetch } = useApiData((idToken) => getFlota(idToken), []);
  const [visibles, setVisibles] = useState<Set<FlotaCategoria>>(VISIBLES_POR_DEFECTO);
  const [busqueda, setBusqueda] = useState('');
  // En celular todo el bloque de filtros arranca plegado (en lg+ siempre se ve).
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [clientesSel, setClientesSel] = useState<string[]>([]);
  const [equipoAbierto, setEquipoAbierto] = useState<number | null>(null);
  const [seleccionando, setSeleccionando] = useState(false);
  const [area, setArea] = useState<AreaSeleccionada | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [errorRefresco, setErrorRefresco] = useState<string | null>(null);

  const conteos = useMemo(() => {
    const c: Partial<Record<FlotaCategoria, number>> = {};
    for (const u of data?.unidades ?? []) c[u.categoria] = (c[u.categoria] ?? 0) + 1;
    return c;
  }, [data]);

  const clientes = useMemo(() => {
    const c = new Map<string, number>();
    for (const u of data?.unidades ?? []) if (u.clienteNombre) c.set(u.clienteNombre, (c.get(u.clienteNombre) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'));
  }, [data]);

  // Texto de búsqueda normalizado UNA vez por carga de datos (no por cada tecla).
  const indice = useMemo(
    () =>
      (data?.unidades ?? []).map((u) => ({
        u,
        texto: normalizar(`${u.clienteNombre ?? ''} ${u.nombre} ${u.matricula ?? ''} ${u.interno ?? ''} ${u.equipoId ?? ''}`),
      })),
    [data],
  );
  const busquedaDiferida = useDeferredValue(busqueda);

  // El número de equipo que se ve en bo3 (ej. t14s398) y la serie no vienen en los datos del mapa:
  // se resuelven con el buscador de bo3 (equipo/buscar), con espera para no consultar en cada tecla.
  const [equiposDeBo3, setEquiposDeBo3] = useState<{ q: string; ids: Set<number> }>({ q: '', ids: new Set() });
  useEffect(() => {
    const q = busqueda.trim();
    if (q.length < 3) return;
    let cancelado = false;
    const t = setTimeout(async () => {
      try {
        const res = await buscarEquipos(await getIdToken(), q);
        if (!cancelado) setEquiposDeBo3({ q: normalizar(q), ids: new Set(res.map((r) => r.equipoId)) });
      } catch {
        // Sin respuesta de bo3 la búsqueda sigue funcionando por cliente, unidad, patente e interno.
      }
    }, 400);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [busqueda, getIdToken]);
  const seleccionados = useMemo(() => new Set(clientesSel), [clientesSel]);

  const filtradas = useMemo(() => {
    const q = normalizar(busquedaDiferida.trim());
    const out: FlotaUnidad[] = [];
    for (const { u, texto } of indice) {
      if (!visibles.has(u.categoria)) continue;
      if (seleccionados.size > 0 && !(u.clienteNombre && seleccionados.has(u.clienteNombre))) continue;
      if (q && !texto.includes(q) && !(equiposDeBo3.q === q && u.equipoId !== null && equiposDeBo3.ids.has(u.equipoId))) continue;
      out.push(u);
    }
    return out;
  }, [indice, visibles, busquedaDiferida, seleccionados, equiposDeBo3]);

  const enArea = useMemo(
    () =>
      area
        ? filtradas.filter(
            (u) => u.latitud <= area.norte && u.latitud >= area.sur && u.longitud <= area.este && u.longitud >= area.oeste,
          )
        : [],
    [filtradas, area],
  );

  function toggleSeleccion() {
    setSeleccionando((v) => !v);
  }

  function limpiarArea() {
    setArea(null);
    setSeleccionando(false);
  }

  function toggle(c: FlotaCategoria) {
    setVisibles((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  async function refrescar() {
    setRefrescando(true);
    setErrorRefresco(null);
    try {
      await refrescarFlota(await getIdToken());
      await refetch();
    } catch (err) {
      setErrorRefresco((err as Error).message);
    } finally {
      setRefrescando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text lg:text-2xl">Mapa de flota</h1>
          <p className="text-sm text-muted">
            Posición de las unidades de VisionBLO cruzada con el estado del abono del cliente.{' '}
            {data?.actualizadoAt ? `Datos de ${formatIsoDateTime(data.actualizadoAt)}.` : 'Todavía no hay datos cargados.'}
          </p>
        </div>
        <Button onClick={refrescar} disabled={refrescando} className="w-full justify-center sm:w-auto">
          <IconRefresh className={refrescando ? 'animate-spin' : ''} />
          {refrescando ? 'Actualizando desde VisionBLO…' : 'Actualizar desde VisionBLO'}
        </Button>
      </div>

      {(error || errorRefresco) && (
        <Card className="p-4 text-sm font-medium text-danger-700">{errorRefresco ?? error}</Card>
      )}

      <Card className="flex flex-col p-4">
        <button
          type="button"
          onClick={() => setFiltrosAbiertos((v) => !v)}
          aria-expanded={filtrosAbiertos}
          className="flex min-h-10 items-center justify-between gap-3 text-left lg:hidden"
        >
          <span className="min-w-0">
            <span className="block text-[14px] font-extrabold text-text">Filtros</span>
            <span className="block truncate text-xs font-medium text-muted">
              {loading ? 'Cargando…' : `${filtradas.length.toLocaleString('es-AR')} unidades en el mapa`}
              {clientesSel.length > 0 ? ` · ${clientesSel.length} cliente${clientesSel.length === 1 ? '' : 's'}` : ''}
              {busqueda.trim() ? ' · búsqueda' : ''}
            </span>
          </span>
          <IconChevronDown className={`flex-none text-muted transition-transform ${filtrosAbiertos ? 'rotate-180' : ''}`} />
        </button>
        {/* Despliegue animado (grid 0fr -> 1fr); en lg+ queda siempre abierto. */}
        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none lg:grid-rows-[1fr] ${
            filtrosAbiertos ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="flex flex-col gap-3 pt-3 lg:pt-0">
        <div className="flex flex-wrap gap-2">
          {FLOTA_CATEGORIAS_ORDEN.map((c) => {
            const activa = visibles.has(c);
            return (
              <button
                key={c}
                type="button"
                title={FLOTA_CATEGORIA_DESC[c]}
                onClick={() => toggle(c)}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  activa ? 'bg-neutral-100 text-text' : 'text-muted opacity-60 hover:opacity-100'
                }`}
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: activa ? FLOTA_CATEGORIA_COLOR[c] : 'transparent', border: `2px solid ${FLOTA_CATEGORIA_COLOR[c]}` }}
                />
                {FLOTA_CATEGORIA_LABEL[c]} · {(conteos[c] ?? 0).toLocaleString('es-AR')}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            className="w-full sm:max-w-sm"
            placeholder="Buscar cliente, unidad, patente o nº de equipo…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <Combobox
            ariaLabel="Filtrar por cliente"
            placeholder="Todos los clientes"
            etiquetaPlural="clientes"
            buscarPlaceholder="Buscar cliente…"
            values={clientesSel}
            onChange={setClientesSel}
            opciones={clientes.map(([nombre, n]) => ({ value: nombre, label: nombre, detalle: n.toLocaleString('es-AR') }))}
          />
          <Button onClick={toggleSeleccion}>{seleccionando ? 'Terminar selección' : 'Seleccionar área'}</Button>
          {seleccionando && (
            <span className="text-xs font-medium text-muted">
              Arrastrá sobre el mapa para marcar un rectángulo. Barra espaciadora para mover el mapa, Esc para limpiar.
            </span>
          )}
          <span className="hidden text-xs font-medium text-muted lg:inline">
            {loading ? 'Cargando…' : `${filtradas.length.toLocaleString('es-AR')} unidades en el mapa`}
          </span>
        </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex items-start gap-4">
        <Card className="relative isolate z-0 min-w-0 flex-1 overflow-hidden p-1">
          <FlotaMap
            unidades={filtradas}
            onInspectEquipo={setEquipoAbierto}
            seleccionando={seleccionando}
            area={area}
            onArea={setArea}
            enfocarClave={clientesSel.slice().sort().join('|')}
          />
        </Card>
        {equipoAbierto !== null && <EquipoEstadoPanel equipoId={equipoAbierto} onClose={() => setEquipoAbierto(null)} />}
      </div>

      {area && <FlotaAreaTabla unidades={enArea} onLimpiar={limpiarArea} />}
    </div>
  );
}
