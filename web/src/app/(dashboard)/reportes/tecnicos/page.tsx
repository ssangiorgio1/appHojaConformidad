'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { IconX } from '@/components/ui/Icons';
import { getReporteTecnicos, getReporteVisitas, listUsuarios } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import { formatFechaHora, formatIsoDateTime, formatMinutos } from '@/lib/format';
import type { ReporteTecnico, ReporteVisita } from '@/lib/types';

const ESTADO_LABEL: Record<NonNullable<ReporteVisita['estado']>, string> = {
  pendiente: 'Pendiente',
  en_camino: 'En camino',
  en_sitio: 'En el lugar',
  completo: 'Completo',
};

const ESTADO_TONE: Record<NonNullable<ReporteVisita['estado']>, BadgeTone> = {
  pendiente: 'neutral',
  en_camino: 'warn',
  en_sitio: 'primary',
  completo: 'ok',
};

// Un renglón por visita (Conformidad + su VisitaNotificacion cruzada, ver
// api/src/services/reportes.service.ts) con cuánto tardó el técnico en llegar
// (en_camino → en_sitio) y cuánto tardó el trabajo en sitio (en_sitio →
// completo). Solo coordinacion/admin/superadmin llegan acá (ver Sidebar.tsx
// y reportes.routes.ts) — no es algo que un técnico deba ver de otros.
const PAGE_SIZE = 20;

