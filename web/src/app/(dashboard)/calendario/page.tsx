'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { IconChevronLeft, IconChevronDown, IconEdit, IconLock } from '@/components/ui/Icons';
import { listCalendarTasks, listTechnicians, moveCalendarTask, ApiError } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import { useAuth } from '@/auth/AuthContext';
import { getArDay, getArWeek, formatArFullDate, formatArRange } from '@/lib/calendarDates';
import { CalendarGrid } from '@/components/calendar/CalendarGrid';
import { TaskDetailPanel } from '@/components/calendar/TaskDetailPanel';
import { TechnicianColorPicker } from '@/components/calendar/TechnicianColorPicker';
import { TechnicianMultiSelect } from '@/components/calendar/TechnicianMultiSelect';
import { loadTechnicianColorOverrides, resolveTechnicianSwatch, saveTechnicianColorOverrides, type TechnicianColorMap } from '@/lib/technicianColors';
import type { CalendarTask } from '@/lib/types';

const POLL_MS = 45_000;
const WRITE_ROLES = new Set(['coordinacion', 'admin', 'superadmin']);

type View = 'day' | 'week';
type PendingMove = { start: string; end: string };

export default function CalendarioPage() {
  const { usuario, getIdToken } = useAuth();
  const canWrite = !!usuario && WRITE_ROLES.has(usuario.role);

  const [view, setView] = useState<View>('week');
  const [editMode, setEditMode] = useState(false);
  const canDrag = canWrite && editMode;

  const [weekOffset, setWeekOffset] = useState(0);
  const [dayOffset, setDayOffset] = useState(0);
  const [technicianIds, setTechnicianIds] = useState<number[]>([]);
  const [selectedTask, setSelectedTask] = useState<CalendarTask | null>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [colorOverrides, setColorOverrides] = useState<TechnicianColorMap>({});
  const [pendingMoves, setPendingMoves] = useState<Record<number, PendingMove>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    // localStorage no existe durante el render en el servidor; se sincroniza acá para evitar un mismatch de hidratación.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setColorOverrides(loadTechnicianColorOverrides());
  }, []);

  function handleColorChange(techId: number, key: string) {
    setColorOverrides((prev) => {
      const next = { ...prev, [techId]: key };
      saveTechnicianColorOverrides(next);
      return next;
    });
  }

  function goToday() {
    setWeekOffset(0);
    setDayOffset(0);
  }

  function goPrev() {
    if (view === 'week') setWeekOffset((w) => w - 1);
    else setDayOffset((d) => d - 1);
  }

  function goNext() {
    if (view === 'week') setWeekOffset((w) => w + 1);
    else setDayOffset((d) => d + 1);
  }

  const range = useMemo(() => (view === 'week' ? getArWeek(weekOffset) : getArDay(dayOffset)), [view, weekOffset, dayOffset]);
  const { data: technicians } = useApiData(listTechnicians, []);

  const {
    data: tasks,
    loading,
    error,
    refetch,
  } = useApiData(
    (token) => listCalendarTasks(token, { from: range.from, to: range.to, technicianIds: technicianIds.length ? technicianIds : undefined }),
    [range.from, range.to, technicianIds],
  );

  useEffect(() => {
    const id = setInterval(refetch, POLL_MS);
    return () => clearInterval(id);
  }, [refetch]);

  const displayedTasks = useMemo(
    () => (tasks ?? []).map((t) => (pendingMoves[t.id] ? { ...t, ...pendingMoves[t.id] } : t)),
    [tasks, pendingMoves],
  );
  const pendingCount = Object.keys(pendingMoves).length;

  function handleTaskMoved(taskId: number, start: string, end: string) {
    setSaveError(null);
    setPendingMoves((prev) => ({ ...prev, [taskId]: { start, end } }));
  }

  function discardChanges() {
    setPendingMoves({});
    setSaveError(null);
  }

  async function saveChanges() {
    setSaving(true);
    setSaveError(null);
    const token = await getIdToken();
    const entries = Object.entries(pendingMoves);
    const failed: Record<number, PendingMove> = {};
    for (const [taskId, move] of entries) {
      try {
        await moveCalendarTask(token, Number(taskId), move);
      } catch (err) {
        failed[Number(taskId)] = move;
        setSaveError(err instanceof ApiError ? err.message : 'No se pudo guardar uno o más cambios.');
      }
    }
    setPendingMoves(failed);
    setSaving(false);
    await refetch();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-extrabold">Calendario</div>
          <div className="mt-0.5 text-sm font-semibold text-muted">
            {view === 'week' ? formatArRange(range.rangeStartUtc, range.days[6]) : formatArFullDate(range.rangeStartUtc)}
          </div>
        </div>
      </div>

      <Card small className="flex flex-wrap items-center gap-3 p-3.5">
        <Button variant="ghost" className="shadow-inset" onClick={goPrev}>
          <IconChevronLeft />
        </Button>
        <Button variant="ghost" className="shadow-inset" onClick={goToday}>
          Hoy
        </Button>
        <Button variant="ghost" className="shadow-inset" onClick={goNext}>
          <IconChevronDown className="-rotate-90" />
        </Button>

        <div className="flex rounded-md bg-surface p-1 shadow-inset">
          <button
            type="button"
            onClick={() => setView('day')}
            className={`rounded px-3 py-1.5 text-xs font-bold transition ${view === 'day' ? 'bg-primary-600 text-white' : 'text-muted'}`}
          >
            Día
          </button>
          <button
            type="button"
            onClick={() => setView('week')}
            className={`rounded px-3 py-1.5 text-xs font-bold transition ${view === 'week' ? 'bg-primary-600 text-white' : 'text-muted'}`}
          >
            Semana
          </button>
        </div>

        <div className="ml-auto w-[240px]">
          <TechnicianMultiSelect technicians={technicians ?? []} selected={technicianIds} onChange={setTechnicianIds} />
        </div>

        <Button variant="ghost" className="shadow-inset" onClick={() => setColorPickerOpen(true)}>
          <IconEdit />
          Colores
        </Button>

        {canWrite && (
          <Button
            variant={editMode ? 'primary' : 'ghost'}
            className={editMode ? '' : 'shadow-inset'}
            onClick={() => setEditMode((v) => !v)}
            title={editMode ? 'Desactivar edición para no mover tareas por accidente' : 'Activar para poder arrastrar y mover tareas'}
          >
            {editMode ? <IconLock /> : <IconEdit />}
            {editMode ? 'Editando' : 'Editar'}
          </Button>
        )}
      </Card>

      {editMode && (
        <Card small className="p-3 text-center text-[12.5px] font-bold text-primary-700 shadow-inset">
          Modo edición activado — podés arrastrar tareas para moverlas. Los cambios no se guardan en Odoo hasta que toques &quot;Guardar
          cambios&quot;.
        </Card>
      )}

      {error && (
        <Card className="flex items-center justify-between gap-3 p-4 text-sm font-semibold text-bad">
          {error}
          <Button variant="ghost" className="shadow-inset shrink-0" onClick={refetch}>
            Reintentar
          </Button>
        </Card>
      )}

      {pendingCount > 0 && (
        <Card className="flex items-center gap-3 p-3.5">
          <div className="text-sm font-bold">
            {pendingCount} cambio{pendingCount === 1 ? '' : 's'} sin guardar
          </div>
          {saveError && <div className="text-sm font-semibold text-bad">{saveError}</div>}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" className="shadow-inset" onClick={discardChanges} disabled={saving}>
              Descartar
            </Button>
            <Button onClick={saveChanges} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </Card>
      )}

      {!tasks && !error && (
        <Card className="p-4">
          <div className="px-3 py-6 text-sm font-semibold text-muted">Cargando...</div>
        </Card>
      )}

      {tasks && (
        <Card className={`p-4 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <CalendarGrid
            range={range}
            tasks={displayedTasks}
            colorOverrides={colorOverrides}
            canDrag={canDrag}
            onSelectTask={setSelectedTask}
            onTaskMoved={handleTaskMoved}
          />
        </Card>
      )}

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          swatch={resolveTechnicianSwatch(selectedTask.technicianId, colorOverrides)}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {colorPickerOpen && (
        <TechnicianColorPicker
          technicians={technicians ?? []}
          overrides={colorOverrides}
          onChange={handleColorChange}
          onClose={() => setColorPickerOpen(false)}
        />
      )}
    </div>
  );
}
