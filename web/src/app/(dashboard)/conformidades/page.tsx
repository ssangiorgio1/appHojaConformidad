'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { IconAlertTriangle, IconChevronDown, IconEye, IconSearch, IconX } from '@/components/ui/Icons';
import { AltaCheckToggle, canToggleAlta } from '@/components/AltaCheckToggle';
import { ConformidadResumenBody } from '@/components/ConformidadResumen';
import { listConformidades, listUsuarios, setAltaConformidad } from '@/lib/api';
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

const PAGE_SIZE = 20;

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
  const [tecnicoId, setTecnicoId] = useState('');
  const [altaMesaAyuda, setAltaMesaAyuda] = useState<'pendiente' | 'hecho' | ''>('');
  const [altaCoordinacion, setAltaCoordinacion] = useState<'pendiente' | 'hecho' | ''>('');
  const [cambioEquipoPendiente, setCambioEquipoPendiente] = useState(false);
  const [verificacion, setVerificacion] = useState<FiltroVerificacion | ''>('');
  const [page, setPage] = useState(1);
  // En celular los selects de filtro arrancan plegados (la búsqueda queda siempre a la vista).
  const [showFiltros, setShowFiltros] = useState(false);
  // Fila desplegada para ver el resumen (equipo, control de instalación,
  // fotos) sin salir del listado — el check de alta de esa fila solo se
  // puede tocar mientras está desplegada, para forzar a revisarla antes de
  // marcarla en vez de tildar en cadena sin mirar (ver handleToggleAlta).
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Wait for a pause in typing before hitting the API — avoids firing a
  // request on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: usuariosData } = useApiData((idToken) => listUsuarios(idToken), []);
  const tecnicos = useMemo(() => (usuariosData ?? []).filter((u) => u.role === 'tecnico'), [usuariosData]);
  const tecnicoNombre = useMemo(() => {
    const map = new Map((usuariosData ?? []).map((u) => [u._id, u.nombre || u.email]));
    return (id?: string) => (id && map.get(id)) || (id ? id.slice(-6) : '—');
  }, [usuariosData]);

  const { data, loading, error, setData } = useApiData(
    (idToken) =>
      listConformidades(idToken, {
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: status || undefined,
        tecnicoId: tecnicoId || undefined,
        altaMesaAyuda: altaMesaAyuda || undefined,
        altaCoordinacion: altaCoordinacion || undefined,
        cambioEquipoPendiente: cambioEquipoPendiente || undefined,
        verificacionEquipo: verificacion || undefined,
      }),
    [page, debouncedSearch, status, tecnicoId, altaMesaAyuda, altaCoordinacion, cambioEquipoPendiente, verificacion],
  );

  // Reemplaza solo la fila tocada con la respuesta del servidor — evita el
  // refetch de toda la página (que atenuaba la tabla entera con opacity-60
  // por cada click). Si hay un filtro de alta activo, la fila queda visible
  // con su estado nuevo hasta el próximo refetch en vez de desaparecer sola.
  async function handleToggleAlta(id: string, area: 'mesaAyuda' | 'coordinacion', checked: boolean) {
    const idToken = await getIdToken();
    const updated = await setAltaConformidad(idToken, id, area, checked);
    setData((prev) => (prev ? { ...prev, data: prev.data.map((c) => (c._id === id ? updated : c)) } : prev));
  }

  // Chips removibles para que se vea de un vistazo qué filtros están activos
  // sin tener que abrir cada select — y "Limpiar filtros" los saca todos de una.
  const activeFilters = useMemo(
    () =>
      [
        search && { key: 'search', label: `Buscar: "${search}"`, onRemove: () => setSearch('') },
        tecnicoId && { key: 'tecnico', label: `Técnico: ${tecnicoNombre(tecnicoId)}`, onRemove: () => setTecnicoId('') },
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
    [search, tecnicoId, status, altaMesaAyuda, altaCoordinacion, cambioEquipoPendiente, verificacion, tecnicoNombre],
  );

  function clearAllFilters() {
    setPage(1);
    setSearch('');
    setTecnicoId('');
    setStatus('');
    setAltaMesaAyuda('');
    setAltaCoordinacion('');
    setCambioEquipoPendiente(false);
    setVerificacion('');
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="text-2xl font-extrabold">Conformidades</div>
        <div className="mt-0.5 text-sm font-semibold text-muted">
          {data ? `${data.total} registros` : 'Cargando...'}
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
            placeholder="Cliente, Unidad, IMEI o N° acta..."
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>

        <div className={`${showFiltros ? 'grid' : 'hidden'} grid-cols-2 gap-3 sm:grid sm:grid-cols-4`}>
          <div>
            <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">Técnico</div>
            <Select
              value={tecnicoId}
              onChange={(e) => {
                setPage(1);
                setTecnicoId(e.target.value);
              }}
            >
              <option value="">Todos</option>
              {tecnicos.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.nombre || t.email}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">Estado</div>
            <Select
              value={status}
              onChange={(e) => {
                setPage(1);
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
            <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">Alta mesa de ayuda</div>
            <Select
              value={altaMesaAyuda}
              onChange={(e) => {
                setPage(1);
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
                setPage(1);
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
                setPage(1);
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
                setPage(1);
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

      {/* < lg: una tarjeta por conformidad (la tabla de 11 columnas no entra en el celular). */}
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
                  <div className="truncate text-muted">Ticket: <span className="text-text">{c.ticketOdoo?.numero || '—'}</span></div>
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
        {data && (
          <Card className="pb-4">
            <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} />
          </Card>
        )}
      </div>

      <Card className="hidden p-2.5 pb-4 lg:block">
        <div className="overflow-x-auto">
          <div className="min-w-[1110px]">
            <div className="grid grid-cols-[32px_1.2fr_1.4fr_1.1fr_0.9fr_0.9fr_1fr_0.9fr_1fr_1fr_60px] pb-2.5 pt-4">
              {['', 'Código acta', 'Cliente', 'Técnico', 'Unidad', 'Ticket', 'Fecha', 'Estado', 'Alta MA', 'Alta Coord', ''].map(
                (h, i) => (
                  <div key={i} className="px-3.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">
                    {h}
                  </div>
                ),
              )}
            </div>

            {loading && !data && <div className="px-3 py-6 text-sm font-semibold text-muted">Cargando...</div>}
            {!loading && data?.data.length === 0 && (
              <div className="px-3 py-6 text-sm font-semibold text-muted">No se encontraron conformidades.</div>
            )}

            <div className={`transition-opacity ${loading && data ? 'opacity-60' : ''}`}>
              {data?.data.map((c) => {
                const expanded = expandedIds.has(c._id);
                const roleCanToggleMA = canToggleAlta(usuario?.role, 'mesaAyuda');
                const roleCanToggleCoord = canToggleAlta(usuario?.role, 'coordinacion');
                const expandHint = 'Desplegá la fila (flecha a la izquierda) para revisar el resumen antes de marcarla.';
                return (
                  <div key={c._id} className="border-t border-line">
                    <div
                      onClick={(e) => {
                        const selection = window.getSelection()?.toString();
                        if (selection && selection.trim().length > 0) return;
                        const target = e.target as HTMLElement | null;
                        if (target?.closest('button, a, input, [role="button"], label')) return;
                        toggleExpanded(c._id);
                      }}
                      className="grid grid-cols-[32px_1.2fr_1.4fr_1.1fr_0.9fr_0.9fr_1fr_0.9fr_1fr_1fr_60px] items-center cursor-pointer hover:bg-neutral-50/70">
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
                      <div className="p-3.5 text-[13px] font-bold text-primary">{c.codigoActa}</div>
                      <div className="p-3.5 text-[13px] font-semibold">{c.cliente || '—'}</div>
                      <div className="p-3.5 text-[13px] font-semibold text-muted">{tecnicoNombre(c.tecnicoId)}</div>
                      <div className="p-3.5 text-[13px] font-semibold">{c.matricula || '—'}</div>
                      <div className="p-3.5 text-[13px] font-semibold text-muted">{c.ticketOdoo?.numero || '—'}</div>
                      <div className="p-3.5 text-[13px] font-semibold text-muted">{formatFechaHora(c.fecha, c.hora)}</div>
                      <div className="p-3.5">
                        <Badge tone={ESTADO_TONE[c.status]}>{ESTADO_LABEL[c.status]}</Badge>
                        <BajoResponsabilidadBadge c={c} />
                      </div>
                      <div className="p-3.5">
                        <AltaCheckToggle
                          area="mesaAyuda"
                          value={c.altaEquipo.mesaAyuda}
                          canToggle={roleCanToggleMA && expanded}
                          usuarioNombre={tecnicoNombre}
                          onToggle={(checked) => handleToggleAlta(c._id, 'mesaAyuda', checked)}
                          titleOverride={roleCanToggleMA && !expanded ? expandHint : undefined}
                          showDetail
                        />
                      </div>
                      <div className="p-3.5">
                        <AltaCheckToggle
                          area="coordinacion"
                          value={c.altaEquipo.coordinacion}
                          canToggle={roleCanToggleCoord && expanded}
                          usuarioNombre={tecnicoNombre}
                          onToggle={(checked) => handleToggleAlta(c._id, 'coordinacion', checked)}
                          titleOverride={roleCanToggleCoord && !expanded ? expandHint : undefined}
                          showDetail
                        />
                      </div>
                      <div className="p-3.5">
                        <Link
                          href={`/conformidades/${c._id}`}
                          className="flex h-[34px] w-[34px] items-center justify-center rounded-md bg-surface shadow-soft-sm"
                        >
                          <IconEye />
                        </Link>
                      </div>
                    </div>

                    {expanded && (
                      <div className="border-t border-line bg-bg px-4 py-4">
                        <ConformidadResumenBody c={c} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {data && <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} />}
      </Card>
    </div>
  );
}
