'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { TIPO_SERVICIO_LABELS, type TipoServicio } from '@wara/shared';
import { servicioLabel } from '@/lib/servicioLabel';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { MultiSelectBuscable } from '@/components/ui/MultiSelectBuscable';
import { Button } from '@/components/ui/Button';
import { IconAlertTriangle, IconChevronDown, IconDownload, IconEye, IconSearch, IconX } from '@/components/ui/Icons';
import { AltaCheckToggle, canToggleAlta } from '@/components/AltaCheckToggle';
import { ConformidadResumenBody } from '@/components/ConformidadResumen';
import { TicketOdooLink } from '@/components/TicketOdooLink';
import {
  CeldaEquipo,
  CeldaInstalado,
  CeldaOdometro,
  Copiable,
  DesplegableBloques,
  PanelLateralAlta,
  SelectorVistaAlta,
  type VistaAlta,
} from '@/components/conformidades/FichaAlta';
import { exportConformidades, listConformidades, listUsuarios, setAltaConformidad } from '@/lib/api';
import { descargarXlsx } from '@/lib/descargarXlsx';
import { useAuth } from '@/auth/AuthContext';
import { useApiData } from '@/lib/useApiData';
import { formatFechaHora } from '@/lib/format';
import type { ConformidadDoc, EstadoConformidad } from '@/lib/types';

const ESTADO_LABEL: Record<EstadoConformidad, string> = {
  borrador_pre: 'Borrador PRE',
  pendiente_post: 'Pendiente POST',
  completo: 'Completo',
};

const ESTADO_TONE: Record<EstadoConformidad, BadgeTone> = {
  borrador_pre: 'neutral',
  pendiente_post: 'warn',
  completo: 'ok',
};

// Cada cuánto se consulta solo si hay conformidades nuevas (mismo ritmo que el calendario).
const POLL_MS = 45_000;
// Carga a medida que se baja: de a PAGE_SIZE hojas; al acercarse al final del listado se piden las siguientes.
const PAGE_SIZE = 25;
// Tope de la API por pedido (pageSize máx. 200): al volver de una hoja se recargan de una hasta esta cantidad de tandas.
const MAX_TANDAS_INICIALES = 8;

// Vista del listado (filtros, página, filas desplegadas y scroll) guardada al entrar a una hoja, para que al volver
// (botón "Volver" o atrás del navegador) siga todo como estaba. Solo se restaura si se salió hacia una hoja hace poco:
// entrando desde el menú el listado arranca limpio.
const VISTA_KEY = 'wara.panel.conformidades.vista';
// Selector de vistas en prueba (Panel lateral / Bloques / Columnas): solo si está activado en el .env.local.
const VISTAS_PRUEBA = process.env.NEXT_PUBLIC_VISTAS_PRUEBA === '1';
const VISTA_VIGENCIA_MS = 30 * 60_000;

interface VistaGuardada {
  search: string;
  status: EstadoConformidad | '';
  tipoServicio: TipoServicio | '';
  tecnicoIds?: string[];
  // Vistas guardadas antes de poder elegir varios técnicos.
  tecnicoId?: string;
  altaMesaAyuda: 'pendiente' | 'hecho' | '';
  altaCoordinacion: 'pendiente' | 'hecho' | '';
  cambioEquipoPendiente: boolean;
  verificacion: string;
  page: number;
  showFiltros: boolean;
  expanded: string[];
  scrollY: number;
  // Se marca al entrar a una hoja: sin esto (o vencida) no se restaura nada.
  saleAHojaAt?: number;
}

