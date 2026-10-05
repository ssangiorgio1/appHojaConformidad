'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { IconAlertTriangle } from '@/components/ui/Icons';
import { IncidenciaDestinatariosPanel } from '@/components/IncidenciaDestinatariosPanel';
import { ReprogramarIncidenciaPanel } from '@/components/ReprogramarIncidenciaPanel';
import { listSubtareaIncidencias } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import { useAuth } from '@/auth/AuthContext';
import { formatFechaConHoraReporte, formatIsoDateTime } from '@/lib/format';
import type { EstadoSubtareaIncidencia, SubtareaIncidencia } from '@/lib/types';

const TABS: { value: EstadoSubtareaIncidencia; label: string }[] = [
  { value: 'pendiente_reprogramar', label: 'Pendientes' },
  { value: 'reprogramada', label: 'Reprogramadas' },
];

const PAGE_SIZE = 20;

export default function IncidenciasPage() {
  const { usuario } = useAuth();
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoSubtareaIncidencia>('pendiente_reprogramar');
  const [page, setPage] = useState(1);
  const { data, loading, error, refetch } = useApiData(
    (token) => listSubtareaIncidencias(token, { estado: estadoFiltro, page, pageSize: PAGE_SIZE }),
    [estadoFiltro, page],
  );
  const [configurando, setConfigurando] = useState(false);
  const [reprogramando, setReprogramando] = useState<SubtareaIncidencia | null>(null);
  const puedeConfigurar = usuario?.role === 'admin' || usuario?.role === 'superadmin';

  function cambiarTab(estado: EstadoSubtareaIncidencia) {
    setPage(1);
    setEstadoFiltro(estado);
  }

  async function onReprogramada() {
    await refetch();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
        <div>
          <div className="text-xl font-extrabold lg:text-2xl">Unidades no encontradas</div>
          <div className="mt-0.5 text-sm font-semibold text-muted">
            Unidades de un lote que el técnico no encontró en el lugar al llegar — no tienen hoja de conformidad, hay que
            reprogramarlas en el calendario de Odoo.
          </div>
        </div>
        {puedeConfigurar && (
          <Button variant="ghost" className="flex-none border border-neutral-300 text-xs" onClick={() => setConfigurando(true)}>
            Avisos de reprogramación
          </Button>
        )}
      </div>

      {configurando && <IncidenciaDestinatariosPanel onClose={() => setConfigurando(false)} />}
      {reprogramando && (
        <ReprogramarIncidenciaPanel incidencia={reprogramando} onClose={() => setReprogramando(null)} onUpdated={onReprogramada} />
      )}

      <Card small className="flex w-full gap-1 overflow-x-auto p-1 sm:w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => cambiarTab(tab.value)}
            className={`flex-1 whitespace-nowrap rounded-md px-3.5 py-2.5 text-xs font-bold transition sm:flex-none ${
              estadoFiltro === tab.value ? 'bg-primary-600 text-white' : 'text-muted hover:text-text'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </Card>

      {error && <Card className="p-4 text-sm font-semibold text-bad">{error}</Card>}

      {/* < lg: una tarjeta por unidad (la tabla de 5 columnas no entra en el celular). */}
      <div className={`flex flex-col gap-3 transition-opacity lg:hidden ${loading && data ? 'opacity-60' : ''}`}>
        {loading && !data && <Card className="p-4 text-sm font-semibold text-muted">Cargando...</Card>}
        {data && !data.data.length && (
          <Card className="p-4 text-sm font-semibold text-muted">
            {estadoFiltro === 'pendiente_reprogramar' ? 'No hay unidades pendientes de reprogramar.' : 'Todavía no se reprogramó ninguna.'}
          </Card>
        )}
        {(data?.data ?? []).map((inc) => (
          <Card key={inc._id} className="flex flex-col gap-2 p-4">
            <div className="flex items-start gap-2">
              <IconAlertTriangle className="mt-0.5 flex-none text-warning-600" />
              <div className="flex min-w-0 flex-col">
                <a href={inc.subtareaOdooUrl} target="_blank" rel="noreferrer" className="text-[14px] font-bold text-primary">
                  {inc.subtareaNombre || `Subtarea #${inc.subtareaOdooId}`}
                </a>
                <a href={inc.tareaOdooUrl} target="_blank" rel="noreferrer" className="text-[11.5px] font-semibold text-muted">
                  Tarea #{inc.tareaOdooId} en Odoo
                </a>
              </div>
            </div>
            <div className="text-[12.5px] font-semibold">
              {inc.tecnicoId?.nombre || inc.tecnicoId?.email || '—'} · <span className="text-muted">{formatFechaConHoraReporte(inc.fecha, inc.createdAt)}</span>
            </div>
            {inc.motivo && <div className="text-[12.5px] text-muted">{inc.motivo}</div>}
            {inc.estado === 'pendiente_reprogramar' ? (
              <Button variant="ghost" className="mt-1 w-full justify-center border border-neutral-300 text-xs" onClick={() => setReprogramando(inc)}>
                Reprogramar
              </Button>
            ) : (
              <span className="text-xs font-bold text-success-700">
                Reprogramada{inc.reprogramadaPara ? ` para ${formatIsoDateTime(inc.reprogramadaPara)}` : ''}{inc.resueltaAt ? ` · el ${formatIsoDateTime(inc.resueltaAt)}` : ''}
              </span>
            )}
          </Card>
        ))}
        {data && (
          <Card className="pb-4">
            <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} />
          </Card>
        )}
      </div>

      <Card className="hidden p-2.5 pb-4 lg:block">
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[1.2fr_1.4fr_1fr_1.8fr_150px] pb-2.5 pt-4">
              {['Unidad', 'Técnico', 'Fecha', 'Motivo', ''].map((h) => (
                <div key={h} className="px-3.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">
                  {h}
                </div>
              ))}
            </div>

            {loading && !data && <div className="px-3 py-6 text-sm font-semibold text-muted">Cargando...</div>}

            {data && !data.data.length && (
              <div className="px-3 py-6 text-sm font-semibold text-muted">
                {estadoFiltro === 'pendiente_reprogramar'
                  ? 'No hay unidades pendientes de reprogramar.'
                  : 'Todavía no se reprogramó ninguna.'}
              </div>
            )}

            <div className={`transition-opacity ${loading && data ? 'opacity-60' : ''}`}>
              {(data?.data ?? []).map((inc) => (
                <div key={inc._id} className="grid grid-cols-[1.2fr_1.4fr_1fr_1.8fr_150px] items-center border-t border-line">
                  <div className="flex items-center gap-2 p-3.5">
                    <IconAlertTriangle className="flex-none text-warning-600" />
                    <div className="flex flex-col">
                      <a
                        href={inc.subtareaOdooUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[13px] font-bold text-primary hover:underline"
                      >
                        {inc.subtareaNombre || `Subtarea #${inc.subtareaOdooId}`}
                      </a>
                      <a href={inc.tareaOdooUrl} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-muted hover:underline">
                        Tarea #{inc.tareaOdooId} en Odoo
                      </a>
                    </div>
                  </div>
                  <div className="p-3.5 text-[13px] font-semibold">{inc.tecnicoId?.nombre || inc.tecnicoId?.email || '—'}</div>
                  <div className="p-3.5 text-[13px] font-semibold text-muted">{formatFechaConHoraReporte(inc.fecha, inc.createdAt)}</div>
                  <div className="p-3.5 text-[13px] text-muted">{inc.motivo || '—'}</div>
                  <div className="p-3.5">
                    {inc.estado === 'pendiente_reprogramar' ? (
                      <Button variant="ghost" className="border border-neutral-300 text-xs" onClick={() => setReprogramando(inc)}>
                        Reprogramar
                      </Button>
                    ) : (
                      <span className="text-xs font-bold text-success-700">
                        Reprogramada{inc.reprogramadaPara ? ` para ${formatIsoDateTime(inc.reprogramadaPara)}` : ''}{inc.resueltaAt ? ` · el ${formatIsoDateTime(inc.resueltaAt)}` : ''}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {data && <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} />}
      </Card>
    </div>
  );
}
