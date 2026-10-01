'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { IconX } from '@/components/ui/Icons';
import { createIncidenciaDestinatario, deleteIncidenciaDestinatario, listIncidenciaDestinatarios, searchOdooUsers, ApiError } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import { useAuth } from '@/auth/AuthContext';
import type { OdooTechnician } from '@/lib/types';

// Quién recibe el mail.activity de "reprogramar" en Odoo cuando el técnico
// reporta una unidad no encontrada (ver scheduleSubtareaReprogramarActivity
// en el API) — separado de EditUsuarioPanel porque estas personas no
// necesitan cuenta en la app, solo existir como res.users en Odoo.
export function IncidenciaDestinatariosPanel({ onClose }: { onClose: () => void }) {
  const { getIdToken } = useAuth();
  const { data: destinatarios, error: loadError, refetch } = useApiData(listIncidenciaDestinatarios, []);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OdooTechnician[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clears stale results synchronously when the query is cleared/too short, no fetch to await
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const token = await getIdToken();
        const data = await searchOdooUsers(token, q);
        if (!cancelled) setResults(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'No se pudo buscar en Odoo.');
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, getIdToken]);

  async function agregar(user: OdooTechnician) {
    setAddingId(user.id);
    setError(null);
    try {
      const token = await getIdToken();
      await createIncidenciaDestinatario(token, { odooUserId: user.id, nombre: user.name });
      setQuery('');
      setResults([]);
      await refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo agregar.');
    } finally {
      setAddingId(null);
    }
  }

  async function quitar(id: string) {
    setRemovingId(id);
    setError(null);
    try {
      const token = await getIdToken();
      await deleteIncidenciaDestinatario(token, id);
      await refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo quitar.');
    } finally {
      setRemovingId(null);
    }
  }

  const yaAgregado = (userId: number) => destinatarios?.some((d) => d.odooUserId === userId) ?? false;

  return (
    <div className="fixed inset-0 z-20">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <Card className="absolute bottom-6 right-6 top-6 flex w-[440px] flex-col p-5">
        <div className="flex items-center justify-between">
          <div className="text-lg font-extrabold">Avisos de reprogramación</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition hover:text-text"
          >
            <IconX />
          </button>
        </div>

        <div className="mt-2 text-[12.5px] font-semibold text-muted">
          Cuando el técnico reporta una unidad no encontrada, cada persona de esta lista recibe un
          recordatorio (actividad) en la subtarea de Odoo para reprogramarla.
        </div>

        <div className="mt-5 flex flex-col gap-4 overflow-y-auto">
          <div>
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">
              Agregar por nombre (Odoo)
            </div>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ej: Analia Arenas"
            />
            {searching && <div className="mt-2 text-[12.5px] font-semibold text-muted">Buscando...</div>}
            {!searching && results.length > 0 && (
              <div className="mt-2 flex flex-col gap-1 rounded-md bg-surface p-1.5 shadow-inset">
                {results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    disabled={yaAgregado(r.id) || addingId === r.id}
                    onClick={() => agregar(r)}
                    className="flex items-center justify-between rounded-md px-3 py-2 text-left text-[13px] font-bold transition hover:bg-black/5 disabled:opacity-40"
                  >
                    <span>{r.name}</span>
                    <span className="text-[11px] font-semibold text-muted">
                      {yaAgregado(r.id) ? 'Ya agregado' : addingId === r.id ? 'Agregando...' : 'Agregar'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="h-px w-full bg-line" />

          <div>
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">
              Destinatarios actuales
            </div>
            {destinatarios === null && <div className="text-[12.5px] font-semibold text-muted">Cargando...</div>}
            {destinatarios?.length === 0 && (
              <div className="text-[12.5px] font-semibold text-muted">
                Nadie configurado todavía — no se va a crear ninguna actividad en Odoo hasta que agregues a alguien.
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              {destinatarios?.map((d) => (
                <div key={d._id} className="flex items-center justify-between rounded-md bg-surface p-3 shadow-inset">
                  <span className="text-[13px] font-bold">{d.nombre}</span>
                  <button
                    type="button"
                    disabled={removingId === d._id}
                    onClick={() => quitar(d._id)}
                    className="text-[11.5px] font-bold text-bad disabled:opacity-40"
                  >
                    {removingId === d._id ? 'Quitando...' : 'Quitar'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {(error || loadError) && <div className="text-[12.5px] font-semibold text-bad">{error ?? loadError}</div>}
        </div>

        <Button variant="ghost" className="mt-auto" onClick={onClose}>
          Cerrar
        </Button>
      </Card>
    </div>
  );
}