function leerVista(): VistaGuardada | null {
  try {
    const raw = sessionStorage.getItem(VISTA_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as VistaGuardada;
    sessionStorage.removeItem(VISTA_KEY);
    if (!v.saleAHojaAt || Date.now() - v.saleAHojaAt > VISTA_VIGENCIA_MS) return null;
    return v;
  } catch {
    return null;
  }
}

type FiltroVerificacion = NonNullable<import('@/lib/types').ListConformidadesQuery['verificacionEquipo']>;
const VERIFICACION_LABEL: Record<FiltroVerificacion, string> = {
  bajo_responsabilidad: 'Avanzó bajo responsabilidad',
  sin_verificar: 'Sin verificar',
  con_problemas: 'Con problemas',
  verificado: 'Verificado',
};

// Etiqueta chica en el listado: el técnico cerró el control con el equipo sin confirmar.
function BajoResponsabilidadBadge({ c }: { c: ConformidadDoc }) {
  if (!c.verificacionEquipo?.avanzoBajoResponsabilidad) return null;
  return (
    <span
      title="El técnico avanzó con el equipo sin confirmar (ver el detalle de la hoja)"
      className="mt-1 inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-[10.5px] font-bold text-warning-700"
    >
      <IconAlertTriangle size={11} />
      Sin verificar
    </span>
  );
}

export default function ConformidadesPage() {
  const { usuario, getIdToken } = useAuth();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<EstadoConformidad | ''>('');
  const [tipoServicio, setTipoServicio] = useState<TipoServicio | ''>('');
  const [tecnicoIds, setTecnicoIds] = useState<string[]>([]);
  const [altaMesaAyuda, setAltaMesaAyuda] = useState<'pendiente' | 'hecho' | ''>('');
  const [altaCoordinacion, setAltaCoordinacion] = useState<'pendiente' | 'hecho' | ''>('');
  const [cambioEquipoPendiente, setCambioEquipoPendiente] = useState(false);
  const [verificacion, setVerificacion] = useState<FiltroVerificacion | ''>('');
  // Tandas a traer de una en la primera carga (al volver de una hoja, las que ya se habían cargado; si no, 1).
  const tandasIniciales = useRef(1);
  // En celular los selects de filtro arrancan plegados (la búsqueda queda siempre a la vista).
  const [showFiltros, setShowFiltros] = useState(false);
  // Fila desplegada para ver el resumen (equipo, control de instalación,
  // fotos) sin salir del listado — el check de alta de esa fila solo se
  // puede tocar mientras está desplegada, para forzar a revisarla antes de
  // marcarla en vez de tildar en cadena sin mirar (ver handleToggleAlta).
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // PRUEBA: vista del listado en escritorio (ver components/conformidades/FichaAlta.tsx). Se recuerda en este navegador.
  // Solo con NEXT_PUBLIC_VISTAS_PRUEBA=1 (local): en producción no aparece el selector y queda siempre la actual.
  const [vista, setVistaState] = useState<VistaAlta>('actual');
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
  useEffect(() => {
    try {
      if (!VISTAS_PRUEBA) return;
      const v = localStorage.getItem('wara.panel.conformidades.vistaAlta') as VistaAlta | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage no existe en el servidor
      if (v && ['actual', 'lateral', 'bloques', 'columnas'].includes(v)) setVistaState(v);
    } catch {
      /* sin storage: queda la actual */
    }
  }, []);
  function setVista(v: VistaAlta) {
    setVistaState(v);
    setSeleccionadaId(null);
    try {
      localStorage.setItem('wara.panel.conformidades.vistaAlta', v);
    } catch {
      /* sin storage */
    }
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Al volver de una hoja se repone la vista guardada. La primera carga espera a esto para no pedir dos veces.
  const [restaurado, setRestaurado] = useState(false);
  const scrollPendiente = useRef<number | null>(null);

  // Se llama al tocar "ver detalle": deja guardado cómo está el listado para reponerlo al volver.
  function guardarVista() {
    const vista: VistaGuardada = {
      search,
      status,
      tipoServicio,
      tecnicoIds,
      altaMesaAyuda,
      altaCoordinacion,
      cambioEquipoPendiente,
      verificacion,
      page: Math.max(1, Math.ceil((data?.data.length ?? 0) / PAGE_SIZE)),
      showFiltros,
      expanded: [...expandedIds],
      scrollY: window.scrollY,
      saleAHojaAt: Date.now(),
    };
    try {
      sessionStorage.setItem(VISTA_KEY, JSON.stringify(vista));
    } catch {
      /* sin storage (modo privado): simplemente no se repone */
    }
  }

  useEffect(() => {
    const v = leerVista();
    /* eslint-disable react-hooks/set-state-in-effect -- restaurar el estado guardado una sola vez al montar (sessionStorage no existe en el servidor) */
    if (v) {
      setSearch(v.search);
      setDebouncedSearch(v.search);
      setStatus(v.status);
      setTipoServicio(v.tipoServicio);
      setTecnicoIds(v.tecnicoIds ?? (v.tecnicoId ? [v.tecnicoId] : []));
      setAltaMesaAyuda(v.altaMesaAyuda);
      setAltaCoordinacion(v.altaCoordinacion);
      setCambioEquipoPendiente(v.cambioEquipoPendiente);
      setVerificacion(v.verificacion as FiltroVerificacion | '');
      tandasIniciales.current = Math.min(Math.max(1, v.page), MAX_TANDAS_INICIALES);
      setShowFiltros(v.showFiltros);
      setExpandedIds(new Set(v.expanded));
      scrollPendiente.current = v.scrollY;
    }
    setRestaurado(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Wait for a pause in typing before hitting the API — avoids firing a
  // request on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: usuariosData } = useApiData((idToken) => listUsuarios(idToken), []);
  const tecnicos = useMemo(() => (usuariosData ?? []).filter((u) => u.role === 'tecnico'), [usuariosData]);
  // Los técnicos elegibles en el filtro, ordenados por nombre (sin distinguir mayúsculas ni tildes).
  const tecnicoOpciones = useMemo(
    () =>
      tecnicos
        .map((t) => ({ value: t._id, label: t.nombre || t.email }))
        .sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' })),
    [tecnicos],
  );
  const tecnicoNombre = useMemo(() => {
    const map = new Map((usuariosData ?? []).map((u) => [u._id, u.nombre || u.email]));
    return (id?: string) => (id && map.get(id)) || (id ? id.slice(-6) : '—');
  }, [usuariosData]);

  // Los técnicos viajan juntos, separados por coma ("a,b,c"). Mismos filtros para el listado y para exportar a Excel: lo que se
  // exporta es lo que se está viendo (todas las páginas, no solo la actual).
  const tecnicoIdsParam = tecnicoIds.join(',');
  const filtros = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      status: status || undefined,
      tipoServicio: tipoServicio || undefined,
      tecnicoId: tecnicoIdsParam || undefined,
      altaMesaAyuda: altaMesaAyuda || undefined,
      altaCoordinacion: altaCoordinacion || undefined,
      cambioEquipoPendiente: cambioEquipoPendiente || undefined,
      verificacionEquipo: verificacion || undefined,
    }),
    [debouncedSearch, status, tipoServicio, tecnicoIdsParam, altaMesaAyuda, altaCoordinacion, cambioEquipoPendiente, verificacion],
  );

  const { data, loading, error, setData } = useApiData(
    (idToken) => {
      const tandas = tandasIniciales.current;
      tandasIniciales.current = 1;
      return listConformidades(idToken, { page: 1, pageSize: PAGE_SIZE * tandas, ...filtros });
    },
    [filtros],
    restaurado,
  );
  // Filtros y listado del momento, para las consultas que terminan después (poll y "cargar más").
  const consultaRef = useRef({ filtros, loading, data });
  useEffect(() => {
    consultaRef.current = { filtros, loading, data };
  });

  // Siguiente tanda al llegar cerca del final (ver centinela al pie). Se calcula por cuántas hay cargadas: si mientras tanto
  // entraron hojas nuevas arriba, la tanda trae alguna repetida y se descarta; no se saltea ninguna.
  const [cargandoMas, setCargandoMas] = useState(false);
  const [errorMas, setErrorMas] = useState<string | null>(null);
  const hayMas = Boolean(data && data.data.length < data.total);
  async function cargarMas() {
    const actual = consultaRef.current;
    if (cargandoMas || actual.loading || !actual.data || actual.data.data.length >= actual.data.total) return;
    setCargandoMas(true);
    setErrorMas(null);
    try {
      const siguiente = Math.floor(actual.data.data.length / PAGE_SIZE) + 1;
      const r = await listConformidades(await getIdToken(), { page: siguiente, pageSize: PAGE_SIZE, ...actual.filtros });
      // Mientras tanto se cambió un filtro: esta tanda es de otra búsqueda.
      if (consultaRef.current.filtros !== actual.filtros) return;
      setData((prev) => {
        if (!prev) return prev;
        const ids = new Set(prev.data.map((c) => c._id));
        return { ...prev, data: [...prev.data, ...r.data.filter((c) => !ids.has(c._id))], total: r.total };
      });
    } catch (err) {
      setErrorMas(err instanceof Error ? err.message : 'No se pudieron cargar más conformidades.');
    } finally {
      setCargandoMas(false);
    }
  }
  const cargarMasRef = useRef(cargarMas);
  useEffect(() => {
    cargarMasRef.current = cargarMas;
  });
  const centinelaRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = centinelaRef.current;
    if (!el || !hayMas) return;
    const obs = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) void cargarMasRef.current();
    }, { rootMargin: '800px 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hayMas, data?.data.length]);

  // Consulta sola cada POLL_MS si hay conformidades nuevas o cambios (p. ej. un POST que llegó tarde), sin recargar la página.
  // Es silenciosa: no atenúa la tabla ni toca filas desplegadas, filtros, página ni scroll. Solo corre con la pestaña a la
  // vista; al volver a la pestaña consulta enseguida si ya pasó el intervalo.
  const [actualizadoAt, setActualizadoAt] = useState<Date | null>(null);
  const [nuevas, setNuevas] = useState(0);
  // Cambia con cada toque de alta: una consulta que salió antes no pisa la fila recién marcada.
  const cambiosLocales = useRef(0);
  // Cambiar los filtros empieza de nuevo la cuenta de nuevas.
  useEffect(() => {
    setNuevas(0); // eslint-disable-line react-hooks/set-state-in-effect -- reinicio por cambio de filtros
  }, [filtros]);
  useEffect(() => {
    if (!data) return;
    setActualizadoAt(new Date()); // eslint-disable-line react-hooks/set-state-in-effect -- marca la hora de la última carga
  }, [data]);
  useEffect(() => {
    if (!restaurado) return;
    let enCurso = false;
    let ultima = Date.now();
    async function consultar() {
      const actual = consultaRef.current;
      if (enCurso || actual.loading || !actual.data || document.visibilityState !== 'visible') return;
      enCurso = true;
      ultima = Date.now();
      const cambiosAntes = cambiosLocales.current;
      try {
        // Solo la primera tanda (lo de arriba, donde aparecen las nuevas); las de más abajo quedan como estaban.
        const r = await listConformidades(await getIdToken(), { page: 1, pageSize: PAGE_SIZE, ...actual.filtros });
        const ahora = consultaRef.current;
        // Mientras tanto se cambió un filtro o se marcó un alta: esta respuesta ya no sirve.
        if (ahora.filtros !== actual.filtros || cambiosLocales.current !== cambiosAntes) return;
        const previos = new Set((ahora.data?.data ?? []).map((c) => c._id));
        const agregadas = r.data.filter((c) => !previos.has(c._id)).length;
        if (agregadas && r.total > (ahora.data?.total ?? 0)) setNuevas((n) => n + agregadas);
        setData((prev) => {
          if (!prev) return r;
          const arriba = new Set(r.data.map((c) => c._id));
          return { ...prev, data: [...r.data, ...prev.data.filter((c) => !arriba.has(c._id))], total: r.total };
        });
      } catch {
        // Sin conexión o API caída: se reintenta en la próxima vuelta, sin mostrar error.
      } finally {
        enCurso = false;
      }
    }
    const id = setInterval(consultar, POLL_MS);
    const alVolver = () => {
      if (document.visibilityState === 'visible' && Date.now() - ultima >= POLL_MS) void consultar();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [restaurado, getIdToken, setData]);

  const [exportando, setExportando] = useState(false);
  // Resultado de la última exportación; se muestra solo mientras los filtros sean los mismos con los que se exportó.
  const [resultadoExport, setResultadoExport] = useState<{ error: boolean; texto: string; filtros: string } | null>(null);
  const filtrosClave = JSON.stringify(filtros);
  const mensajeExport = resultadoExport && resultadoExport.filtros === filtrosClave ? resultadoExport : null;

  async function exportarExcel() {
    if (exportando) return;
    const clave = filtrosClave;
    setExportando(true);
    setResultadoExport(null);
    try {
      const r = await exportConformidades(await getIdToken(), filtros);
      // La primera hoja tiene una fila por conformidad; la segunda, una por cada elemento instalado.
      const cantidad = r.hojas[0]?.filas.length ?? 0;
      if (!cantidad) {
        setResultadoExport({ error: false, texto: 'No hay conformidades con estos filtros para exportar.', filtros: clave });
        return;
      }
      const hoy = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      await descargarXlsx(r.hojas, `conformidades_${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}.xlsx`);
      setResultadoExport({
        error: false,
        texto: r.recortado
          ? `Se exportaron las primeras ${cantidad} de ${r.total} conformidades (límite por archivo). Acotá los filtros para el resto.`
          : `Se exportaron ${cantidad} conformidades.`,
        filtros: clave,
      });
    } catch (err) {
      setResultadoExport({ error: true, texto: err instanceof Error ? err.message : 'No se pudo exportar.', filtros: clave });
    } finally {
      setExportando(false);
    }
  }

  // Con la lista ya cargada (las filas desplegadas ya tienen su alto), vuelve al punto donde se estaba.
  useEffect(() => {
    if (!data || scrollPendiente.current === null) return;
    window.scrollTo(0, scrollPendiente.current);
    scrollPendiente.current = null;
  }, [data]);

  // Reemplaza solo la fila tocada con la respuesta del servidor — evita el
  // refetch de toda la página (que atenuaba la tabla entera con opacity-60
  // por cada click). Si hay un filtro de alta activo, la fila queda visible
  // con su estado nuevo hasta el próximo refetch en vez de desaparecer sola.
  async function handleToggleAlta(id: string, area: 'mesaAyuda' | 'coordinacion', checked: boolean) {
    cambiosLocales.current++;
    const idToken = await getIdToken();
    const updated = await setAltaConformidad(idToken, id, area, checked);
    cambiosLocales.current++;
    setData((prev) => (prev ? { ...prev, data: prev.data.map((c) => (c._id === id ? updated : c)) } : prev));
  }

  // Chips removibles para que se vea de un vistazo qué filtros están activos
  // sin tener que abrir cada select — y "Limpiar filtros" los saca todos de una.
  const activeFilters = useMemo(
    () =>
      [
        search && { key: 'search', label: `Buscar: "${search}"`, onRemove: () => setSearch('') },
        tecnicoIds.length > 0 && {
          key: 'tecnico',
          label: `${tecnicoIds.length === 1 ? 'Técnico' : 'Técnicos'}: ${tecnicoIds.map((id) => tecnicoNombre(id)).join(', ')}`,
          onRemove: () => setTecnicoIds([]),
        },
        tipoServicio && { key: 'tipoServicio', label: `Servicio: ${TIPO_SERVICIO_LABELS[tipoServicio]}`, onRemove: () => setTipoServicio('') },
        status && { key: 'status', label: `Estado: ${ESTADO_LABEL[status]}`, onRemove: () => setStatus('') },
        altaMesaAyuda && {
          key: 'altaMA',
          label: `Alta MA: ${altaMesaAyuda === 'hecho' ? 'Hecho' : 'Pendiente'}`,
          onRemove: () => setAltaMesaAyuda(''),
        },
        altaCoordinacion && {
          key: 'altaCoord',
          label: `Alta Coord: ${altaCoordinacion === 'hecho' ? 'Hecho' : 'Pendiente'}`,
          onRemove: () => setAltaCoordinacion(''),
        },
        cambioEquipoPendiente && {
          key: 'cambioEquipoPendiente',
          label: 'Cambio de equipo: pendiente de vincular',
          onRemove: () => setCambioEquipoPendiente(false),
        },
        verificacion && {
          key: 'verificacion',
          label: `Equipo: ${VERIFICACION_LABEL[verificacion]}`,
          onRemove: () => setVerificacion(''),
        },
      ].filter((f): f is { key: string; label: string; onRemove: () => void } => Boolean(f)),
    [search, tecnicoIds, status, tipoServicio, altaMesaAyuda, altaCoordinacion, cambioEquipoPendiente, verificacion, tecnicoNombre],
  );

  function clearAllFilters() {
    setSearch('');
    setTecnicoIds([]);
    setStatus('');
    setTipoServicio('');
    setAltaMesaAyuda('');
    setAltaCoordinacion('');
    setCambioEquipoPendiente(false);
    setVerificacion('');
  }

  // Columnas de la tabla de escritorio según la vista. En el panel lateral, con una hoja abierta, la tabla se angosta
  // (queda lo justo para ubicarse y pasar a la siguiente).
  const seleccionada = vista === 'lateral' && seleccionadaId ? (data?.data.find((c) => c._id === seleccionadaId) ?? null) : null;
  const { gridCols, encabezados } = (() => {
    if (vista === 'lateral' && seleccionada)
      return { gridCols: 'grid-cols-[1.1fr_1.4fr_0.9fr_1.1fr_1fr_1fr]', encabezados: ['Código acta', 'Cliente', 'Unidad', 'Servicio', 'Alta MA', 'Alta Coord'] };
    if (vista === 'lateral')
      return {
        gridCols: 'grid-cols-[1.2fr_1.4fr_0.9fr_1.1fr_1.1fr_1fr_0.9fr_1fr_1fr_60px]',
        encabezados: ['Código acta', 'Cliente', 'Unidad', 'Servicio', 'Técnico', 'Fecha', 'Estado', 'Alta MA', 'Alta Coord', ''],
      };
    if (vista === 'columnas')
      return {
        gridCols: 'grid-cols-[32px_1.2fr_1.3fr_0.9fr_1.3fr_1.5fr_0.8fr_0.9fr_1fr_1fr_60px]',
        encabezados: ['', 'Código / servicio', 'Cliente / técnico', 'Unidad', 'Equipo', 'Sensores / módulos', 'Odómetro', 'Estado', 'Alta MA', 'Alta Coord', ''],
      };
    return {
      gridCols: 'grid-cols-[32px_1.2fr_1.4fr_1.1fr_0.9fr_0.9fr_1.1fr_1fr_0.9fr_1fr_1fr_60px]',
      encabezados: ['', 'Código acta', 'Cliente', 'Técnico', 'Unidad', 'Ticket', 'Servicio', 'Fecha', 'Estado', 'Alta MA', 'Alta Coord', ''],
    };
  })();

  return (
    <div className={`flex flex-col gap-5 ${seleccionada ? 'lg:mr-[460px]' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-extrabold">Conformidades</div>
          <div className="mt-0.5 text-sm font-semibold text-muted">
            {data ? `${data.total} registros` : 'Cargando...'}
            {actualizadoAt && (
              <span title="El listado se actualiza solo cada 45 segundos">
                {' · actualizado '}
                {actualizadoAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {nuevas > 0 && <span className="text-primary-600">{` · ${nuevas} ${nuevas === 1 ? 'nueva' : 'nuevas'}`}</span>}
          </div>
        </div>
        {VISTAS_PRUEBA && <SelectorVistaAlta vista={vista} onChange={setVista} />}
        <div className="flex flex-col items-end gap-1">
          <Button
            variant="ghost"
            className="border border-neutral-300 text-xs"
            onClick={exportarExcel}
            disabled={exportando || !data || data.total === 0}
            title="Descarga en Excel todo lo que muestra el listado con los filtros de ahora (todas las páginas)"
          >
            <IconDownload size={15} />
            {exportando ? 'Exportando...' : 'Exportar a Excel'}
          </Button>
          {mensajeExport && (
            <div className={`max-w-xs text-right text-[11.5px] font-semibold ${mensajeExport.error ? 'text-bad' : 'text-muted'}`}>{mensajeExport.texto}</div>
          )}
        </div>
      </div>

      <Card small className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="text-[13px] font-extrabold">Filtros</div>
            {activeFilters.length > 0 && <Badge tone="primary">{activeFilters.length}</Badge>}
          </div>
          <button
            type="button"
            onClick={() => setShowFiltros((v) => !v)}
            aria-expanded={showFiltros}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-bold text-primary sm:hidden"
          >
            {showFiltros ? 'Ocultar' : 'Más filtros'}
            <IconChevronDown className={`transition-transform ${showFiltros ? 'rotate-180' : ''}`} />
          </button>
          {activeFilters.length > 0 && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="flex items-center gap-1 text-[11.5px] font-bold text-muted hover:text-text"
            >
              <IconX size={12} />
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            className="pl-10"
            placeholder="Cliente, unidad, IMEI, N° de ticket o acta..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
          />
        </div>

        <div className={`${showFiltros ? 'grid' : 'hidden'} grid-cols-2 gap-3 sm:grid sm:grid-cols-4`}>
          <div>
            <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">Técnico</div>
            <MultiSelectBuscable
              opciones={tecnicoOpciones}
              seleccionados={tecnicoIds}
              onChange={(ids) => {
                setTecnicoIds(ids);
              }}
              todosLabel="Todos"
              plural="técnicos"
              buscarPlaceholder="Escribí el nombre del técnico..."
              sinResultadosLabel="Ningún técnico coincide"
            />
          </div>

          <div>
            <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">Estado</div>
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as EstadoConformidad | '');
              }}
            >
              <option value="">Todos</option>
              <option value="borrador_pre">Borrador PRE</option>
              <option value="pendiente_post">Pendiente POST</option>
              <option value="completo">Completo</option>
            </Select>
          </div>

          <div>
            <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">Tipo de servicio</div>
            <Select
              value={tipoServicio}
              onChange={(e) => {
                setTipoServicio(e.target.value as TipoServicio | '');
              }}
            >
              <option value="">Todos</option>
              {(Object.keys(TIPO_SERVICIO_LABELS) as TipoServicio[]).map((t) => (
                <option key={t} value={t}>
                  {TIPO_SERVICIO_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">Alta mesa de ayuda</div>
            <Select
              value={altaMesaAyuda}
              onChange={(e) => {
                setAltaMesaAyuda(e.target.value as 'pendiente' | 'hecho' | '');
              }}
            >
              <option value="">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="hecho">Hecho</option>
            </Select>
          </div>

          <div>
            <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">Alta coordinación</div>
            <Select
              value={altaCoordinacion}
              onChange={(e) => {
                setAltaCoordinacion(e.target.value as 'pendiente' | 'hecho' | '');
              }}
            >
              <option value="">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="hecho">Hecho</option>
            </Select>
          </div>

          <div>
            <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">Cambio de equipo</div>
            <Select
              value={cambioEquipoPendiente ? 'pendiente' : ''}
              onChange={(e) => {
                setCambioEquipoPendiente(e.target.value === 'pendiente');
              }}
            >
              <option value="">Todos</option>
              <option value="pendiente">Pendiente de vincular</option>
            </Select>
          </div>

          <div>
            <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">Verificación del equipo</div>
            <Select
              value={verificacion}
              onChange={(e) => {
                setVerificacion(e.target.value as FiltroVerificacion | '');
              }}
            >
              <option value="">Todas</option>
              <option value="bajo_responsabilidad">Avanzó bajo responsabilidad</option>
              <option value="sin_verificar">Sin verificar</option>
              <option value="con_problemas">Con problemas</option>
              <option value="verificado">Verificado</option>
            </Select>
          </div>
        </div>

        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t border-line pt-3">
            {activeFilters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={f.onRemove}
                className="flex items-center gap-1.5 rounded-full bg-bg px-3 py-1 text-[11.5px] font-bold text-text shadow-inset"
              >
                {f.label}
                <IconX size={11} />
              </button>
            ))}
          </div>
        )}
      </Card>

      {error && <Card className="p-4 text-sm font-semibold text-bad">{error}</Card>}

      {/* < lg: una tarjeta por conformidad (la tabla de 12 columnas no entra en el celular). */}
      <div className={`flex flex-col gap-3 transition-opacity lg:hidden ${loading && data ? 'opacity-60' : ''}`}>
        {loading && !data && <Card className="p-4 text-sm font-semibold text-muted">Cargando...</Card>}
        {!loading && data?.data.length === 0 && <Card className="p-4 text-sm font-semibold text-muted">No se encontraron conformidades.</Card>}
        {data?.data.map((c) => {
          const expanded = expandedIds.has(c._id);
          const roleCanToggleMA = canToggleAlta(usuario?.role, 'mesaAyuda');
          const roleCanToggleCoord = canToggleAlta(usuario?.role, 'coordinacion');
          return (
            <Card key={c._id} className="overflow-hidden">
              <div className="flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[13px] font-extrabold text-primary">{c.codigoActa}</div>
                    <div className="truncate text-[14px] font-bold">{c.cliente || '—'}</div>
                  </div>
                  <div className="flex flex-col items-end">
                    <Badge tone={ESTADO_TONE[c.status]}>{ESTADO_LABEL[c.status]}</Badge>
                    <BajoResponsabilidadBadge c={c} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] font-semibold">
                  <div className="truncate text-muted">Unidad: <span className="text-text">{c.matricula || '—'}</span></div>
                  <div className="truncate text-muted">
                    Ticket: <TicketOdooLink ticket={c.ticketOdoo} />
                  </div>
                  <div className="truncate text-muted">Servicio: <span className="text-text">{servicioLabel(c)}</span></div>
                  <div className="truncate text-muted">Téc.: <span className="text-text">{tecnicoNombre(c.tecnicoId)}</span></div>
                  <div className="truncate text-muted">{formatFechaHora(c.fecha, c.hora)}</div>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(c._id)}
                    aria-expanded={expanded}
                    className="flex min-h-10 items-center gap-1 rounded-md px-2 text-[12.5px] font-bold text-muted"
                  >
                    {expanded ? 'Ocultar resumen' : 'Ver resumen'}
                    <IconChevronDown className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
                  </button>
                  <Link
                    href={`/conformidades/${c._id}`}
                    onClick={guardarVista}
                    aria-label="Ver detalle"
                    className="flex h-10 w-10 items-center justify-center rounded-md bg-surface shadow-soft-sm"
                  >
                    <IconEye />
                  </Link>
                </div>
              </div>
              {expanded && (
                <div className="flex flex-col gap-4 border-t border-line bg-bg p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">Alta MA</div>
                      <AltaCheckToggle
                        area="mesaAyuda"
                        value={c.altaEquipo.mesaAyuda}
                        canToggle={roleCanToggleMA}
                        usuarioNombre={tecnicoNombre}
                        onToggle={(checked) => handleToggleAlta(c._id, 'mesaAyuda', checked)}
                        showDetail
                      />
                    </div>
                    <div>
                      <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">Alta Coord</div>
                      <AltaCheckToggle
                        area="coordinacion"
                        value={c.altaEquipo.coordinacion}
                        canToggle={roleCanToggleCoord}
                        usuarioNombre={tecnicoNombre}
                        onToggle={(checked) => handleToggleAlta(c._id, 'coordinacion', checked)}
                        showDetail
                      />
                    </div>
                  </div>
                  <ConformidadResumenBody c={c} />
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="hidden p-2.5 pb-4 lg:block">
        <div className="overflow-x-auto">
          <div className={vista === 'columnas' ? 'min-w-[1380px]' : vista === 'lateral' && seleccionada ? 'min-w-[760px]' : 'min-w-[1260px]'}>
            <div className={`grid ${gridCols} pb-2.5 pt-4`}>
              {encabezados.map((h, i) => (
                <div key={i} className="px-3.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">
                  {h}
                </div>
              ))}
            </div>

            {loading && !data && <div className="px-3 py-6 text-sm font-semibold text-muted">Cargando...</div>}
            {!loading && data?.data.length === 0 && (
              <div className="px-3 py-6 text-sm font-semibold text-muted">No se encontraron conformidades.</div>
            )}

            <div className={`transition-opacity ${loading && data ? 'opacity-60' : ''}`}>
              {data?.data.map((c, indice) => {
                const expanded = expandedIds.has(c._id);
                const elegida = vista === 'lateral' && seleccionadaId === c._id;
                const roleCanToggleMA = canToggleAlta(usuario?.role, 'mesaAyuda');
                const roleCanToggleCoord = canToggleAlta(usuario?.role, 'coordinacion');
                // Para marcar el alta hay que haber mirado la hoja: desplegada (actual/bloques), abierta en el panel
                // lateral, o siempre en "columnas" (los datos ya están a la vista en la fila).
                const revisada = vista === 'columnas' ? true : vista === 'lateral' ? elegida : expanded;
                const expandHint =
                  vista === 'lateral'
                    ? 'Abrí la hoja (click en la fila) para revisarla antes de marcarla.'
                    : 'Desplegá la fila (flecha a la izquierda) para revisar el resumen antes de marcarla.';
                const toggleMA = (
                  <AltaCheckToggle
                    area="mesaAyuda"
                    value={c.altaEquipo.mesaAyuda}
                    canToggle={roleCanToggleMA && revisada}
                    usuarioNombre={tecnicoNombre}
                    onToggle={(checked) => handleToggleAlta(c._id, 'mesaAyuda', checked)}
                    titleOverride={roleCanToggleMA && !revisada ? expandHint : undefined}
                    showDetail
                  />
                );
                const toggleCoord = (
                  <AltaCheckToggle
                    area="coordinacion"
                    value={c.altaEquipo.coordinacion}
                    canToggle={roleCanToggleCoord && revisada}
                    usuarioNombre={tecnicoNombre}
                    onToggle={(checked) => handleToggleAlta(c._id, 'coordinacion', checked)}
                    titleOverride={roleCanToggleCoord && !revisada ? expandHint : undefined}
                    showDetail
                  />
                );
                const altaGrande = (
                  <div className="flex flex-wrap items-start gap-6">
                    <div>
                      <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">Alta mesa de ayuda</div>
                      {toggleMA}
                    </div>
                    <div>
                      <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">Alta coordinación</div>
                      {toggleCoord}
                    </div>
                  </div>
                );
                const ojo = (
                  <Link
                    href={`/conformidades/${c._id}`}
                    onClick={guardarVista}
                    className="flex h-[34px] w-[34px] items-center justify-center rounded-md bg-surface shadow-soft-sm"
                  >
                    <IconEye />
                  </Link>
                );
                const chevron = (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(c._id)}
                      title={expanded ? 'Ocultar resumen' : 'Ver resumen'}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-bg"
                    >
                      <IconChevronDown className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                );

                let celdas: ReactNode;
                if (vista === 'lateral') {
                  celdas = (
                    <>
                      <div className="p-3.5 text-[13px] font-bold text-primary">{c.codigoActa}</div>
                      <div className="p-3.5">
                        <div className="text-[13px] font-semibold">{c.cliente || '—'}</div>
                        {c.ticketOdoo?.numero && <TicketOdooLink ticket={c.ticketOdoo} className="text-[11.5px]" />}
                      </div>
                      <div className="p-3.5 text-[13px] font-semibold">{c.matricula || '—'}</div>
                      <div className="p-3.5 text-[13px] font-semibold">{servicioLabel(c)}</div>
                      {!seleccionada && (
                        <>
                          <div className="p-3.5 text-[13px] font-semibold text-muted">{tecnicoNombre(c.tecnicoId)}</div>
                          <div className="p-3.5 text-[13px] font-semibold text-muted">{formatFechaHora(c.fecha, c.hora)}</div>
                          <div className="p-3.5">
                            <Badge tone={ESTADO_TONE[c.status]}>{ESTADO_LABEL[c.status]}</Badge>
                            <BajoResponsabilidadBadge c={c} />
                          </div>
                        </>
                      )}
                      <div className="p-3.5">{toggleMA}</div>
                      <div className="p-3.5">{toggleCoord}</div>
                      {!seleccionada && <div className="p-3.5">{ojo}</div>}
                    </>
                  );
                } else if (vista === 'columnas') {
                  celdas = (
                    <>
                      {chevron}
                      <div className="p-3.5">
                        <div className="text-[13px] font-bold text-primary">{c.codigoActa}</div>
                        <div className="text-[12px] font-semibold">{servicioLabel(c)}</div>
                        <div className="text-[11.5px] font-semibold text-muted">{formatFechaHora(c.fecha, c.hora)}</div>
                      </div>
                      <div className="p-3.5">
                        <div className="text-[13px] font-semibold">{c.cliente || '—'}</div>
                        <div className="text-[11.5px] font-semibold text-muted">
                          {tecnicoNombre(c.tecnicoId)}
                          {c.ticketOdoo?.numero && (
                            <>
                              {' · '}
                              <TicketOdooLink ticket={c.ticketOdoo} />
                            </>
                          )}
                        </div>
                      </div>
                      <div className="p-3.5 text-[13px] font-bold">
                        <Copiable value={c.matricula ?? ''} />
                      </div>
                      <div className="p-3.5">
                        <CeldaEquipo c={c} />
                      </div>
                      <div className="p-3.5">
                        <CeldaInstalado c={c} />
                      </div>
                      <div className="p-3.5">
                        <CeldaOdometro c={c} />
                      </div>
                      <div className="p-3.5">
                        <Badge tone={ESTADO_TONE[c.status]}>{ESTADO_LABEL[c.status]}</Badge>
                        <BajoResponsabilidadBadge c={c} />
                      </div>
                      <div className="p-3.5">{toggleMA}</div>
                      <div className="p-3.5">{toggleCoord}</div>
                      <div className="p-3.5">{ojo}</div>
                    </>
                  );
                } else {
                  celdas = (
                    <>
                      {chevron}
                      <div className="p-3.5 text-[13px] font-bold text-primary">{c.codigoActa}</div>
                      <div className="p-3.5 text-[13px] font-semibold">{c.cliente || '—'}</div>
                      <div className="p-3.5 text-[13px] font-semibold text-muted">{tecnicoNombre(c.tecnicoId)}</div>
                      <div className="p-3.5 text-[13px] font-semibold">{c.matricula || '—'}</div>
                      <div className="p-3.5 text-[13px]">
                        <TicketOdooLink ticket={c.ticketOdoo} />
                      </div>
                      <div className="p-3.5 text-[13px] font-semibold">{servicioLabel(c)}</div>
                      <div className="p-3.5 text-[13px] font-semibold text-muted">{formatFechaHora(c.fecha, c.hora)}</div>
                      <div className="p-3.5">
                        <Badge tone={ESTADO_TONE[c.status]}>{ESTADO_LABEL[c.status]}</Badge>
                        <BajoResponsabilidadBadge c={c} />
                      </div>
                      <div className="p-3.5">{toggleMA}</div>
                      <div className="p-3.5">{toggleCoord}</div>
                      <div className="p-3.5">{ojo}</div>
                    </>
                  );
                }

                return (
                  <div key={c._id} className="border-t border-line">
                    <div
                      onClick={(e) => {
                        const selection = window.getSelection()?.toString();
                        if (selection && selection.trim().length > 0) return;
                        const target = e.target as HTMLElement | null;
                        if (target?.closest('button, a, input, [role="button"], label')) return;
                        if (vista === 'lateral') setSeleccionadaId(elegida ? null : c._id);
                        else toggleExpanded(c._id);
                      }}
                      className={`grid ${gridCols} cursor-pointer items-center ${
                        elegida ? 'bg-primary-50 shadow-[inset_3px_0_0_var(--color-primary-600)]' : 'hover:bg-neutral-50/70'
                      }`}
                    >
                      {celdas}
                    </div>

                    {expanded && vista !== 'lateral' && (
                      <div className="border-t border-line bg-bg px-4 py-4">
                        {vista === 'bloques' ? (
                          <DesplegableBloques c={c} tecnicoNombre={tecnicoNombre} alta={altaGrande} />
                        ) : (
                          <ConformidadResumenBody c={c} />
                        )}
                      </div>
                    )}
                    {elegida && (
                      <PanelLateralAlta
                        c={c}
                        tecnicoNombre={tecnicoNombre}
                        alta={altaGrande}
                        onClose={() => setSeleccionadaId(null)}
                        onAnterior={indice > 0 ? () => setSeleccionadaId(data.data[indice - 1]._id) : undefined}
                        onSiguiente={indice < data.data.length - 1 ? () => setSeleccionadaId(data.data[indice + 1]._id) : undefined}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </Card>
      {/* Centinela: al acercarse (800px antes) se pide la siguiente tanda. */}
      <div ref={centinelaRef} className="py-3 text-center text-[12px] font-semibold text-muted">
        {errorMas ? (
          <button type="button" onClick={() => void cargarMas()} className="font-bold text-primary underline">
            {errorMas} Reintentar
          </button>
        ) : hayMas ? (
          cargandoMas ? 'Cargando más...' : `Mostrando ${data?.data.length} de ${data?.total}`
        ) : data && data.total > 0 ? (
          `Son todas: ${data.total}`
        ) : null}
      </div>
    </div>
  );
}
