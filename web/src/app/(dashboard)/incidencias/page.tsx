'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/Toast';
import { IconAlertTriangle } from '@/components/ui/Icons';
import { IncidenciaDestinatariosPanel } from '@/components/IncidenciaDestinatariosPanel';
import { ReprogramarIncidenciaPanel } from '@/components/ReprogramarIncidenciaPanel';
import { RechazarPropuestaPanel } from '@/components/RechazarPropuestaPanel';
import { ApiError, listSubtareaIncidencias, resolveSubtareaIncidencia } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import { useAuth } from '@/auth/AuthContext';
import { formatFechaConHoraReporte, formatIsoDateTime } from '@/lib/format';
import type { SubtareaIncidencia } from '@/lib/types';

// `value` es el filtro de estado que se manda a la API (uno o varios separados por coma).
// "Pendientes" incluye las propuestas que coordinación rechazó: siguen necesitando reprogramarse a mano.
const TABS: { value: string; label: string }[] = [
  { value: 'propuesta_pendiente', label: 'Propuestas' },
  { value: 'pendiente_reprogramar,rechazada', label: 'Pendientes' },
  { value: 'reprogramada', label: 'Reprogramadas' },
];

const VACIO: Record<string, string> = {
  propuesta_pendiente: 'No hay propuestas de reprogramación esperando respuesta.',
  'pendiente_reprogramar,rechazada': 'No hay unidades pendientes de reprogramar.',
  reprogramada: 'Todavía no se reprogramó ninguna.',
};

function fechaHoraAr(iso?: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
}

const PAGE_SIZE = 20;

