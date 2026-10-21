'use client';

import { Fragment, useMemo, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { OFICINA, zonaPorRadio } from '@/lib/oficina';
import type { CriterioOrden, RecorridoTecnico, TramoCompartido } from '@/lib/api';
import { Combobox } from '@/components/ui/Combobox';
import { Select } from '@/components/ui/Select';
import { colorTecnico } from './rutaMapa';
import type { UbicacionEnRuta } from '@/lib/rutasAcceso';
import { kmEntre, ordenarPorAnillos } from './cercania';
import { Card } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { FlotaCategoria, FlotaUnidad } from '@/lib/types';
import { FLOTA_CATEGORIA_COLOR, FLOTA_CATEGORIA_LABEL } from './categorias';

export interface UnidadConZona {
  u: FlotaUnidad;
  zona: string | null;
  distrito: string | null;
}

// De la más urgente a la menos: 72 h o más pesa más que 24 h.
const PRIORIDAD: FlotaCategoria[] = ['sin_reportar_72h', 'corte_sin_reportar', 'sin_reportar_48h', 'sin_reportar_24h'];

function fecha(ts: number | null): string {
  return ts
    ? new Date(ts * 1000).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour12: false, dateStyle: 'short', timeStyle: 'short' })
    : 'Nunca reportó';
}

type Series = Record<number, { serie: string | null; nombre: string | null } | null>;

// Recorrido por calle ya calculado para lo marcado: parada de cada unidad (por `movilId`).
export interface RuteoLista {
  disponible: boolean;
  calculando: boolean;
  volver: boolean;
  onVolver: (v: boolean) => void;
  criterio: CriterioOrden;
  onCriterio: (c: CriterioOrden) => void;
  /** Unidad con la que arranca el recorrido (la primera visita); null = la más cercana a la oficina. */
  primeroId: number | null;
  onPrimero: (movilId: number | null) => void;
  /** Con primera visita elegida: true = sale de la oficina hacia ella; false = el recorrido empieza en ella. */
  desdeOficina: boolean;
  onDesdeOficina: (v: boolean) => void;
  /** Un recorrido por técnico (uno solo si sale un técnico). Vacío = todavía no se calculó. */
  recorridos: RecorridoTecnico[];
  /** Tramo que hacen todos juntos hasta separarse (null si salen cada uno por su lado). */
  compartido: TramoCompartido | null;
  /** Rutas de acceso entre las que se puede elegir por dónde va cada técnico. */
  rutasAcceso: Array<{ id: string; nombre: string }>;
  /** Ruta elegida por técnico (posición → id de ruta; sin valor = la que salga sola). */
  rutaTecnico: Record<number, string>;
  onRutaTecnico: (indice: number, rutaId: string) => void;
  /** Unidad hasta donde van todos juntos antes de separarse; null = salen separados. */
  juntosHastaId: number | null;
  onJuntosHasta: (movilId: number | null) => void;
  /** Nombre del técnico en esa posición ("Técnico 2" si no se eligió quién es). */
  nombreTecnico: (indice: number) => string;
  cantidad: number;
  onCantidad: (n: number) => void;
  tecnicosDisponibles: string[];
  tecnicosSel: string[];
  onTecnicosSel: (nombres: string[]) => void;
  error: string | null;
  onCalcular: () => void;
}

type ParadaDeUnidad = { tecnico: number; posicion: number; km: number };

/** Parada de cada unidad (por `movilId`) en los recorridos calculados. */
function paradaDe(recorridos: RecorridoTecnico[], movilId: number): ParadaDeUnidad | null {
  for (const r of recorridos) {
    const p = r.paradas.find((x) => x.id === movilId);
    if (p) return { tecnico: r.tecnico, posicion: p.posicion, km: p.kmDesdeAnterior };
  }
  return null;
}

