'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { IconAlertTriangle } from '@/components/ui/Icons';
import { listSubtareaIncidencias, resolveSubtareaIncidencia } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import { useAuth } from '@/auth/AuthContext';
import { formatFechaHora, formatIsoDateTime } from '@/lib/format';
import type { EstadoSubtareaIncidencia } from '@/lib/types';

const TABS: { value: EstadoSubtareaIncidencia; label: string }[] = [
  { value: 'pendiente_reprogramar', label: 'Pendientes' },
  { value: 'reprogramada', label: 'Reprogramadas' },
];

const PAGE_SIZE = 20;

export default function IncidenciasPage() {
  const { getIdToken } = useAuth();
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoSubtareaIncidencia>('pendiente_reprogramar');
  const [page, setPage] = useState(1);
  const { data, loading, error, refetch } = useApiData(
    (token) => listSubtareaIncidencias(token, { estado: estadoFiltro, page, pageSize: PAGE_SIZE }),
    [estadoFiltro, page],
  );
  const [pendingId, setPendingId] = useState<string | null>(null);

  function cambiarTab(estado: EstadoSubtareaIncidencia) {
    setPage(1);
    setEstadoFiltro(estado);
  }

  async function marcarReprogramada(id: string) {
    setPendingId(id);
    try {
      const token = await getIdToken();
      await resolveSubtareaIncidencia(token, id);
      await refetch();
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="text-2xl font-extrabold">Unidades no encontradas</div>
        <div className="mt-0.5 text-sm font-semibold text-muted">
          Unidades de un lote que el técnico no encontró en el lugar al llegar — no tienen hoja de conformidad, hay que
          reprogramarlas en el calendario de Odoo.
        </div>
      </div>

      <Card small className="flex w-fit gap-1 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => cambiarTab(tab.value)}
            className={`rounded-md px-3.5 py-2 text-xs font-bold transition ${
              estadoFiltro === tab.value ? 'bg-primary-600 text-white' : 'text-muted hover:text-text'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </Card>

      {error && <Card className="p-4 text-sm font-semibold text-bad">{error}</Card>}

      <Card className="p-2.5 pb-4">
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
                  <div className="p-3.5 text-[13px] font-semibold text-muted">{formatFechaHora(inc.fecha)}</div>
                  <div className="p-3.5 text-[13px] text-muted">{inc.motivo || '—'}</div>
                  <div className="p-3.5">
                    {inc.estado === 'pendiente_reprogramar' ? (
                      <Button
                        variant="ghost"
                        className="border border-neutral-300 text-xs"
                        disabled={pendingId === inc._id}
                        onClick={() => marcarReprogramada(inc._id)}
                      >
                        {pendingId === inc._id ? 'Guardando...' : 'Marcar reprogramada'}
                      </Button>
                    ) : (
                      <span className="text-xs font-bold text-success-700">
                        Reprogramada{inc.resueltaAt ? ` · ${formatIsoDateTime(inc.resueltaAt)}` : ''}
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