export default function IncidenciasPage() {
  const { usuario, getIdToken } = useAuth();
  const toast = useToast();
  const [estadoFiltro, setEstadoFiltro] = useState<string>('pendiente_reprogramar,rechazada');
  const [page, setPage] = useState(1);
  const { data, loading, error, refetch } = useApiData(
    (token) => listSubtareaIncidencias(token, { estado: estadoFiltro, page, pageSize: PAGE_SIZE }),
    [estadoFiltro, page],
  );
  const [configurando, setConfigurando] = useState(false);
  const [reprogramando, setReprogramando] = useState<SubtareaIncidencia | null>(null);
  const [rechazando, setRechazando] = useState<SubtareaIncidencia | null>(null);
  const [aceptandoId, setAceptandoId] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const puedeConfigurar = usuario?.role === 'admin' || usuario?.role === 'superadmin';

  function cambiarTab(estado: string) {
    setPage(1);
    setEstadoFiltro(estado);
  }

  async function onReprogramada() {
    await refetch();
  }

  // Acepta la propuesta tal cual: sin fecha en el pedido, la API usa la que propuso el técnico, mueve la subtarea
  // en Odoo y adjunta el PDF de reprogramación al ticket.
  async function aceptar(inc: SubtareaIncidencia) {
    setAceptandoId(inc._id);
    setErrorAccion(null);
    try {
      await resolveSubtareaIncidencia(await getIdToken(), inc._id);
      await refetch();
      toast('Propuesta aceptada correctamente.');
    } catch (err) {
      setErrorAccion(err instanceof ApiError ? err.message : 'No se pudo aceptar la propuesta.');
    } finally {
      setAceptandoId(null);
    }
  }

  // Qué reportó el técnico y, si hay, su propuesta o el rechazo.
  function detalle(inc: SubtareaIncidencia) {
    return (
      <>
        {inc.tipo === 'pre_cancelado' && <div className="text-[11.5px] font-bold text-warning-700">PRE cancelado por el técnico</div>}
        {inc.tipo === 'reprogramado_cliente' && (
          <div className="text-[11.5px] font-bold text-warning-700">
            El cliente pidió reprogramar en el lugar ·{' '}
            {inc.firmaCliente?.sinFirma ? (
              <>sin firma: {inc.firmaCliente.motivoSinFirma}</>
            ) : inc.firmaCliente?.url ? (
              <>
                firmó {inc.firmaCliente.nombre}
                {inc.firmaCliente.dni ? ` (DNI ${inc.firmaCliente.dni})` : ''} ·{' '}
                <a href={inc.firmaCliente.url} target="_blank" rel="noreferrer" className="underline">
                  ver firma
                </a>
              </>
            ) : null}
          </div>
        )}
        {inc.tipo === 'requiere_otro_tecnico' && (
          <div className="text-[11.5px] font-bold text-warning-700">Requiere otro técnico: la visita ya se hizo, falta la reparación</div>
        )}
        {inc.estado === 'propuesta_pendiente' && inc.propuestaInicio && (
          <div className="text-[12px] font-bold text-primary">
            {inc.tipo === 'reprogramado_cliente' ? 'El cliente eligió' : 'Propone'}: {fechaHoraAr(inc.propuestaInicio)} a {fechaHoraAr(inc.propuestaFin)}
          </div>
        )}
        {inc.estado === 'rechazada' && (
          <div className="text-[12px] font-bold text-bad">Propuesta rechazada{inc.motivoRechazo ? `: ${inc.motivoRechazo}` : ''}</div>
        )}
        {(inc.estado === 'reprogramada' || inc.tipo === 'reprogramado_cliente') && inc.pdfReprogramacionError && (
          <div className="text-[11.5px] font-semibold text-bad">El PDF no se adjuntó al ticket: {inc.pdfReprogramacionError}</div>
        )}
      </>
    );
  }

  function acciones(inc: SubtareaIncidencia) {
    if (inc.estado === 'propuesta_pendiente') {
      return (
        <div className="flex flex-wrap gap-2">
          <Button className="text-xs" onClick={() => aceptar(inc)} disabled={aceptandoId === inc._id}>
            {aceptandoId === inc._id ? 'Aceptando...' : 'Aceptar'}
          </Button>
          <Button variant="ghost" className="border border-neutral-300 text-xs" onClick={() => setReprogramando(inc)}>
            Cambiar hora
          </Button>
          <Button variant="ghost" className="border border-neutral-300 text-xs" onClick={() => setRechazando(inc)}>
            Rechazar
          </Button>
        </div>
      );
    }
    if (inc.estado === 'reprogramada') {
      return (
        <span className="text-xs font-bold text-success-700">
          Reprogramada{inc.reprogramadaPara ? ` para ${formatIsoDateTime(inc.reprogramadaPara)}` : ''}{inc.resueltaAt ? ` · el ${formatIsoDateTime(inc.resueltaAt)}` : ''}
        </span>
      );
    }
    return (
      <Button variant="ghost" className="border border-neutral-300 text-xs" onClick={() => setReprogramando(inc)}>
        Reprogramar
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
        <div>
          <div className="text-xl font-extrabold lg:text-2xl">Unidades no encontradas</div>
          <div className="mt-0.5 text-sm font-semibold text-muted">
            Unidades que el técnico no encontró en el lugar, o cuyo PRE canceló: hay que reprogramarlas. Si el técnico
            propuso fecha y hora, acá se acepta, se cambia la hora o se rechaza.
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
      {rechazando && <RechazarPropuestaPanel incidencia={rechazando} onClose={() => setRechazando(null)} onUpdated={onReprogramada} />}

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
      {errorAccion && <Card className="p-4 text-sm font-semibold text-bad">{errorAccion}</Card>}

      {/* < lg: una tarjeta por unidad (la tabla de 5 columnas no entra en el celular). */}
      <div className={`flex flex-col gap-3 transition-opacity lg:hidden ${loading && data ? 'opacity-60' : ''}`}>
        {loading && !data && <Card className="p-4 text-sm font-semibold text-muted">Cargando...</Card>}
        {data && !data.data.length && (
          <Card className="p-4 text-sm font-semibold text-muted">
            {VACIO[estadoFiltro]}
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
            {detalle(inc)}
            <div className="mt-1">{acciones(inc)}</div>
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
          <div className="min-w-[860px]">
            <div className="grid grid-cols-[1.2fr_1.2fr_1fr_1.8fr_230px] pb-2.5 pt-4">
              {['Unidad', 'Técnico', 'Fecha', 'Motivo', ''].map((h) => (
                <div key={h} className="px-3.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">
                  {h}
                </div>
              ))}
            </div>

            {loading && !data && <div className="px-3 py-6 text-sm font-semibold text-muted">Cargando...</div>}

            {data && !data.data.length && (
              <div className="px-3 py-6 text-sm font-semibold text-muted">
                {VACIO[estadoFiltro]}
              </div>
            )}

            <div className={`transition-opacity ${loading && data ? 'opacity-60' : ''}`}>
              {(data?.data ?? []).map((inc) => (
                <div key={inc._id} className="grid grid-cols-[1.2fr_1.2fr_1fr_1.8fr_230px] items-center border-t border-line">
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
                  <div className="flex flex-col gap-0.5 p-3.5 text-[13px] text-muted">
                    <span>{inc.motivo || '—'}</span>
                    {detalle(inc)}
                  </div>
                  <div className="p-3.5">{acciones(inc)}</div>
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