export default function ReportesTecnicosPage() {
  const [tecnicoId, setTecnicoId] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [page, setPage] = useState(1);

  const { data: usuariosData } = useApiData((idToken) => listUsuarios(idToken), []);
  const tecnicos = useMemo(() => (usuariosData ?? []).filter((u) => u.role === 'tecnico'), [usuariosData]);

  const {
    data: visitas,
    loading,
    error,
    refetch,
  } = useApiData(
    (idToken) =>
      getReporteVisitas(idToken, {
        tecnicoId: tecnicoId || undefined,
        fechaDesde: fechaDesde || undefined,
        fechaHasta: fechaHasta || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    [tecnicoId, fechaDesde, fechaHasta, page],
  );

  const {
    data: resumenTecnicos,
    loading: loadingResumen,
    error: errorResumen,
  } = useApiData(
    (idToken) =>
      getReporteTecnicos(idToken, {
        tecnicoId: tecnicoId || undefined,
        fechaDesde: fechaDesde || undefined,
        fechaHasta: fechaHasta || undefined,
      }),
    [tecnicoId, fechaDesde, fechaHasta],
  );

  const activeFilters = [
    tecnicoId && { key: 'tecnico', label: `Técnico: ${tecnicos.find((t) => t._id === tecnicoId)?.nombre ?? tecnicoId}`, onRemove: () => setTecnicoId('') },
    fechaDesde && { key: 'desde', label: `Desde: ${fechaDesde}`, onRemove: () => setFechaDesde('') },
    fechaHasta && { key: 'hasta', label: `Hasta: ${fechaHasta}`, onRemove: () => setFechaHasta('') },
  ].filter((f): f is { key: string; label: string; onRemove: () => void } => Boolean(f));

  function clearAllFilters() {
    setPage(1);
    setTecnicoId('');
    setFechaDesde('');
    setFechaHasta('');
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="text-2xl font-extrabold">Reportes de técnicos</div>
        <div className="mt-0.5 text-sm font-semibold text-muted">
          {visitas ? `${visitas.total} visitas` : 'Cargando...'} · tiempo de traslado y tiempo en sitio por visita
        </div>
      </div>

      <Card small className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="text-[13px] font-extrabold">Filtros</div>
            {activeFilters.length > 0 && <Badge tone="primary">{activeFilters.length}</Badge>}
          </div>
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
            <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">Desde</div>
            <Input
              type="date"
              value={fechaDesde}
              onChange={(e) => {
                setPage(1);
                setFechaDesde(e.target.value);
              }}
            />
          </div>
          <div>
            <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">Hasta</div>
            <Input
              type="date"
              value={fechaHasta}
              onChange={(e) => {
                setPage(1);
                setFechaHasta(e.target.value);
              }}
            />
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

      <div>
        <div className="mb-2 text-[13px] font-extrabold">Rendimiento por técnico</div>
        {errorResumen && <div className="text-sm font-semibold text-bad">{errorResumen}</div>}
        {loadingResumen && !resumenTecnicos && <div className="text-sm font-semibold text-muted">Cargando...</div>}
        {!loadingResumen && resumenTecnicos?.length === 0 && (
          <div className="text-sm font-semibold text-muted">No hay técnicos para estos filtros.</div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {resumenTecnicos?.map((r) => <ReporteTecnicoCard key={r.tecnicoId} data={r} />)}
        </div>
      </div>

      {error && (
        <Card className="flex items-center justify-between gap-3 p-4 text-sm font-semibold text-bad">
          {error}
          <button type="button" onClick={refetch} className="shrink-0 rounded-md px-3 py-1.5 text-xs font-bold shadow-inset">
            Reintentar
          </button>
        </Card>
      )}

      <Card className="p-2.5 pb-4">
        <div className="overflow-x-auto">
          <div className="min-w-[1260px]">
            <div className="grid grid-cols-[1.1fr_1.3fr_1.3fr_0.9fr_0.9fr_1fr_1fr_1fr_1fr_1fr_1fr] pb-2.5 pt-4">
              {['Técnico', 'Cliente', 'Tarea', 'Fecha', 'Estado', 'Salió', 'Llegó', 'Terminó', 'Traslado', 'En el lugar', 'Instalando'].map(
                (h, i) => (
                  <div key={i} className="px-3.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">
                    {h}
                  </div>
                ),
              )}
            </div>

            {loading && !visitas && <div className="px-3 py-6 text-sm font-semibold text-muted">Cargando...</div>}
            {!loading && visitas?.data.length === 0 && (
              <div className="px-3 py-6 text-sm font-semibold text-muted">No hay visitas para estos filtros.</div>
            )}

            <div className={`transition-opacity ${loading && visitas ? 'opacity-60' : ''}`}>
              {visitas?.data.map((v) => (
                <div
                  key={v.visitaId}
                  className="grid grid-cols-[1.1fr_1.3fr_1.3fr_0.9fr_0.9fr_1fr_1fr_1fr_1fr_1fr_1fr] items-center border-t border-line"
                >
                  <div className="p-3.5 text-[13px] font-semibold">{v.tecnico ?? '—'}</div>
                  <div className="p-3.5 text-[13px] font-semibold">{v.cliente || '—'}</div>
                  <div className="p-3.5 text-[13px] font-semibold text-muted">{v.tareaNombre || `#${v.tareaOdooId}`}</div>
                  <div className="p-3.5 text-[13px] font-semibold text-muted">{formatFechaHora(v.fecha ?? undefined, v.hora ?? undefined)}</div>
                  <div className="p-3.5 flex flex-wrap items-center gap-1">
                    {v.estado && <Badge tone={ESTADO_TONE[v.estado]}>{ESTADO_LABEL[v.estado]}</Badge>}
                    {/* El técnico salió/llegó pero cortó (canceló el borrador o nunca volvió) sin
                        terminar — sigue siendo un viaje real, no algo en curso, así que se distingue
                        del badge de estado (que quedaría en "En camino"/"En el lugar" para siempre). */}
                    {!v.abierta && v.estado !== 'completo' && <Badge tone="neutral">Cortado</Badge>}
                  </div>
                  <div className="p-3.5 text-[13px] font-semibold text-muted">{formatIsoDateTime(v.enCaminoAt ?? undefined)}</div>
                  <div className="p-3.5 text-[13px] font-semibold text-muted">{formatIsoDateTime(v.enSitioAt ?? undefined)}</div>
                  <div className="p-3.5 text-[13px] font-semibold text-muted">{formatIsoDateTime(v.completoAt ?? undefined)}</div>
                  <div className="p-3.5 text-[13px] font-bold">{formatMinutos(v.minutosTraslado)}</div>
                  <div className="p-3.5 text-[13px] font-bold">{formatMinutos(v.minutosEnSitio)}</div>
                  <div
                    className="p-3.5 text-[13px] font-bold"
                    title={
                      v.unidades.length > 1
                        ? v.unidades
                            .map((u) => `${u.subtareaNombre || `#${u.subtareaOdooId}`}: ${formatMinutos(u.minutosInstalando)}`)
                            .join('\n')
                        : undefined
                    }
                  >
                    {formatMinutos(v.minutosInstalandoTotal)}
                    {v.unidades.length > 1 && <span className="ml-1 text-[10.5px] font-semibold text-muted">({v.unidades.length}u)</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {visitas && <Pagination page={page} totalPages={visitas.totalPages} onPageChange={setPage} />}
      </Card>
    </div>
  );
}

// Cantidad + desglose pendiente/completado para tareas o subtareas — mismo
// layout para ambas filas de la tarjeta, solo cambian los números.
function ConteoRow({ label, total, completadas, pendientes }: { label: string; total: number; completadas: number; pendientes: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="text-[12px] font-bold text-muted">{label}</div>
      <div className="flex items-center gap-1.5">
        <Badge tone="neutral">{total} total</Badge>
        <Badge tone="ok">{completadas} hechas</Badge>
        <Badge tone="warn">{pendientes} pend.</Badge>
      </div>
    </div>
  );
}

// Resumen de rendimiento de un técnico: promedios de tiempo de campo (de
// Conformidad+VisitaNotificacion) más la carga de tareas/subtareas de Odoo
// Field Service para el mismo rango de fechas filtrado en la página. Si el
// técnico no tiene odooUserId vinculado (ver Usuario.ts), coordinación no
// puede ver su carga de Odoo — se lo indica en vez de mostrar ceros mudos.
function ReporteTecnicoCard({ data }: { data: ReporteTecnico }) {
  return (
    <Link href={`/reportes/tecnicos/${data.tecnicoId}`} className="block">
      <Card small className="flex flex-col gap-3 p-4 transition hover:shadow-soft">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[14px] font-extrabold">{data.tecnico}</div>
          <Badge tone="primary">{data.visitas} visitas</Badge>
        </div>

      <div className="grid grid-cols-3 gap-3 border-t border-line pt-3">
        <div>
          <div className="text-[10.5px] font-extrabold uppercase tracking-wide text-muted">Traslado prom.</div>
          <div className="text-[15px] font-bold">{formatMinutos(data.minutosTrasladoProm)}</div>
        </div>
        <div>
          <div className="text-[10.5px] font-extrabold uppercase tracking-wide text-muted">En el lugar prom.</div>
          <div className="text-[15px] font-bold">{formatMinutos(data.minutosEnSitioProm)}</div>
        </div>
        <div>
          <div className="text-[10.5px] font-extrabold uppercase tracking-wide text-muted">Instalación prom.</div>
          <div className="text-[15px] font-bold">{formatMinutos(data.minutosInstalandoProm)}</div>
        </div>
      </div>

      {data.vinculadoOdoo ? (
        <div className="flex flex-col gap-1.5 border-t border-line pt-3">
          <ConteoRow label="Tareas" total={data.tareasTotal} completadas={data.tareasCompletadas} pendientes={data.tareasPendientes} />
          <ConteoRow
            label="Subtareas"
            total={data.subtareasTotal}
            completadas={data.subtareasCompletadas}
            pendientes={data.subtareasPendientes}
          />
        </div>
      ) : (
        <div className="border-t border-line pt-3 text-[11.5px] font-semibold text-muted">
          Sin cuenta de Odoo vinculada — no se puede traer su carga de tareas.
        </div>
      )}
      </Card>
    </Link>
  );
}
