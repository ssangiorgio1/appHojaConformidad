'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { IconX } from '@/components/ui/Icons';
import { resolveSubtareaIncidencia, listTechnicians, ApiError } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import { useAuth } from '@/auth/AuthContext';
import { arWallClockDateTimeToOdooUtcString, parseOdooUtcString, formatOdooUtcString, DEFAULT_TASK_DURATION_HOURS } from '@/lib/calendarDates';
import type { SubtareaIncidencia } from '@/lib/types';

// Reprograma de verdad la subtarea en Odoo (fecha nueva + la reabre de
// "Visita fallida"/"En espera" a "Nuevo"/"En progreso", ver
// resolveSubtareaIncidencia en el API) y recién si eso sale bien marca la
// incidencia resuelta — a diferencia del botón viejo "Marcar reprogramada",
// que solo tildaba el check en Mongo sin tocar Odoo.
export function ReprogramarIncidenciaPanel({
  incidencia,
  onClose,
  onUpdated,
}: {
  incidencia: SubtareaIncidencia;
  onClose: () => void;
  onUpdated: () => Promise<void> | void;
}) {
  const { getIdToken } = useAuth();
  const { data: technicians } = useApiData(listTechnicians, []);
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReprogramar() {
    if (!fecha || !hora) {
      setError('Elegí la nueva fecha y hora de la visita.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const [year, month, day] = fecha.split('-').map(Number);
      const [hour, minute] = hora.split(':').map(Number);
      const start = arWallClockDateTimeToOdooUtcString(year, month, day, hour, minute);
      const end = formatOdooUtcString(new Date(parseOdooUtcString(start).getTime() + DEFAULT_TASK_DURATION_HOURS * 60 * 60 * 1000));

      const token = await getIdToken();
      // El técnico ya va a ver esta unidad en su agenda el día correcto sin
      // importar el resultado (listCalendarTasks arma una entrada por cada
      // fecha real distinta entre las subtareas de un lote) — no hace falta
      // esperar ni avisar nada más acá.
      await resolveSubtareaIncidencia(token, incidencia._id, {
        start,
        end,
        technicianId: technicianId === '' ? undefined : Number(technicianId),
      });
      await onUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo reprogramar la visita.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <Card className="absolute bottom-6 right-6 top-6 flex w-[440px] flex-col p-5">
        <div className="flex items-center justify-between">
          <div className="text-lg font-extrabold">Reprogramar visita</div>
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
          {incidencia.subtareaNombre || `Subtarea #${incidencia.subtareaOdooId}`} — al confirmar, la subtarea en Odoo pasa a la
          fecha nueva y vuelve a &ldquo;Nuevo&rdquo;/&ldquo;En progreso&rdquo; (deja de verse como Visita fallida).
        </div>

        <div className="mt-5 flex flex-1 flex-col gap-4">
          <div>
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">Nueva fecha</div>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">Nueva hora</div>
            <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">Técnico</div>
            <Select value={technicianId} onChange={(e) => setTechnicianId(e.target.value)}>
              <option value="">Mismo técnico</option>
              {technicians?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>

          {error && <div className="text-[12.5px] font-semibold text-bad">{error}</div>}

          <div className="mt-auto flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleReprogramar} disabled={saving}>
              {saving ? 'Reprogramando...' : 'Reprogramar'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
