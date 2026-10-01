'use client';

import { useRef, useState } from 'react';
import type { CalendarTask } from '@/lib/types';
import {
  DEFAULT_TASK_DURATION_HOURS,
  arDayIndexInRange,
  formatArTime,
  formatArWeekdayShort,
  formatOdooUtcString,
  parseOdooUtcString,
  type CalendarRange,
} from '@/lib/calendarDates';
import { resolveStatusSwatch } from '@/lib/taskStatusColors';

const GRID_START_HOUR = 6;
const GRID_END_HOUR = 22;
const HOUR_HEIGHT_PX = 48;
const LANE_GAP_PX = 2;
const LABEL_COLUMN_PX = 56;
const CLICK_THRESHOLD_PX = 4;
const SNAP_HOURS = 0.25; // 15 minutos

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

interface RawTask {
  task: CalendarTask;
  dayIndex: number;
  startHour: number;
  endHour: number;
}

interface PositionedTask extends RawTask {
  lane: number;
  lanesInCluster: number;
}

interface DragState {
  taskId: number;
  // Identidad de ESTA franja puntual (`${id}:${start}:${end}`), no del `id`
  // de Odoo a secas — con el split de calendario, dos entradas distintas
  // (una por cada fecha real de un lote reprogramado) pueden compartir el
  // mismo `id`. Sin esto, arrastrar una movía las dos cajas juntas.
  occurrenceKey: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  columnWidth: number;
  originDayIndex: number;
  originStartHour: number;
  durationHours: number;
  deltaDays: number;
  deltaHours: number;
  moved: boolean;
}

// Hora decimal (0-24, puede pasar de 24 si la tarea sigue al día siguiente)
// relativa a la medianoche (hora Argentina) del día `dayIndex` de la semana
// — a diferencia de tomar solo el componente "hora" del Date de fin, esto
// no se rompe cuando una tarea termina un día calendario después de
// empezar (pasa seguido: Odoo usa date_deadline como fin de ventana y a
// veces coordinación deja varias horas/días de margen).
function hoursSinceDayMidnight(d: Date, dayMidnightUtc: Date): number {
  return (d.getTime() - dayMidnightUtc.getTime()) / (60 * 60 * 1000);
}

function hourToDate(dayMidnightUtc: Date, hour: number): Date {
  return new Date(dayMidnightUtc.getTime() + hour * 60 * 60 * 1000);
}

function toRawTasks(tasks: CalendarTask[], range: CalendarRange): RawTask[] {
  const raw: RawTask[] = [];
  for (const task of tasks) {
    const start = parseOdooUtcString(task.start);
    const dayIndex = arDayIndexInRange(start, range);
    if (dayIndex === null) continue;

    const dayMidnightUtc = range.days[dayIndex];
    const startHour = hoursSinceDayMidnight(start, dayMidnightUtc);
    const rawEndHour = task.end ? hoursSinceDayMidnight(parseOdooUtcString(task.end), dayMidnightUtc) : startHour + DEFAULT_TASK_DURATION_HOURS;
    const endHour = rawEndHour > startHour ? rawEndHour : startHour + DEFAULT_TASK_DURATION_HOURS;

    raw.push({ task, dayIndex, startHour, endHour });
  }
  return raw;
}

// Asigna "carriles" (columnas) a las tareas que se superponen en horario
// dentro de un mismo día, al estilo Google Calendar — sin esto, dos tareas
// simultáneas (dos técnicos distintos, o el mismo con agenda pisada) se
// dibujan una encima de la otra a ancho completo y se tapan.
function layoutDay(dayTasks: RawTask[]): PositionedTask[] {
  const sorted = [...dayTasks].sort((a, b) => a.startHour - b.startHour);
  const result: PositionedTask[] = [];

  let cluster: RawTask[] = [];
  let clusterEnd = -Infinity;

  function flushCluster() {
    if (!cluster.length) return;
    const laneEnds: number[] = [];
    const withLane = cluster.map((t) => {
      let lane = laneEnds.findIndex((end) => end <= t.startHour);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(t.endHour);
      } else {
        laneEnds[lane] = t.endHour;
      }
      return { ...t, lane };
    });
    const lanesInCluster = laneEnds.length;
    for (const t of withLane) result.push({ ...t, lanesInCluster });
    cluster = [];
  }

  for (const t of sorted) {
    if (cluster.length && t.startHour >= clusterEnd) flushCluster();
    cluster.push(t);
    clusterEnd = cluster.length === 1 ? t.endHour : Math.max(clusterEnd, t.endHour);
  }
  flushCluster();

  return result;
}