function csv(filas: UnidadConZona[], series: Series, recorridos: RecorridoTecnico[], nombreTecnico: (i: number) => string): string {
  const celda = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const cab = ['Cliente', 'Unidad', 'Patente', 'Interno', 'N° de equipo (serie)', 'Nombre de equipo (bo3)', 'Zona por radio', 'Km desde la oficina (recta)', ...(recorridos.length > 0 ? ['Técnico del recorrido', 'Parada', 'Km desde la parada anterior (calle)'] : []), 'Estado', 'Último reporte', 'Departamento', 'Distrito', 'Latitud', 'Longitud'];
  const lineas = filas.map(({ u, zona, distrito }) =>
    [
      u.clienteNombre ?? `Cliente #${u.clienteId}`,
      u.nombre,
      u.matricula,
      u.interno,
      (u.equipoId !== null ? series[u.equipoId]?.serie : null) ?? '',
      (u.equipoId !== null ? series[u.equipoId]?.nombre : null) ?? '',
      Number.isFinite(u.latitud) ? `${zonaPorRadio(kmEntre(OFICINA, u)).nombre} (${zonaPorRadio(kmEntre(OFICINA, u)).rango})` : '',
      Number.isFinite(u.latitud) ? Math.round(kmEntre(OFICINA, u)) : '',
      ...(recorridos.length > 0 ? [paradaDe(recorridos, u.movilId) ? nombreTecnico(paradaDe(recorridos, u.movilId)!.tecnico) : '', paradaDe(recorridos, u.movilId)?.posicion ?? '', paradaDe(recorridos, u.movilId)?.km ?? ''] : []),
      FLOTA_CATEGORIA_LABEL[u.categoria],
      fecha(u.ultimoReporte),
      zona,
      distrito?.split('|')[1] ?? '',
      u.latitud,
      u.longitud,
    ]
      .map(celda)
      .join(','),
  );
  return `﻿${[cab.map(celda).join(','), ...lineas].join('\r\n')}`;
}

// Distancia en línea recta desde la oficina; Infinity si la unidad no tiene posición (queda al final al ordenar).
function kmOficina(u: { latitud: number; longitud: number }): number {
  return Number.isFinite(u.latitud) && Number.isFinite(u.longitud) ? kmEntre(OFICINA, u) : Number.POSITIVE_INFINITY;
}

const txtKm = (km: number) => (Number.isFinite(km) ? `${Math.round(km)} km` : 'sin posición');

type OrdenClientes = 'urgencia' | 'distancia' | 'unidades' | 'nombre';
type VistaLista = 'clientes' | 'unidades' | 'rutas';

/** Etiqueta con la ruta de acceso de una unidad. */
function EtiquetaRuta({ u }: { u: UbicacionEnRuta }) {
  return (
    <span className="ml-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold text-text" style={{ borderColor: u.ruta.color }} title={`A ${u.distanciaKm.toFixed(1)} km de la ruta; avance ${Math.round(u.avanceKm)} km desde la oficina`}>
      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: u.ruta.color }} />
      {u.ruta.nombre} · km {Math.round(u.avanceKm)}
    </span>
  );
}

function duracion(min: number): string {
  const h = Math.floor(min / 60);
  return h > 0 ? `${h} h ${min % 60} min` : `${min} min`;
}

/** Ordena las unidades de un cliente por técnico y parada; las que no entraron en un recorrido van al final. */
function ordenarPorRecorrido(filas: UnidadConZona[], recorridos: RecorridoTecnico[]): UnidadConZona[] {
  const pos = (f: UnidadConZona) => {
    const p = paradaDe(recorridos, f.u.movilId);
    return p ? p.tecnico * 1000 + p.posicion : Number.MAX_SAFE_INTEGER;
  };
  return [...filas].sort((a, b) => pos(a) - pos(b));
}

