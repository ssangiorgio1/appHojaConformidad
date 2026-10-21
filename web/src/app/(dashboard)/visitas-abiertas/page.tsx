'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { IconAlertTriangle } from '@/components/ui/Icons';
import { ApiError, cerrarVisitaAbierta, listVisitasAbiertas } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import { useAuth } from '@/auth/AuthContext';
import { formatIsoDateTime } from '@/lib/format';
import type { VisitaAbierta } from '@/lib/types';

const ESTADO: Record<VisitaAbierta['estado'], string> = { en_camino: 'En camino', en_sitio: 'En sitio' };

function duracion(horas: number): string {
  if (horas < 1) return 'menos de 1 h';
  if (horas < 48) return `${Math.round(horas)} h`;
  return `${Math.round(horas / 24)} días`;
}

// Viajes de técnicos que quedaron abiertos (en camino / en sitio) y bloquean el banner "trabajo en progreso" o un
// nuevo viaje. Cerrar no avisa al cliente ni toca Odoo: solo libera al técnico.
export default function VisitasAbiertasPage() {
  const { getIdToken } = useAuth();
  const { data, loading, error, refetch } = useApiData((token) => listVisitasAbiertas(token), []);
  const [cerrandoId, setCerrandoId] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  async function cerrar(v: VisitaAbierta) {
    const quien = v.tecnico?.nombre || v.tecnico?.email || 'el técnico';
    if (!window.confirm(`¿Cerrar la visita de ${quien} en la tarea #${v.tareaOdooId}?\n\nNo se avisa al cliente ni se toca Odoo: solo se libera al técnico.`)) return;
    setCerrandoId(v._id);
    setErrorAccion(null);
    try {
      await cerrarVisitaAbierta(await getIdToken(), v._id);
      await refetch();
    } catch (err) {
      setErrorAccion(err instanceof ApiError ? err.message : 'No se pudo cerrar la visita.');
    } finally {
      setCerrandoId(null);
    }
  }

  const visitas = data?.data ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
        <div>
          <div className="text-xl font-extrabold lg:text-2xl">Visitas abiertas</div>
          <div className="mt-0.5 text-sm font-semibold text-muted">
            Viajes que un técnico dejó abiertos (en camino o en sitio) y tareas que suspendió para atender otra. Si una visita quedó pegada, por ejemplo porque otro técnico de la
            misma tarea terminó el trabajo, se cierra acá. No se avisa al cliente ni se toca Odoo.
          </div>
        </div>
        <Button variant="ghost" className="flex-none border border-neutral-300 text-xs" onClick={() => refetch()} disabled={loading}>
          {loading ? 'Actualizando...' : 'Actualizar'}
        </Button>
      </div>

      {error && <Card className="p-4 text-sm font-semibold text-bad">{error}</Card>}
      {errorAccion && <Card className="p-4 text-sm font-semibold text-bad">{errorAccion}</Card>}
      {loading && !data && <Card className="p-4 text-sm font-semibold text-muted">Cargando...</Card>}
      {data && !visitas.length && <Card className="p-4 text-sm font-semibold text-muted">No hay visitas abiertas.</Card>}

      <div className="flex flex-col gap-3">
        {visitas.map((v) => (
          <Card key={v._id} className={`flex flex-col gap-2 p-4 ${v.sospechosa ? 'border-l-4 border-warning-600' : ''}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 flex-col">
                <div className="text-[14px] font-bold">
                  {v.tecnico?.nombre || v.tecnico?.email || 'Sin técnico'} · Tarea #{v.tareaOdooId}
                </div>
                <div className="text-[12.5px] font-semibold text-muted">{v.cliente || 'Cliente sin dato'} · día {v.fecha}</div>
              </div>
              {v.suspendida ? (
                <span className="rounded-full bg-warning-600 px-2.5 py-1 text-[11px] font-bold text-white">Suspendida</span>
              ) : (
                <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-bold text-text">{ESTADO[v.estado]}</span>
              )}
            </div>
            {v.suspendida && (
              <div className="text-[12px] font-bold text-warning-700">
                El técnico suspendió esta tarea{v.motivoSuspension ? `: ${v.motivoSuspension}` : ''}. Estaba {ESTADO[v.estado].toLowerCase()}.
              </div>
            )}
            <div className="text-[12.5px] text-muted">
              Salió: {formatIsoDateTime(v.enCaminoAt ?? undefined)} · Llegó: {formatIsoDateTime(v.enSitioAt ?? undefined)} · abierta hace{' '}
              {duracion(v.horasAbierta)}
            </div>
            {v.sospechosa && (
              <div className="flex items-center gap-1.5 text-[12px] font-bold text-warning-700">
                <IconAlertTriangle size={14} />
                {v.otroTecnicoTermino
                  ? 'Otro técnico ya terminó su visita de esta tarea.'
                  : 'Lleva abierta más de 12 horas.'}
                {v.hojasCompletas > 0 ? ` Hay ${v.hojasCompletas} hoja(s) completa(s).` : ''}
              </div>
            )}
            <div className="mt-1">
              <Button variant="ghost" className="border border-neutral-300 text-xs" onClick={() => cerrar(v)} disabled={cerrandoId === v._id}>
                {cerrandoId === v._id ? 'Cerrando...' : 'Cerrar visita'}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
