'use client';

import dynamic from 'next/dynamic';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { AreaSeleccionada } from '@/components/flota/FlotaMap';
import { FlotaAreaTabla } from '@/components/flota/FlotaAreaTabla';
import { ubicar, type ZonaFeature } from '@/lib/zonas';
import { useAuth } from '@/auth/AuthContext';
import { EquipoEstadoPanel } from '@/components/equipo/EquipoEstadoPanel';
import { ordenarPorAnillos } from '@/components/flota/cercania';
import { OFICINA, zonaPorRadio } from '@/lib/oficina';
import { colorTecnico, type RutaMapa } from '@/components/flota/rutaMapa';
import { ClientesEnMapa } from '@/components/flota/ClientesEnMapa';
import { PlanificacionRutas } from '@/components/flota/PlanificacionRutas';
import { PropuestaVisita } from '@/components/flota/PropuestaVisita';
import { rutaDelPunto, type RutaAcceso, type TerritorioTecnico } from '@/lib/rutasAcceso';
import { SinReportarClientes, type UnidadConZona } from '@/components/flota/SinReportarClientes';
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
import { buscarEquipos, getFlota, listRutasAcceso, listTerritorios, getRuteoEstado, getSeriesEquipos, listUsuarios, ordenarVisitasVariosTecnicos, refrescarFlota, type CriterioOrden, type RecorridoTecnico, type SerieEquipo, type TramoCompartido } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import { formatIsoDateTime } from '@/lib/format';
import type { FlotaCategoria, FlotaUnidad } from '@/lib/types';

// Leaflet toca `window` al importarse — no puede renderizarse en el servidor.
const FlotaMap = dynamic(() => import('@/components/flota/FlotaMap'), {
  ssr: false,
  loading: () => <div className="h-[420px] w-full animate-pulse rounded-lg bg-neutral-100" />,
});

const FlotaZonasMap = dynamic(() => import('@/components/flota/FlotaZonasMap'), {
  ssr: false,
  loading: () => <div className="h-[420px] w-full animate-pulse rounded-lg bg-neutral-100" />,
});

const FlotaZonasBklit = dynamic(() => import('@/components/flota/FlotaZonasBklit'), {
  ssr: false,
  loading: () => <div className="h-[420px] w-full animate-pulse rounded-lg bg-neutral-100" />,
});