// Clientes con unidades sin reportar dentro de la zona elegida. Se marcan clientes enteros o unidades
// sueltas (la fila se despliega): lo marcado limita el mapa y arma la lista para contactar o agendar.
export function SinReportarClientes({
  filas,
  seleccion,
  onToggleUnidades,
  onSeleccionarTodos,
  onLimpiar,
  onArmarPropuesta,
  series,
  onPedirSeries,
  rutaDe,
  ruteo,
  titulo,
}: {
  /** Unidades sin reportar de la zona actual (sin recortar por lo marcado). */
  filas: UnidadConZona[];
  /** `movilId` de las unidades marcadas. */
  seleccion: Set<number>;
  onToggleUnidades: (movilIds: number[], marcar: boolean) => void;
  onSeleccionarTodos: (movilIds: number[]) => void;
  onLimpiar: () => void;
  /** Abre la propuesta de visita para lo marcado. */
  onArmarPropuesta?: () => void;
  /** N° de equipo (serie del diagnóstico) por `equipoId`; undefined = todavía no se pidió, null = bo3 no lo devolvió. */
  series: Series;
  /** Pide el N° de equipo de estas unidades (se llama al desplegar un cliente). */
  onPedirSeries: (equipoIds: number[]) => void;
  /** Ruta de acceso rápido de cada unidad (por `movilId`), si está sobre alguna de las dibujadas. */
  rutaDe?: (movilId: number) => UbicacionEnRuta | null;
  /** Recorrido por calle (si la API tiene el servicio de rutas). */
  ruteo?: RuteoLista;
  titulo: string;
}) {
  // Deja solo a los clientes con X unidades sin reportar o más.
  const [minimo, setMinimo] = useState(1);
  const [abiertos, setAbiertos] = useState<Set<number>>(new Set());
  // Cómo se ve la lista: agrupada por cliente o todas las unidades juntas (lo más cercano a la oficina primero).
  const [vistaLista, setVistaLista] = useState<VistaLista>('clientes');
  const [orden, setOrden] = useState<OrdenClientes>('urgencia');
  const todos = useMemo(() => {
    const m = new Map<number, { id: number; nombre: string; filas: UnidadConZona[] }>();
    for (const f of filas) {
      const c = m.get(f.u.clienteId) ?? { id: f.u.clienteId, nombre: f.u.clienteNombre ?? `Cliente #${f.u.clienteId}`, filas: [] };
      c.filas.push(f);
      m.set(f.u.clienteId, c);
    }
    return [...m.values()]
      .map((c) => {
        // Las unidades del cliente van por zona de radio (de la oficina hacia afuera) y, dentro de cada zona, como recorrido.
        c.filas = ruteo && ruteo.recorridos.length > 0
          ? ordenarPorRecorrido(c.filas, ruteo.recorridos)
          : ordenarPorAnillos(c.filas, (f) => f.u, OFICINA, (km) => zonaPorRadio(km).indice);
        const peor = c.filas.map((f) => f.u.categoria).sort((a, b) => PRIORIDAD.indexOf(a) - PRIORIDAD.indexOf(b))[0];
        const reportes = c.filas.map((f) => f.u.ultimoReporte).filter((t): t is number => t !== null);
        const zonas = [...new Set(c.filas.map((f) => f.zona ?? 'Fuera de Mendoza'))];
        const masCerca = Math.min(...c.filas.map((f) => kmOficina(f.u)));
        return { ...c, peor, zonas, masCerca, masViejo: reportes.length > 0 ? Math.min(...reportes) : null, nuncaReporto: reportes.length < c.filas.length };
      });
  }, [filas, ruteo?.recorridos]);
  const clientes = useMemo(() => {
    const porNombre = (a: { nombre: string }, b: { nombre: string }) => a.nombre.localeCompare(b.nombre, 'es');
    const porUrgencia = (a: (typeof todos)[number], b: (typeof todos)[number]) => PRIORIDAD.indexOf(a.peor) - PRIORIDAD.indexOf(b.peor) || b.filas.length - a.filas.length || porNombre(a, b);
    const comparar =
      orden === 'distancia'
        ? (a: (typeof todos)[number], b: (typeof todos)[number]) => a.masCerca - b.masCerca || porUrgencia(a, b)
        : orden === 'unidades'
          ? (a: (typeof todos)[number], b: (typeof todos)[number]) => b.filas.length - a.filas.length || porUrgencia(a, b)
          : orden === 'nombre'
            ? porNombre
            : porUrgencia;
    return todos.filter((c) => c.filas.length >= minimo).sort(comparar);
  }, [todos, minimo, orden]);
  // Todas las unidades de esos clientes en una sola lista: las más cercanas a la oficina primero (o, si hay un
  // recorrido calculado, por técnico y parada).
  const unidadesPlanas = useMemo(() => {
    const lista = clientes.flatMap((c) => c.filas);
    if (ruteo && ruteo.recorridos.length > 0) return ordenarPorRecorrido(lista, ruteo.recorridos);
    return [...lista].sort((a, b) => kmOficina(a.u) - kmOficina(b.u));
  }, [clientes, ruteo?.recorridos]);

  const marcadasPorCliente = (c: { filas: UnidadConZona[] }) => c.filas.filter((f) => seleccion.has(f.u.movilId)).length;
  const conMarcas = clientes.filter((c) => marcadasPorCliente(c) > 0);
  const unidadesMarcadas = conMarcas.reduce((n, c) => n + marcadasPorCliente(c), 0);
  const idsLista = clientes.flatMap((c) => c.filas.map((f) => f.u.movilId));

  // Vista por ruta de acceso: cada unidad en la ruta a la que pertenece, ordenada por avance desde la oficina.
  const gruposPorRuta = useMemo(() => {
    if (!rutaDe) return [];
    const mapa = new Map<string, { clave: string; nombre: string; color: string; filas: Array<{ f: UnidadConZona; u: UbicacionEnRuta | null }> }>();
    for (const f of unidadesPlanas) {
      const u = rutaDe(f.u.movilId);
      const clave = u ? u.ruta._id : 'sin-ruta';
      const g = mapa.get(clave) ?? { clave, nombre: u ? u.ruta.nombre : 'Fuera de las rutas de acceso', color: u ? u.ruta.color : '#9ca3af', filas: [] };
      g.filas.push({ f, u });
      mapa.set(clave, g);
    }
    return [...mapa.values()]
      .sort((a, b) => (a.clave === 'sin-ruta' ? 1 : b.clave === 'sin-ruta' ? -1 : a.nombre.localeCompare(b.nombre, 'es')))
      .map((g) => {
        const filas = [...g.filas].sort((a, b) => (a.u && b.u ? a.u.avanceKm - b.u.avanceKm : kmOficina(a.f.u) - kmOficina(b.f.u))).map((x) => x.f);
        const avances = g.filas.flatMap((x) => (x.u ? [Math.round(x.u.avanceKm)] : []));
        return { ...g, filas, alcance: avances.length > 0 ? ([Math.min(...avances), Math.max(...avances)] as [number, number]) : null };
      });
  }, [unidadesPlanas, rutaDe]);

  /** Fila de la vista por unidad o por ruta. `porRuta`: en la primera columna va el avance sobre la ruta en lugar de la distancia en línea recta. */
  function filaPlana(f: UnidadConZona, porRuta: boolean) {
    const on = seleccion.has(f.u.movilId);
    const km = kmOficina(f.u);
    const parada = ruteo ? paradaDe(ruteo.recorridos, f.u.movilId) : null;
    const enRuta = rutaDe ? rutaDe(f.u.movilId) : null;
    const esPrimera = ruteo?.primeroId === f.u.movilId;
    return (
      <TableRow key={f.u.movilId} onClick={() => onToggleUnidades([f.u.movilId], !on)} className={`cursor-pointer ${on ? 'bg-primary-50' : ''}`} aria-selected={on}>
        <TableCell>
          <input type="checkbox" checked={on} onChange={() => onToggleUnidades([f.u.movilId], !on)} onClick={(e) => e.stopPropagation()} aria-label={`Marcar ${f.u.nombre}`} />
        </TableCell>
        <TableCell>
          <span className="inline-flex flex-col leading-tight">
            <span className="font-bold text-text">{porRuta && enRuta ? `km ${Math.round(enRuta.avanceKm)}` : txtKm(km)}</span>
            {Number.isFinite(km) && <span className="text-[11px] text-muted">{porRuta && enRuta ? `a ${enRuta.distanciaKm.toFixed(1)} km de la ruta` : zonaPorRadio(km).nombre}</span>}
          </span>
        </TableCell>
        <TableCell className="text-text">
          <span className="font-medium">{f.u.nombre}</span>
          {f.u.matricula ? <span className="ml-2 text-muted">{f.u.matricula}</span> : null}
          {f.u.equipoId !== null && series[f.u.equipoId]?.serie ? <span className="ml-2 font-semibold">N° {series[f.u.equipoId]?.serie}</span> : null}
          {!porRuta && enRuta ? <EtiquetaRuta u={enRuta} /> : null}
          {parada && ruteo ? (
            <span className="ml-2 rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ backgroundColor: colorTecnico(parada.tecnico) }}>
              {ruteo.recorridos.length > 1 ? `${ruteo.nombreTecnico(parada.tecnico)} · ` : ''}Parada {parada.posicion}
            </span>
          ) : null}
          {ruteo?.disponible && on ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                ruteo.onPrimero(esPrimera ? null : f.u.movilId);
              }}
              className={`ml-2 rounded-full border px-2 py-0.5 text-[11px] font-bold ${esPrimera ? 'border-primary-600 bg-primary-600 text-white' : 'border-neutral-300 text-muted hover:text-text'}`}
              title="El recorrido arranca en esta unidad y sigue hacia las más cercanas"
            >
              {esPrimera ? '★ Primera visita' : 'Empezar acá'}
            </button>
          ) : null}
        </TableCell>
        <TableCell className="text-muted">{f.u.clienteNombre ?? `Cliente #${f.u.clienteId}`}</TableCell>
        <TableCell>
          <span className="inline-flex items-center gap-2 text-xs font-bold">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: FLOTA_CATEGORIA_COLOR[f.u.categoria] }} />
            {FLOTA_CATEGORIA_LABEL[f.u.categoria]}
          </span>
        </TableCell>
        <TableCell className="text-muted">{fecha(f.u.ultimoReporte)}</TableCell>
        <TableCell className="text-muted">{f.distrito ? `${f.zona} (${f.distrito.split('|')[1]})` : (f.zona ?? 'Fuera de Mendoza')}</TableCell>
      </TableRow>
    );
  }

  function alternarAbierto(id: number) {
    const c = clientes.find((x) => x.id === id);
    if (c && !abiertos.has(id)) onPedirSeries(c.filas.map((f) => f.u.equipoId).filter((e): e is number => e !== null));
    setAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function descargar() {
    const filasCsv = unidadesMarcadas > 0 ? clientes.flatMap((c) => c.filas.filter((f) => seleccion.has(f.u.movilId))) : clientes.flatMap((c) => c.filas);
    const url = URL.createObjectURL(new Blob([csv(filasCsv, series, ruteo?.recorridos ?? [], ruteo?.nombreTecnico ?? ((i) => `Técnico ${i + 1}`))], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `sin-reportar-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-extrabold text-text">
          {titulo} · {clientes.length.toLocaleString('es-AR')} clientes · {clientes.reduce((n, c) => n + c.filas.length, 0).toLocaleString('es-AR')} unidades
        </h2>
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
          <label className="inline-flex items-center gap-2 text-muted">
            Con
            <Input
              type="number"
              min={1}
              value={minimo}
              onChange={(e) => setMinimo(Math.max(1, Number(e.target.value) || 1))}
              className="!w-20 !py-1.5"
              aria-label="Mínimo de unidades sin reportar"
            />
            unidades o más
          </label>
          {unidadesMarcadas > 0 && (
            <span className="text-muted">
              {unidadesMarcadas} unidad{unidadesMarcadas === 1 ? '' : 'es'} de {conMarcas.length} cliente{conMarcas.length === 1 ? '' : 's'}
            </span>
          )}
          {ruteo?.disponible && unidadesMarcadas >= 2 && (
            <span className="inline-flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 text-muted">
                Técnicos
                <Input
                  type="number"
                  min={Math.max(1, ruteo.tecnicosSel.length)}
                  max={Math.min(8, unidadesMarcadas)}
                  value={Math.max(ruteo.cantidad, ruteo.tecnicosSel.length)}
                  onChange={(e) => ruteo.onCantidad(Math.max(1, Math.min(8, Number(e.target.value) || 1)))}
                  className="!w-16 !py-1.5"
                  aria-label="Cantidad de técnicos"
                />
              </label>
              <Combobox
                ariaLabel="Elegir los técnicos del recorrido"
                placeholder="Elegir quiénes (opcional)"
                etiquetaPlural="técnicos"
                buscarPlaceholder="Buscar técnico…"
                values={ruteo.tecnicosSel}
                onChange={ruteo.onTecnicosSel}
                opciones={ruteo.tecnicosDisponibles.map((n) => ({ value: n, label: n }))}
              />
              <Select value={ruteo.criterio} onChange={(e) => ruteo.onCriterio(e.target.value as CriterioOrden)} className="!w-auto !py-1.5" aria-label="Cómo ordenar las visitas">
                <option value="cercania">Del más cercano al más lejano</option>
                <option value="optimo">Recorrido más corto en total</option>
              </Select>
              {ruteo.rutasAcceso.length > 0 &&
                Array.from({ length: Math.max(ruteo.cantidad, ruteo.tecnicosSel.length) }, (_, i) => (
                  <Select
                    key={i}
                    value={ruteo.rutaTecnico[i] ?? ''}
                    onChange={(e) => ruteo.onRutaTecnico(i, e.target.value)}
                    className="!w-auto !py-1.5"
                    aria-label={`Ruta de ${ruteo.nombreTecnico(i)}`}
                    title={`Por dónde va ${ruteo.nombreTecnico(i)}`}
                    style={{ borderColor: colorTecnico(i) }}
                  >
                    <option value="">{ruteo.nombreTecnico(i)}: ruta automática</option>
                    {ruteo.rutasAcceso.map((r) => (
                      <option key={r.id} value={r.id}>
                        {ruteo.nombreTecnico(i)}: por {r.nombre}
                      </option>
                    ))}
                  </Select>
                ))}
              {Math.max(ruteo.cantidad, ruteo.tecnicosSel.length) > 1 && (
                <Select
                  value={ruteo.juntosHastaId ?? ''}
                  onChange={(e) => ruteo.onJuntosHasta(e.target.value === '' ? null : Number(e.target.value))}
                  className="!w-auto !py-1.5"
                  aria-label="Hasta dónde van juntos"
                  title="Salen juntos de la oficina hasta esa unidad y desde ahí cada uno sigue por su lado"
                >
                  <option value="">Salen separados</option>
                  {clientes.flatMap((c) => c.filas.filter((f) => seleccion.has(f.u.movilId)).map((f) => (
                    <option key={f.u.movilId} value={f.u.movilId}>
                      Juntos hasta {f.u.nombre} · {c.nombre}
                    </option>
                  )))}
                </Select>
              )}
              {ruteo.primeroId !== null && (
                <label className="inline-flex items-center gap-1.5 text-muted" title="Si no, el recorrido empieza en la primera visita y no cuenta el viaje desde la oficina">
                  <input type="checkbox" checked={ruteo.desdeOficina} onChange={(e) => ruteo.onDesdeOficina(e.target.checked)} />
                  salir desde la oficina hasta la primera visita
                </label>
              )}
              <label className="inline-flex items-center gap-1.5 text-muted">
                <input type="checkbox" checked={ruteo.volver} onChange={(e) => ruteo.onVolver(e.target.checked)} />
                con vuelta a la oficina
              </label>
              <button type="button" onClick={ruteo.onCalcular} disabled={ruteo.calculando} className="rounded-md border border-primary-600 px-3 py-1.5 text-primary-600 disabled:opacity-50">
                {ruteo.calculando ? 'Calculando…' : Math.max(ruteo.cantidad, ruteo.tecnicosSel.length) > 1 ? 'Repartir y ordenar por calle' : 'Ordenar recorrido por calle'}
              </button>
            </span>
          )}
          <button type="button" onClick={() => onSeleccionarTodos(idsLista)} className="text-primary-600">
            Marcar todo
          </button>
          {seleccion.size > 0 && (
            <button type="button" onClick={onLimpiar} className="text-primary-600">
              Limpiar marcados
            </button>
          )}
          {unidadesMarcadas > 0 && onArmarPropuesta && (
            <button type="button" onClick={onArmarPropuesta} className="rounded-md bg-primary-600 px-3 py-1.5 text-white">
              Armar propuesta de visita ({conMarcas.length})
            </button>
          )}
          <button type="button" onClick={descargar} className="text-primary-600">
            Descargar CSV {unidadesMarcadas > 0 ? 'de lo marcado' : 'de la lista'}
          </button>
        </div>
      </div>
      {ruteo?.error && <p className="text-sm font-semibold text-danger-700">{ruteo.error}</p>}
      {ruteo && ruteo.recorridos.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-md bg-neutral-100 px-3 py-2 text-xs font-bold text-text">
          <span>Recorrido por calle desde la oficina. Desplegá un cliente para ver el orden de sus paradas.</span>
          {ruteo.recorridos.map((r) => (
            <span key={r.tecnico} className="inline-flex flex-wrap items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorTecnico(r.tecnico) }} />
              {ruteo.nombreTecnico(r.tecnico)}: {r.paradas.length} parada{r.paradas.length === 1 ? '' : 's'} · {r.totalKm.toLocaleString('es-AR')} km · {duracion(r.totalMin)}
              {r.vuelta ? ` (incluye ${r.vuelta.km.toLocaleString('es-AR')} km de vuelta)` : ''}
            </span>
          ))}
          {ruteo.compartido && (
            <span className="inline-flex flex-wrap items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-neutral-500" />
              Tramo juntos (oficina → punto de separación): {ruteo.compartido.km.toLocaleString('es-AR')} km · {duracion(ruteo.compartido.min)}; los recorridos de arriba arrancan desde ahí
            </span>
          )}
          {ruteo.recorridos.length > 1 && (
            <span className="text-muted">
              Total: {(ruteo.recorridos.reduce((n, r) => n + r.totalKm, 0) + (ruteo.compartido ? ruteo.compartido.km * (ruteo.volver ? 2 : 1) : 0)).toLocaleString('es-AR', { maximumFractionDigits: 1 })} km · el más largo dura {duracion(Math.max(...ruteo.recorridos.map((r) => r.totalMin)))}
            </span>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-muted">
        <span className="inline-flex gap-1 rounded-full bg-neutral-100 p-1" role="tablist" aria-label="Forma de la lista">
          {(['clientes', 'unidades', ...(rutaDe ? (['rutas'] as const) : [])] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={vistaLista === v}
              onClick={() => setVistaLista(v)}
              className={`min-h-8 rounded-full px-3 transition ${vistaLista === v ? 'bg-white text-text shadow-sm' : 'hover:text-text'}`}
            >
              {v === 'clientes' ? 'Por cliente' : v === 'unidades' ? 'Por unidad (más cercanas primero)' : 'Por ruta de acceso'}
            </button>
          ))}
        </span>
        {vistaLista === 'clientes' && (
          <label className="inline-flex items-center gap-2">
            Ordenar clientes por
            <Select value={orden} onChange={(e) => setOrden(e.target.value as OrdenClientes)} className="!w-auto !py-1.5">
              <option value="urgencia">Urgencia (más tiempo sin reportar)</option>
              <option value="distancia">Distancia (el más cercano a la oficina)</option>
              <option value="unidades">Cantidad de unidades</option>
              <option value="nombre">Nombre</option>
            </Select>
          </label>
        )}
        {vistaLista === 'unidades' && <span>{ruteo && ruteo.recorridos.length > 0 ? 'Ordenadas por técnico y parada.' : 'Ordenadas por distancia en línea recta desde la oficina.'}</span>}
        {vistaLista === 'rutas' && <span>Cada unidad en la ruta de acceso que le queda a menos de su ancho; dentro de la ruta, de la oficina hacia afuera.</span>}
      </div>
      {(vistaLista === 'unidades' || vistaLista === 'rutas') && unidadesPlanas.length > 0 ? (
        <div className="max-h-[560px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead className="text-xs font-bold uppercase text-muted">{vistaLista === 'rutas' ? 'Avance' : 'Distancia'}</TableHead>
                <TableHead className="text-xs font-bold uppercase text-muted">Unidad</TableHead>
                <TableHead className="text-xs font-bold uppercase text-muted">Cliente</TableHead>
                <TableHead className="text-xs font-bold uppercase text-muted">Estado</TableHead>
                <TableHead className="text-xs font-bold uppercase text-muted">Último reporte</TableHead>
                <TableHead className="text-xs font-bold uppercase text-muted">Lugar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vistaLista === 'unidades'
                ? unidadesPlanas.map((f) => filaPlana(f, false))
                : gruposPorRuta.map((g) => (
                    <Fragment key={g.clave}>
                      <TableRow className="bg-neutral-100 hover:bg-neutral-100">
                        <TableCell colSpan={7} className="py-2">
                          <span className="inline-flex flex-wrap items-center gap-2 text-xs font-extrabold uppercase text-text">
                            <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: g.color }} />
                            {g.nombre} · {g.filas.length} unidad{g.filas.length === 1 ? '' : 'es'}
                            {g.alcance ? <span className="font-medium normal-case text-muted">de km {g.alcance[0]} a km {g.alcance[1]} desde la oficina</span> : null}
                          </span>
                        </TableCell>
                      </TableRow>
                      {g.filas.map((f) => filaPlana(f, true))}
                    </Fragment>
                  ))}
            </TableBody>
          </Table>
        </div>
      ) : clientes.length === 0 ? (
        <p className="text-sm text-muted">No hay clientes con estos filtros en esta zona.</p>
      ) : (
        <div className="max-h-[520px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead className="text-xs font-bold uppercase text-muted">Cliente</TableHead>
                <TableHead className="text-xs font-bold uppercase text-muted">Unidades</TableHead>
                <TableHead className="text-xs font-bold uppercase text-muted">Más cercana</TableHead>
                <TableHead className="text-xs font-bold uppercase text-muted">Peor estado</TableHead>
                <TableHead className="text-xs font-bold uppercase text-muted">Último reporte más viejo</TableHead>
                <TableHead className="text-xs font-bold uppercase text-muted">Zonas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientes.map((c) => {
                const marcadas = marcadasPorCliente(c);
                const todas = marcadas === c.filas.length;
                const abierto = abiertos.has(c.id);
                const ids = c.filas.map((f) => f.u.movilId);
                return (
                  <Fragment key={c.id}>
                    <TableRow onClick={() => alternarAbierto(c.id)} className={`cursor-pointer ${marcadas > 0 ? 'bg-primary-50' : ''}`} aria-expanded={abierto}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={todas}
                          ref={(el) => {
                            if (el) el.indeterminate = marcadas > 0 && !todas;
                          }}
                          onChange={() => onToggleUnidades(ids, !todas)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Marcar todas las unidades de ${c.nombre}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-text">
                        <span className="inline-flex items-center gap-2">
                          <span aria-hidden className={`inline-block text-xs text-muted transition-transform duration-200 ${abierto ? 'rotate-90' : ''}`}>
                            ▸
                          </span>
                          {c.nombre}
                        </span>
                      </TableCell>
                      <TableCell>{marcadas > 0 && !todas ? `${marcadas} de ${c.filas.length}` : c.filas.length}</TableCell>
                      <TableCell className="font-semibold text-text" title="Distancia en línea recta desde la oficina a su unidad más cercana">
                        {txtKm(c.masCerca)}
                        {Number.isFinite(c.masCerca) && <span className="ml-1.5 text-[11px] font-medium text-muted">{zonaPorRadio(c.masCerca).nombre}</span>}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-2 text-xs font-bold">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: FLOTA_CATEGORIA_COLOR[c.peor] }} />
                          {FLOTA_CATEGORIA_LABEL[c.peor]}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted">{c.masViejo === null ? 'Nunca reportó' : `${fecha(c.masViejo)}${c.nuncaReporto ? ' (y alguna nunca)' : ''}`}</TableCell>
                      <TableCell className="text-muted">{c.zonas.length > 3 ? `${c.zonas.slice(0, 3).join(', ')} +${c.zonas.length - 3}` : c.zonas.join(', ')}</TableCell>
                    </TableRow>
                    {abierto &&
                      c.filas.map((f) => {
                        const on = seleccion.has(f.u.movilId);
                        return (
                          <TableRow key={f.u.movilId} onClick={() => onToggleUnidades([f.u.movilId], !on)} className={`cursor-pointer ${on ? 'bg-primary-50' : 'bg-neutral-50'}`} aria-selected={on}>
                            <TableCell className="pl-6">
                              <input type="checkbox" checked={on} onChange={() => onToggleUnidades([f.u.movilId], !on)} onClick={(e) => e.stopPropagation()} aria-label={`Marcar ${f.u.nombre}`} />
                            </TableCell>
                            <TableCell className="text-text">
                              {f.u.nombre}
                              {f.u.matricula ? <span className="ml-2 text-muted">{f.u.matricula}</span> : null}
                              {f.u.interno ? <span className="ml-2 text-muted">int. {f.u.interno}</span> : null}
                              {rutaDe && rutaDe(f.u.movilId) ? <EtiquetaRuta u={rutaDe(f.u.movilId)!} /> : null}
                              {ruteo && paradaDe(ruteo.recorridos, f.u.movilId) ? (
                                <span
                                  className="ml-2 rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
                                  style={{ backgroundColor: colorTecnico(paradaDe(ruteo.recorridos, f.u.movilId)!.tecnico) }}
                                  title="Orden de la visita por calle"
                                >
                                  {ruteo.recorridos.length > 1 ? `${ruteo.nombreTecnico(paradaDe(ruteo.recorridos, f.u.movilId)!.tecnico)} · ` : ''}Parada {paradaDe(ruteo.recorridos, f.u.movilId)!.posicion} · +
                                  {paradaDe(ruteo.recorridos, f.u.movilId)!.km.toLocaleString('es-AR')} km
                                </span>
                              ) : null}
                              {Number.isFinite(f.u.latitud) && Number.isFinite(f.u.longitud) ? (
                                <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-bold text-text" title={`Distancia en línea recta desde la oficina: ${Math.round(kmEntre(OFICINA, f.u))} km`}>
                                  {zonaPorRadio(kmEntre(OFICINA, f.u)).nombre} · {zonaPorRadio(kmEntre(OFICINA, f.u)).rango}
                                </span>
                              ) : null}
                              {f.u.equipoId !== null && series[f.u.equipoId]?.serie ? <span className="ml-2 font-semibold text-text">N° {series[f.u.equipoId]?.serie}</span> : null}
                            </TableCell>
                            <TableCell />
                            <TableCell>
                              <span className="inline-flex items-center gap-2 text-xs font-bold">
                                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: FLOTA_CATEGORIA_COLOR[f.u.categoria] }} />
                                {FLOTA_CATEGORIA_LABEL[f.u.categoria]}
                              </span>
                            </TableCell>
                            <TableCell className="text-muted">{fecha(f.u.ultimoReporte)}</TableCell>
                            <TableCell className="text-muted">{f.distrito ? `${f.zona} (${f.distrito.split('|')[1]})` : (f.zona ?? 'Fuera de Mendoza')}</TableCell>
                          </TableRow>
                        );
                      })}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