export function CalendarGrid({
  range,
  tasks,
  canDrag,
  onSelectTask,
  onTaskMoved,
}: {
  range: CalendarRange;
  tasks: CalendarTask[];
  /** Habilita arrastrar tareas — además del rol, requiere que el usuario haya activado el modo edición. */
  canDrag: boolean;
  onSelectTask: (task: CalendarTask) => void;
  onTaskMoved: (occurrenceKey: string, taskId: number, start: string, end: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const hours = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, i) => GRID_START_HOUR + i);
  const gridHeight = hours.length * HOUR_HEIGHT_PX;
  const dayCount = range.days.length;

  let rawTasks = toRawTasks(tasks, range);
  if (drag) {
    rawTasks = rawTasks.map((t) =>
      t.task.occurrenceKey === drag.occurrenceKey
        ? {
            ...t,
            dayIndex: Math.max(0, Math.min(drag.originDayIndex + drag.deltaDays, dayCount - 1)),
            startHour: drag.originStartHour + drag.deltaHours,
            endHour: drag.originStartHour + drag.deltaHours + drag.durationHours,
          }
        : t,
    );
  }

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>, raw: RawTask) {
    // Una entrada sintética (unidad reprogramada a otra fecha que el resto
    // del lote) es de solo lectura acá — no hay forma de decirle a Odoo "moví
    // SOLO esta franja" arrastrando la caja completa, que sigue representando
    // la misma tareaOdooId que la entrada "normal". Para reprogramarla más se
    // usa Incidencias → Reprogramar (ya sabe qué subtarea mover).
    if (!canDrag || raw.task.isSplitOccurrence) return;
    e.preventDefault();
    const rect = containerRef.current!.getBoundingClientRect();
    const columnWidth = (rect.width - LABEL_COLUMN_PX) / dayCount;
    setDrag({
      taskId: raw.task.id,
      occurrenceKey: raw.task.occurrenceKey,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      columnWidth,
      originDayIndex: raw.dayIndex,
      originStartHour: raw.startHour,
      durationHours: raw.endHour - raw.startHour,
      deltaDays: 0,
      deltaHours: 0,
      moved: false,
    });
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;
    const deltaDays = Math.round(dx / drag.columnWidth);
    const deltaHours = Math.round((dy / HOUR_HEIGHT_PX) / SNAP_HOURS) * SNAP_HOURS;
    const moved = drag.moved || Math.abs(dx) > CLICK_THRESHOLD_PX || Math.abs(dy) > CLICK_THRESHOLD_PX;
    setDrag({ ...drag, deltaDays, deltaHours, moved });
  }

  function handlePointerUp(e: React.PointerEvent<HTMLButtonElement>, raw: RawTask) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    e.currentTarget.releasePointerCapture(e.pointerId);

    if (!drag.moved) {
      setDrag(null);
      onSelectTask(raw.task);
      return;
    }

    const newDayIndex = Math.max(0, Math.min(drag.originDayIndex + drag.deltaDays, dayCount - 1));
    const newStartHour = drag.originStartHour + drag.deltaHours;
    const dayMidnightUtc = range.days[newDayIndex];
    const newStart = new Date(dayMidnightUtc.getTime() + newStartHour * 60 * 60 * 1000);
    const newEnd = new Date(newStart.getTime() + drag.durationHours * 60 * 60 * 1000);
    setDrag(null);
    onTaskMoved(raw.task.occurrenceKey, raw.task.id, formatOdooUtcString(newStart), formatOdooUtcString(newEnd));
  }

  return (
    <div className="overflow-x-auto">
      <div ref={containerRef} className="min-w-[860px]">
        <div className="grid border-b border-line pb-2.5" style={{ gridTemplateColumns: `${LABEL_COLUMN_PX}px repeat(${dayCount}, 1fr)` }}>
          <div />
          {range.days.map((d, i) => (
            <div key={i} className="px-1.5 text-center text-[11px] font-extrabold uppercase tracking-wide text-muted">
              {formatArWeekdayShort(d)}
            </div>
          ))}
        </div>

        <div className="relative grid" style={{ gridTemplateColumns: `${LABEL_COLUMN_PX}px repeat(${dayCount}, 1fr)` }}>
          <div>
            {hours.map((h) => (
              <div key={h} style={{ height: HOUR_HEIGHT_PX }} className="pr-2 text-right text-[10.5px] font-semibold text-muted">
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {range.days.map((_, dayIndex) => {
            const positioned = layoutDay(rawTasks.filter((t) => t.dayIndex === dayIndex));
            return (
              <div key={dayIndex} className="relative border-l border-line" style={{ height: gridHeight }}>
                {hours.map((h) => (
                  <div key={h} style={{ height: HOUR_HEIGHT_PX }} className="border-b border-line/60" />
                ))}

                {positioned.map((p) => {
                  const swatch = resolveStatusSwatch(p.task.stage);
                  const clampedStart = Math.max(GRID_START_HOUR, Math.min(p.startHour, GRID_END_HOUR));
                  const clampedEnd = Math.max(clampedStart + 0.5, Math.min(p.endHour, GRID_END_HOUR));
                  const topPx = (clampedStart - GRID_START_HOUR) * HOUR_HEIGHT_PX;
                  const heightPx = Math.max((clampedEnd - clampedStart) * HOUR_HEIGHT_PX, 22);
                  const widthPct = 100 / p.lanesInCluster;
                  const leftPct = p.lane * widthPct;
                  const isDragging = drag?.occurrenceKey === p.task.occurrenceKey && drag.moved;
                  const dayMidnightUtc = range.days[p.dayIndex];
                  // p.endHour puede superar 24 (tarea que termina otro día — ver
                  // calendario_logica_horarios.md). formatArTime solo muestra HH:mm,
                  // así que sin esta marca "09:00 – 10:00" se leía igual sea que la
                  // tarea dure 1 hora o 25.
                  const daysOver = Math.floor(p.endHour / 24);
                  const timeLabel = `${formatArTime(hourToDate(dayMidnightUtc, p.startHour))} – ${formatArTime(hourToDate(dayMidnightUtc, p.endHour))}${daysOver > 0 ? ` (+${daysOver}d)` : ''}`;

                  const canDragThis = canDrag && !p.task.isSplitOccurrence;
                  return (
                    <button
                      key={p.task.occurrenceKey}
                      type="button"
                      onPointerDown={(e) => handlePointerDown(e, p)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={(e) => handlePointerUp(e, p)}
                      onClick={() => !canDragThis && onSelectTask(p.task)}
                      title={`${p.task.title}${p.task.partnerName ? ` — ${p.task.partnerName}` : ''}${p.task.isSplitOccurrence ? ' (unidad reprogramada — usar Incidencias para moverla)' : ''}`}
                      className={`absolute touch-none select-none overflow-hidden rounded-md p-1.5 text-left shadow-inset transition hover:z-10 hover:brightness-95 ${swatch.bg} ${
                        p.task.isSplitOccurrence ? 'border border-dashed border-warning-600' : ''
                      } ${canDragThis ? 'cursor-grab active:cursor-grabbing' : ''} ${
                        isDragging ? 'z-20 opacity-90 ring-2 ring-primary-600' : ''
                      }`}
                      style={{
                        top: topPx,
                        height: heightPx,
                        left: `calc(${leftPct}% + ${p.lane === 0 ? 2 : LANE_GAP_PX / 2}px)`,
                        width: `calc(${widthPct}% - ${p.lanesInCluster > 1 ? LANE_GAP_PX : 4}px)`,
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`flex h-4 w-4 flex-none items-center justify-center rounded-full text-[8px] font-extrabold text-white ${swatch.dot}`}
                        >
                          {p.task.technicianName ? initials(p.task.technicianName) : '?'}
                        </span>
                        <span className={`truncate text-[11px] font-bold ${swatch.text}`}>{timeLabel}</span>
                      </div>
                      <div className="mt-0.5 truncate text-[11px] font-semibold text-text">{p.task.title}</div>
                      {p.task.subtaskCount > 0 && (
                        <div className={`mt-0.5 truncate text-[10px] font-bold ${swatch.text}`}>
                          📋 {p.task.subtasks.filter((s) => s.isClosed).length}/{p.task.subtaskCount} subtareas
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