const TRAMOS_SIN_REPORTAR: FlotaCategoria[] = ['sin_reportar_72h', 'sin_reportar_48h', 'sin_reportar_24h', 'corte_sin_reportar'];
const TRAMOS_SIN_REPORTAR_POR_DEFECTO: FlotaCategoria[] = ['sin_reportar_72h', 'sin_reportar_48h', 'sin_reportar_24h'];

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
  const [vista, setVista] = useState<'unidades' | 'zonas' | 'sinreportar' | 'rutas'>('unidades');
  // Estados que cuentan como "sin reportar" en esa vista (los cortes de servicio van aparte: no es una falla técnica).
  const [tramos, setTramos] = useState<Set<FlotaCategoria>>(new Set(TRAMOS_SIN_REPORTAR_POR_DEFECTO));
  // Unidades marcadas en la lista de "Sin reportar" (`movilId`): clientes enteros o unidades sueltas.
  const [unidadesSel, setUnidadesSel] = useState<Set<number>>(new Set());
  const [propuestaAbierta, setPropuestaAbierta] = useState(false);
  // N° de equipo (serie del diagnóstico de bo3) por `equipoId`: se pide solo para lo marcado o desplegado.
  const [series, setSeries] = useState<Record<number, SerieEquipo | null>>({});
  const seriesPedidas = useRef(new Set<number>());
  // Rutas por calle: solo si la API tiene el servicio configurado (ROUTING_URL); si no, todo sigue por radios.
  const [ruteoDisponible, setRuteoDisponible] = useState(false);
  const [recorridos, setRecorridos] = useState<RecorridoTecnico[]>([]);
  const [compartido, setCompartido] = useState<TramoCompartido | null>(null);
  // Ruta de acceso por la que va cada técnico (por posición; vacío = la que salga sola) y unidad hasta donde van todos juntos.
  const [rutaTecnico, setRutaTecnico] = useState<Record<number, string>>({});
  const [juntosHastaId, setJuntosHastaId] = useState<number | null>(null);
  const [cantidadTecnicos, setCantidadTecnicos] = useState(1);
  const [tecnicosRuta, setTecnicosRuta] = useState<string[]>([]);
  const [volverOficina, setVolverOficina] = useState(false);
  const [criterioRuta, setCriterioRuta] = useState<CriterioOrden>('cercania');
  // Primera visita del recorrido (la unidad con la que arranca) y si sale de la oficina hasta ella.
  const [primeroId, setPrimeroId] = useState<number | null>(null);
  const [desdeOficina, setDesdeOficina] = useState(true);
  // Rutas de acceso rápido y territorios por técnico (se dibujan y asignan en la pestaña "Rutas").
  const [rutasAcceso, setRutasAcceso] = useState<RutaAcceso[]>([]);
  const [territorios, setTerritorios] = useState<TerritorioTecnico[]>([]);
  const [calculandoRuta, setCalculandoRuta] = useState(false);
  const [errorRuta, setErrorRuta] = useState<string | null>(null);
  const [medida, setMedida] = useState<'clientes' | 'unidades'>('clientes');
  const [zonaSel, setZonaSel] = useState<string | null>(null);
  const [distritoSel, setDistritoSel] = useState<string | null>(null);
  const [conCalles, setConCalles] = useState(false);
  // Círculos de las zonas por radio alrededor de la oficina.
  const [verRadios, setVerRadios] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [errorRefresco, setErrorRefresco] = useState<string | null>(null);

  // Antigüedad de la foto de la flota, en horas (la flota no se refresca sola: solo con el botón).
  const edadDatosH = useMemo(() => (data?.actualizadoAt ? (Date.now() - new Date(data.actualizadoAt).getTime()) / 3_600_000 : null), [data]);

  const conteos = useMemo(() => {
    const c: Partial<Record<FlotaCategoria, number>> = {};
    for (const u of data?.unidades ?? []) c[u.categoria] = (c[u.categoria] ?? 0) + 1;
    return c;
  }, [data]);

  // Opciones del desplegable de clientes. En "Sin reportar" solo aparecen los clientes que tienen
  // unidades en alguno de los estados marcados, y el número es de esas unidades.
  const clientes = useMemo(() => {
    const c = new Map<string, number>();
    for (const u of data?.unidades ?? []) {
      if (vista === 'sinreportar' && !tramos.has(u.categoria)) continue;
      if (u.clienteNombre) c.set(u.clienteNombre, (c.get(u.clienteNombre) ?? 0) + 1);
    }
    return [...c.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'));
  }, [data, vista, tramos]);

  // Si al cambiar de estado un cliente elegido ya no tiene unidades en esos estados, se saca de la selección
  // (si no, seguiría filtrando sin poder verse ni quitarse en el desplegable).
  useEffect(() => {
    if (vista !== 'sinreportar') return;
    const disponibles = new Set(clientes.map(([nombre]) => nombre));
    setClientesSel((prev) => (prev.every((n) => disponibles.has(n)) ? prev : prev.filter((n) => disponibles.has(n))));
  }, [vista, clientes]);

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

  // Unidades según estados y búsqueda, SIN el filtro de clientes (la lista de clientes necesita ver a todos
  // para poder elegir más de uno).
  const sinFiltroCliente = useMemo(() => {
    const q = normalizar(busquedaDiferida.trim());
    const out: FlotaUnidad[] = [];
    for (const { u, texto } of indice) {
      if (!visibles.has(u.categoria)) continue;
      if (q && !texto.includes(q) && !(equiposDeBo3.q === q && u.equipoId !== null && equiposDeBo3.ids.has(u.equipoId))) continue;
      out.push(u);
    }
    return out;
  }, [indice, visibles, busquedaDiferida, equiposDeBo3]);
  const filtradas = useMemo(
    () => (seleccionados.size > 0 ? sinFiltroCliente.filter((u) => u.clienteNombre && seleccionados.has(u.clienteNombre)) : sinFiltroCliente),
    [sinFiltroCliente, seleccionados],
  );

  // Zonas: se cuenta TODA la flota (sin el filtro por estado, que oculta las "al día"), respetando
  // solo cliente y búsqueda. El departamento y el distrito salen de la última posición de cada unidad
  // y se calculan una sola vez por carga de datos (no por cada filtro).
  const ubicaciones = useMemo(() => indice.map(({ u }) => ubicar(u.latitud, u.longitud)), [indice]);
  const esZonas = vista !== 'unidades';
  // `baseZona`: lo que cuenta la vista (en "Sin reportar", solo esos estados). `unidadesZona`: además
  // recortado a los clientes marcados en la lista de "Sin reportar".
  const baseZona = useMemo(() => {
    const q = normalizar(busquedaDiferida.trim());
    const out: { u: FlotaUnidad; zona: string | null; distrito: string | null }[] = [];
    indice.forEach(({ u, texto }, i) => {
      if (vista === 'sinreportar' && !tramos.has(u.categoria)) return;
      if (seleccionados.size > 0 && !(u.clienteNombre && seleccionados.has(u.clienteNombre))) return;
      if (q && !texto.includes(q)) return;
      out.push({ u, zona: ubicaciones[i].departamento, distrito: ubicaciones[i].distrito });
    });
    return out;
  }, [indice, ubicaciones, seleccionados, busquedaDiferida, vista, tramos]);
  const unidadesZona = useMemo(
    () => (vista === 'sinreportar' && unidadesSel.size > 0 ? baseZona.filter((x) => unidadesSel.has(x.u.movilId)) : baseZona),
    [baseZona, unidadesSel, vista],
  );
  // Clientes marcados con las unidades de la zona actual, para la propuesta de visita.
  const clientesPropuesta = useMemo(() => {
    const m = new Map<number, { id: number; nombre: string; filas: UnidadConZona[] }>();
    for (const f of baseZona) {
      if (!unidadesSel.has(f.u.movilId)) continue;
      if (zonaSel && f.zona !== zonaSel) continue;
      if (distritoSel && f.distrito !== distritoSel) continue;
      const c = m.get(f.u.clienteId) ?? { id: f.u.clienteId, nombre: f.u.clienteNombre ?? `Cliente #${f.u.clienteId}`, filas: [] };
      c.filas.push(f);
      m.set(f.u.clienteId, c);
    }
    // Las unidades de cada documento van en orden de recorrido saliendo de la oficina (cada una al lado de la más cercana).
    const posicion = (f: UnidadConZona) => {
      for (const r of recorridos) {
        const p = r.paradas.find((x) => x.id === f.u.movilId);
        if (p) return r.tecnico * 1000 + p.posicion;
      }
      return Number.MAX_SAFE_INTEGER;
    };
    return [...m.values()]
      .map((c) => ({ ...c, filas: recorridos.length > 0 ? [...c.filas].sort((a, b) => posicion(a) - posicion(b)) : ordenarPorAnillos(c.filas, (f) => f.u, OFICINA, (km) => zonaPorRadio(km).indice) }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [baseZona, unidadesSel, zonaSel, distritoSel, recorridos]);

  // Lista de clientes afectados de la zona actual (no se recorta por los marcados, para poder marcar más).
  const filasSinReportar = useMemo(
    () => baseZona.filter((x) => (!zonaSel || x.zona === zonaSel) && (!distritoSel || x.distrito === distritoSel)),
    [baseZona, zonaSel, distritoSel],
  );

  // Valores por id de zona: el nombre del departamento o la clave `Departamento|Distrito`.
  const valoresZona = useMemo(() => {
    const unidades = new Map<string, number>();
    const clientesPorZona = new Map<string, Set<number>>();
    const sumar = (id: string, u: FlotaUnidad) => {
      unidades.set(id, (unidades.get(id) ?? 0) + 1);
      let set = clientesPorZona.get(id);
      if (!set) clientesPorZona.set(id, (set = new Set()));
      set.add(u.clienteId);
    };
    for (const { u, zona, distrito } of unidadesZona) {
      if (!zona) continue;
      sumar(zona, u);
      if (distrito) sumar(distrito, u);
    }
    const clientes = new Map([...clientesPorZona].map(([z, set]) => [z, set.size]));
    return { clientes, unidades, fuera: unidadesZona.filter((x) => !x.zona).length };
  }, [unidadesZona]);

  const enZona = useMemo(
    () =>
      zonaSel
        ? unidadesZona.filter((x) => x.zona === zonaSel && (!distritoSel || x.distrito === distritoSel)).map((x) => x.u)
        : [],
    [unidadesZona, zonaSel, distritoSel],
  );

  const pedirSeries = useCallback(
    async (ids: number[]) => {
      const nuevos = [...new Set(ids)].filter((id) => !seriesPedidas.current.has(id));
      if (nuevos.length === 0) return;
      nuevos.forEach((id) => seriesPedidas.current.add(id));
      try {
        const idToken = await getIdToken();
        // De a 100 para no hacer pedidos enormes.
        for (let i = 0; i < nuevos.length; i += 100) {
          const res = await getSeriesEquipos(idToken, nuevos.slice(i, i + 100));
          setSeries((prev) => ({ ...prev, ...Object.fromEntries(Object.entries(res).map(([k, v]) => [Number(k), v])) }));
        }
      } catch {
        // Si bo3 no responde se puede volver a pedir más tarde (el número es opcional en las listas).
        nuevos.forEach((id) => seriesPedidas.current.delete(id));
      }
    },
    [getIdToken],
  );

  // Las unidades marcadas necesitan su N° de equipo para la lista, el CSV y la propuesta.
  useEffect(() => {
    if (vista !== 'sinreportar' || unidadesSel.size === 0) return;
    const t = setTimeout(() => {
      const ids = baseZona.filter((x) => unidadesSel.has(x.u.movilId) && x.u.equipoId !== null).map((x) => x.u.equipoId as number);
      void pedirSeries(ids);
    }, 400);
    return () => clearTimeout(t);
  }, [vista, unidadesSel, baseZona, pedirSeries]);

  // ¿La API tiene el servicio de rutas? Se pregunta una vez; si no responde se asume que no.
  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const ok = await getRuteoEstado(await getIdToken());
        if (!cancelado) setRuteoDisponible(ok);
      } catch {
        if (!cancelado) setRuteoDisponible(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [getIdToken]);

  // Rutas y territorios guardados: se cargan al entrar a "Sin reportar" (si falla, la lista sigue sin rutas).
  useEffect(() => {
    if (vista !== 'sinreportar') return;
    let cancelado = false;
    void (async () => {
      try {
        const idToken = await getIdToken();
        const [r, t] = await Promise.all([listRutasAcceso(idToken), listTerritorios(idToken)]);
        if (!cancelado) {
          setRutasAcceso(r);
          setTerritorios(t);
        }
      } catch {
        // Sin rutas guardadas (o la API todavía no las tiene) se planifica solo por zonas y distancia.
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [vista, getIdToken]);

  // A qué ruta de acceso pertenece cada unidad y cuánto avanzó por ella.
  const rutaPorUnidad = useMemo(() => {
    const m = new Map<number, ReturnType<typeof rutaDelPunto>>();
    if (rutasAcceso.length === 0) return m;
    for (const x of baseZona) m.set(x.u.movilId, rutaDelPunto(x.u, rutasAcceso));
    return m;
  }, [baseZona, rutasAcceso]);

  // La primera visita tiene que seguir marcada.
  useEffect(() => {
    if (primeroId !== null && !unidadesSel.has(primeroId)) setPrimeroId(null);
  }, [primeroId, unidadesSel]);

  // Si cambia lo marcado, el recorrido calculado ya no corresponde.
  useEffect(() => {
    setRecorridos([]);
    setCompartido(null);
    setErrorRuta(null);
  }, [unidadesSel, volverOficina, cantidadTecnicos, tecnicosRuta, criterioRuta, primeroId, desdeOficina, rutaTecnico, juntosHastaId]);

  // El punto donde se separan tiene que seguir marcado.
  useEffect(() => {
    if (juntosHastaId !== null && !unidadesSel.has(juntosHastaId)) setJuntosHastaId(null);
  }, [juntosHastaId, unidadesSel]);

  async function calcularRecorrido() {
    const puntos = baseZona
      .filter((x) => unidadesSel.has(x.u.movilId) && Number.isFinite(x.u.latitud) && Number.isFinite(x.u.longitud))
      .map((x) => {
        // Territorio: los técnicos elegidos a los que les pertenece la zona de esta unidad (uno o varios: una zona
        // se puede compartir y entonces sus unidades se reparten entre ellos).
        const tecnicos = tecnicosRuta.flatMap((nombre, i) => {
          const t = territorios.find((y) => y.tecnicoNombre === nombre);
          if (!t) return [];
          const ruta = rutaPorUnidad.get(x.u.movilId);
          const suyo = (ruta && t.rutas.includes(ruta.ruta._id)) || (x.zona && t.departamentos.includes(x.zona)) || (x.distrito && t.distritos.includes(x.distrito));
          return suyo ? [i] : [];
        });
        return { id: x.u.movilId, latitud: x.u.latitud, longitud: x.u.longitud, ...(tecnicos.length > 0 ? { tecnicos } : {}) };
      });
    if (puntos.length === 0) return;
    setCalculandoRuta(true);
    setErrorRuta(null);
    try {
      const nTec = Math.min(Math.max(cantidadTecnicos, tecnicosRuta.length), puntos.length);
      const vias = Array.from({ length: nTec }, (_, i) => rutasAcceso.find((r) => r._id === rutaTecnico[i])?.puntos ?? []);
      const sep = juntosHastaId !== null ? baseZona.find((x) => x.u.movilId === juntosHastaId)?.u : undefined;
      const r = await ordenarVisitasVariosTecnicos(await getIdToken(), { latitud: OFICINA.latitud, longitud: OFICINA.longitud }, puntos, nTec, volverOficina, criterioRuta, {
        ...(primeroId !== null ? { primeroId, desdeOficina } : {}),
        ...(vias.some((v) => v.length > 0) ? { vias } : {}),
        ...(sep && nTec > 1 ? { juntosHasta: { latitud: sep.latitud, longitud: sep.longitud } } : {}),
      });
      setRecorridos(r.recorridos);
      setCompartido(r.compartido);
    } catch (err) {
      setErrorRuta(`No se pudo calcular el recorrido por calle: ${(err as Error).message}`);
    } finally {
      setCalculandoRuta(false);
    }
  }

  // Traza y paradas del recorrido por calle para los mapas (las paradas llevan el nombre de la unidad y su cliente).
  const nombreTecnico = useCallback((i: number) => tecnicosRuta[i] ?? `Técnico ${i + 1}`, [tecnicosRuta]);
  const rutasMapa = useMemo<RutaMapa[]>(() => {
    const porId = new Map(baseZona.map((x) => [x.u.movilId, x.u]));
    const juntos: RutaMapa[] = compartido && compartido.geometria.length >= 2 ? [{ etiqueta: 'Tramo juntos', color: '#6b7280', geometria: compartido.geometria, paradas: [] }] : [];
    return [...juntos, ...recorridos
      .filter((r) => r.geometria.length >= 2)
      .map((r) => ({
        etiqueta: nombreTecnico(r.tecnico),
        color: colorTecnico(r.tecnico),
        geometria: r.geometria,
        paradas: r.paradas.flatMap((p) => {
          const u = porId.get(Number(p.id));
          return u ? [{ posicion: p.posicion, latitud: u.latitud, longitud: u.longitud, titulo: `${nombreTecnico(r.tecnico)} · ${p.posicion}. ${u.nombre} · ${u.clienteNombre ?? `Cliente #${u.clienteId}`}` }] : [];
        }),
      }))];
  }, [recorridos, compartido, baseZona, nombreTecnico]);

  // Técnicos con rol técnico para elegirlos en el recorrido, y el técnico que le toca a cada cliente según las paradas.
  const { data: usuariosRuta } = useApiData((idToken) => listUsuarios(idToken), []);
  const tecnicosDisponibles = useMemo(
    () => (usuariosRuta ?? []).filter((u) => u.role === 'tecnico' && u.activo).map((u) => u.nombre).sort((a, b) => a.localeCompare(b, 'es')),
    [usuariosRuta],
  );
  const tecnicoSugerido = useMemo(() => {
    const out: Record<number, string> = {};
    if (recorridos.length < 1 || tecnicosRuta.length === 0) return out;
    const porId = new Map(baseZona.map((x) => [x.u.movilId, x.u]));
    for (const r of recorridos) {
      for (const p of r.paradas) {
        const u = porId.get(Number(p.id));
        if (u && out[u.clienteId] === undefined && tecnicosRuta[r.tecnico]) out[u.clienteId] = tecnicosRuta[r.tecnico];
      }
    }
    return out;
  }, [recorridos, tecnicosRuta, baseZona]);

  function elegirZona(z: ZonaFeature) {
    if (z.tipo === 'distrito') {
      setDistritoSel((prev) => (prev === z.id ? null : z.id));
    } else if (z.departamento === zonaSel) {
      setZonaSel(null);
      setDistritoSel(null);
    } else {
      setZonaSel(z.departamento);
      setDistritoSel(null);
    }
  }

  // Puntos del mapa: con una zona elegida, sus unidades; en "Sin reportar" sin zona elegida, lo marcado en la
  // tabla (de cualquier zona), así se ve dónde está aunque no se haya tocado ningún departamento ni distrito.
  const puntosMapa = useMemo(
    () => (zonaSel ? enZona : vista === 'sinreportar' && unidadesSel.size > 0 ? unidadesZona.map((x) => x.u) : []),
    [zonaSel, enZona, vista, unidadesSel, unidadesZona],
  );

  const nombreDistrito = distritoSel ? distritoSel.split('|')[1] : null;
  const idZonaActual = distritoSel ?? zonaSel;

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

  const barraVistas = (
    <div className="flex gap-1 self-start overflow-x-auto rounded-full bg-neutral-100 p-1" role="tablist">
      {(['unidades', 'zonas', 'sinreportar', 'rutas'] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={vista === v}
          onClick={() => setVista(v)}
          className={`min-h-9 whitespace-nowrap rounded-full px-4 text-[13px] font-bold transition ${vista === v ? 'bg-white text-text shadow-sm' : 'text-muted hover:text-text'}`}
        >
          {v === 'unidades' ? 'Unidades' : v === 'zonas' ? 'Zonas' : v === 'sinreportar' ? 'Sin reportar' : 'Rutas y territorios'}
        </button>
      ))}
    </div>
  );

  // Dibujo de rutas de acceso y territorios: no usa los datos de la flota ni sus filtros.
  if (vista === 'rutas') {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-bold text-text lg:text-2xl">Rutas y territorios</h1>
          <p className="text-sm text-muted">Rutas de acceso rápido y zonas reservadas a cada técnico para planificar las visitas.</p>
        </div>
        {barraVistas}
        <PlanificacionRutas />
      </div>
    );
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

      {vista === 'sinreportar' && edadDatosH !== null && edadDatosH >= 6 && (
        <Card className="p-4 text-sm font-medium text-text">
          <strong>Los datos tienen {edadDatosH >= 48 ? `${Math.floor(edadDatosH / 24)} días` : `${Math.floor(edadDatosH)} horas`}.</strong>{' '}
          Esta lista sale de la última foto de la flota: una unidad que figura sin reportar puede haber vuelto a reportar desde entonces.
          Tocá «Actualizar desde VisionBLO» antes de contactar a un cliente.
        </Card>
      )}

      {(error || errorRefresco) && (
        <Card className="p-4 text-sm font-medium text-danger-700">{errorRefresco ?? error}</Card>
      )}

      {barraVistas}

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
        {vista === 'sinreportar' && (
          <div className="flex flex-wrap gap-2.5 lg:gap-2">
            {TRAMOS_SIN_REPORTAR.map((c) => {
              const activa = tramos.has(c);
              return (
                <button
                  key={c}
                  type="button"
                  title={FLOTA_CATEGORIA_DESC[c]}
                  onClick={() =>
                    setTramos((prev) => {
                      const next = new Set(prev);
                      if (next.has(c)) next.delete(c);
                      else next.add(c);
                      return next;
                    })
                  }
                  className={`inline-flex min-h-11 items-center gap-2.5 rounded-full px-4 py-2.5 text-[13px] font-bold transition lg:min-h-0 lg:gap-2 lg:px-3 lg:py-1.5 lg:text-xs ${
                    activa ? 'bg-neutral-100 text-text' : 'text-muted opacity-60 hover:opacity-100'
                  }`}
                >
                  <span
                    className="inline-block h-3 w-3 flex-none rounded-full lg:h-2.5 lg:w-2.5"
                    style={{ backgroundColor: activa ? FLOTA_CATEGORIA_COLOR[c] : 'transparent', border: `2px solid ${FLOTA_CATEGORIA_COLOR[c]}` }}
                  />
                  {FLOTA_CATEGORIA_LABEL[c]} · {(conteos[c] ?? 0).toLocaleString('es-AR')}
                </button>
              );
            })}
          </div>
        )}
        {vista === 'unidades' && <div className="flex flex-wrap gap-2.5 lg:gap-2">
          {FLOTA_CATEGORIAS_ORDEN.map((c) => {
            const activa = visibles.has(c);
            return (
              <button
                key={c}
                type="button"
                title={FLOTA_CATEGORIA_DESC[c]}
                onClick={() => toggle(c)}
                className={`inline-flex min-h-11 items-center gap-2.5 rounded-full px-4 py-2.5 text-[13px] font-bold transition lg:min-h-0 lg:gap-2 lg:px-3 lg:py-1.5 lg:text-xs ${
                  activa ? 'bg-neutral-100 text-text' : 'text-muted opacity-60 hover:opacity-100'
                }`}
              >
                <span
                  className="inline-block h-3 w-3 flex-none rounded-full lg:h-2.5 lg:w-2.5"
                  style={{ backgroundColor: activa ? FLOTA_CATEGORIA_COLOR[c] : 'transparent', border: `2px solid ${FLOTA_CATEGORIA_COLOR[c]}` }}
                />
                {FLOTA_CATEGORIA_LABEL[c]} · {(conteos[c] ?? 0).toLocaleString('es-AR')}
              </button>
            );
          })}
        </div>}
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
          {vista === 'unidades' && (
            <Button onClick={toggleSeleccion} className="min-h-11 w-full justify-center sm:w-auto">{seleccionando ? 'Terminar selección' : 'Seleccionar área'}</Button>
          )}
          {esZonas && (
            <div className="flex gap-1 rounded-full bg-neutral-100 p-1">
              {(['clientes', 'unidades'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={medida === m}
                  onClick={() => setMedida(m)}
                  className={`min-h-9 rounded-full px-3 text-xs font-bold transition ${medida === m ? 'bg-white text-text shadow-sm' : 'text-muted hover:text-text'}`}
                >
                  Pintar por {m}
                </button>
              ))}
            </div>
          )}
          {esZonas && (
            <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-xs font-bold text-muted">
              <input type="checkbox" checked={conCalles} onChange={(e) => setConCalles(e.target.checked)} />
              Ver con calles
            </label>
          )}
          {esZonas && (
            <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-xs font-bold text-muted">
              <input type="checkbox" checked={verRadios} onChange={(e) => setVerRadios(e.target.checked)} />
              Ver radios de la oficina
            </label>
          )}
          {vista === 'unidades' && seleccionando && (
            <span className="text-xs font-medium text-muted">
              Arrastrá sobre el mapa para marcar un rectángulo. Barra espaciadora para mover el mapa, Esc para limpiar.
            </span>
          )}
          <span className="hidden text-xs font-medium text-muted lg:inline">
            {loading
              ? 'Cargando…'
              : esZonas
                ? `${unidadesZona.length.toLocaleString('es-AR')} unidades${vista === 'sinreportar' ? ' sin reportar' : ''} · ${valoresZona.fuera.toLocaleString('es-AR')} fuera de Mendoza`
                : `${filtradas.length.toLocaleString('es-AR')} unidades en el mapa`}
          </span>
        </div>
            </div>
          </div>
        </div>
      </Card>

      {esZonas && (
        <nav aria-label="Zona elegida" className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-muted">
          <button type="button" onClick={() => { setZonaSel(null); setDistritoSel(null); }} className={zonaSel ? 'text-primary-600' : 'text-text'}>
            Mendoza
          </button>
          {zonaSel && (
            <>
              <span aria-hidden>›</span>
              <button type="button" onClick={() => setDistritoSel(null)} className={distritoSel ? 'text-primary-600' : 'text-text'}>
                {zonaSel}
              </button>
            </>
          )}
          {nombreDistrito && (
            <>
              <span aria-hidden>›</span>
              <span className="text-text">{nombreDistrito}</span>
            </>
          )}
          {!zonaSel && <span className="text-xs font-medium">Elegí un departamento en el mapa para ver sus distritos.</span>}
        </nav>
      )}

      <div className="flex items-start gap-4">
        <Card className="relative isolate z-0 min-w-0 flex-1 overflow-hidden p-1">
          {vista === 'unidades' ? (
            <FlotaMap
              unidades={filtradas}
              onInspectEquipo={setEquipoAbierto}
              seleccionando={seleccionando}
              area={area}
              onArea={setArea}
              enfocarClave={clientesSel.slice().sort().join('|')}
            />
          ) : (
            (() => {
              const props = {
                valores: medida === 'clientes' ? valoresZona.clientes : valoresZona.unidades,
                seleccion: zonaSel,
                distritoSel,
                onZona: elegirZona,
                unidades: puntosMapa,
                onInspectEquipo: setEquipoAbierto,
                verRadios,
                rutas: rutasMapa,
              };
              return conCalles ? <FlotaZonasMap {...props} /> : <FlotaZonasBklit {...props} />;
            })()
          )}
        </Card>
        {equipoAbierto !== null && <EquipoEstadoPanel equipoId={equipoAbierto} onClose={() => setEquipoAbierto(null)} />}
      </div>

      {vista === 'sinreportar' && (
        <SinReportarClientes
          filas={filasSinReportar}
          seleccion={unidadesSel}
          titulo={`Sin reportar${distritoSel ? ` en ${nombreDistrito} (${zonaSel})` : zonaSel ? ` en ${zonaSel}` : ' en Mendoza'}`}
          onToggleUnidades={(ids, marcar) =>
            setUnidadesSel((prev) => {
              const next = new Set(prev);
              for (const id of ids) {
                if (marcar) next.add(id);
                else next.delete(id);
              }
              return next;
            })
          }
          onSeleccionarTodos={(ids) => setUnidadesSel(new Set(ids))}
          onLimpiar={() => {
            setUnidadesSel(new Set());
            setPropuestaAbierta(false);
          }}
          onArmarPropuesta={() => setPropuestaAbierta(true)}
          series={series}
          onPedirSeries={pedirSeries}
          rutaDe={rutasAcceso.length > 0 ? (id: number) => rutaPorUnidad.get(id) ?? null : undefined}
          ruteo={{
            disponible: ruteoDisponible,
            calculando: calculandoRuta,
            volver: volverOficina,
            onVolver: setVolverOficina,
            criterio: criterioRuta,
            onCriterio: setCriterioRuta,
            primeroId,
            onPrimero: setPrimeroId,
            desdeOficina,
            onDesdeOficina: setDesdeOficina,
            recorridos,
            compartido,
            rutasAcceso: rutasAcceso.filter((r) => r.activa).map((r) => ({ id: r._id, nombre: r.nombre })),
            rutaTecnico,
            onRutaTecnico: (i: number, id: string) => setRutaTecnico((prev) => ({ ...prev, [i]: id })),
            juntosHastaId,
            onJuntosHasta: setJuntosHastaId,
            nombreTecnico,
            cantidad: cantidadTecnicos,
            onCantidad: setCantidadTecnicos,
            tecnicosDisponibles,
            tecnicosSel: tecnicosRuta,
            onTecnicosSel: setTecnicosRuta,
            error: errorRuta,
            onCalcular: () => void calcularRecorrido(),
          }}
        />
      )}
      {vista === 'sinreportar' && propuestaAbierta && clientesPropuesta.length > 0 && (
        <PropuestaVisita clientes={clientesPropuesta} series={series} tecnicoSugerido={tecnicoSugerido} onCerrar={() => setPropuestaAbierta(false)} />
      )}
      {vista === 'unidades' && area && <FlotaAreaTabla unidades={enArea} onLimpiar={limpiarArea} />}
      {vista === 'unidades' && (
        <ClientesEnMapa
          unidades={sinFiltroCliente}
          seleccion={seleccionados}
          onToggle={(nombre) => setClientesSel((prev) => (prev.includes(nombre) ? prev.filter((n) => n !== nombre) : [...prev, nombre]))}
          onLimpiar={() => setClientesSel([])}
        />
      )}
      {esZonas && zonaSel && idZonaActual && (
        <FlotaAreaTabla
          unidades={enZona}
          onLimpiar={() => {
            setZonaSel(null);
            setDistritoSel(null);
          }}
          titulo={`${nombreDistrito ? `${nombreDistrito} (${zonaSel})` : zonaSel} · ${(valoresZona.clientes.get(idZonaActual) ?? 0).toLocaleString('es-AR')} clientes · unidades`}
        />
      )}
    </div>
  );
}
