'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { IconChevronLeft } from '@/components/ui/Icons';
import { getReporteTecnicos, listCalendarTasks, listUsuarios } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import { formatMinutos } from '@/lib/format';
import { getArWeek, formatArRange, formatArTimeRange, formatArWeekdayShort, parseOdooUtcString } from '@/lib/calendarDates';
import { CalendarGrid } from '@/components/calendar/CalendarGrid';
import { TaskDetailPanel } from '@/components/calendar/TaskDetailPanel';
import { resolveStatusSwatch } from '@/lib/taskStatusColors';
import type { CalendarTask } from '@/lib/types';

// Vista individual de un técnico: sus promedios de campo + carga de
// tareas/subtareas (mismos datos que la tarjeta en /reportes/tecnicos, ver
// getReporteTecnicos) y su agenda de la semana actual embebida (mismo
// CalendarGrid del módulo de calendario, en modo solo-lectura). Reutiliza
// listUsuarios en vez de pedir un endpoint dedicado por id porque la lista
// de técnicos ya es chica y esa pantalla la carga igual para el selector.
export default function ReporteTecnicoDetallePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const tecnicoId = params.id;
  const [selectedTask, setSelectedTask] = useState<CalendarTask | null>(null);

  const { data: usuariosData } = useApiData((idToken) => listUsuarios(idToken), []);
  const tecnicos = useMemo(() => (usuariosData ?? []).filter((u) => u.role === 'tecnico'), [usuariosData]);
  const tecnico = useMemo(() => tecnicos.find((t) => t._id === tecnicoId) ?? null, [tecnicos, tecnicoId]);

  const { data: resumen, loading: loadingResumen, error: errorResumen } = useApiData(
    (idToken) => getReporteTecnicos(idToken, { tecnicoId }).then((r) => r[0] ?? null),
    [tecnicoId],
  );

  const week = useMemo(() => getArWeek(0), []);
  const {
    data: agendaTasks,
    loading: loadingAgenda,
    error: errorAgenda,
  } = useApiData(
    (idToken) =>
      tecnico?.odooUserId
        ? listCalendarTasks(idToken, { from: week.from, to: week.to, technicianIds: [tecnico.odooUserId] })
        : Promise.resolve([]),
    [tecnico?.odooUserId, week.from, week.to],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link href="/reportes/tecnicos" className="flex items-center gap-1 text-sm font-bold text-muted hover:text-text">
          <IconChevronLeft size={16} />
          Reportes
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-2xl font-extrabold">{tecnico?.nombre || 'Técnico'}</div>
          <div className="mt-0.5 text-sm font-semibold text-muted">Rendimiento y agenda individual</div>
        </div>
        <div className="w-[220px]">
          <Select value={tecnicoId} onChange={(e) => router.push(`/reportes/tecnicos/${e.target.value}`)}>
            {tecnicos.map((t) => (
              <option key={t._id} value={t._id}>
                {t.nombre || t.email}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {errorResumen && (
        <Card className="p-4 text-sm font-semibold text-bad">{errorResumen}</Card>
      )}

      <Card className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[13px] font-extrabold">Últimos 30 días</div>
          {resumen && <Badge tone="primary">{resumen.visitas} visitas</Badge>}
        </div>

        {loadingResumen && !resumen && <div className="text-sm font-semibold text-muted">Cargando...</div>}

        {resumen && (
          <>
            <div className="grid grid-cols-3 gap-3 border-t border-line pt-4">
              <div>
                <div className="text-[10.5px] font-extrabold uppercase tracking-wide text-muted">Traslado prom.</div>
                <div className="text-xl font-extrabold">{formatMinutos(resumen.minutosTrasladoProm)}</div>
              </div>
              <div>
                <div className="text-[10.5px] font-extrabold uppercase tracking-wide text-muted">En el lugar prom.</div>
                <div className="text-xl font-extrabold">{formatMinutos(resumen.minutosEnSitioProm)}</div>
              </div>
              <div>
                <div className="text-[10.5px] font-extrabold uppercase tracking-wide text-muted">Instalación prom.</div>
                <div className="text-xl font-extrabold">{formatMinutos(resumen.minutosInstalandoProm)}</div>
              </div>
            </div>

            {resumen.vinculadoOdoo ? (
              <div className="grid grid-cols-1 gap-3 border-t border-line pt-4 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-2 rounded-md bg-bg p-3 shadow-inset">
                  <div className="text-[12px] font-bold text-muted">Tareas</div>
                  <div className="flex items-center gap-1.5">
                    <Badge tone="neutral">{resumen.tareasTotal} total</Badge>
                    <Badge tone="ok">{resumen.tareasCompletadas} hechas</Badge>
                    <Badge tone="warn">{resumen.tareasPendientes} pend.</Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-md bg-bg p-3 shadow-inset">
                  <div className="text-[12px] font-bold text-muted">Subtareas</div>
                  <div className="flex items-center gap-1.5">
                    <Badge tone="neutral">{resumen.subtareasTotal} total</Badge>
                    <Badge tone="ok">{resumen.subtareasCompletadas} hechas</Badge>
                    <Badge tone="warn">{resumen.subtareasPendientes} pend.</Badge>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-t border-line pt-4 text-[11.5px] font-semibold text-muted">
                Sin cuenta de Odoo vinculada — no se puede traer su carga de tareas ni su agenda.
              </div>
            )}
          </>
        )}
      </Card>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-[13px] font-extrabold">Agenda de técnico</div>
          <div className="text-[12px] font-semibold text-muted">{formatArRange(week.rangeStartUtc, week.days[6])}</div>
        </div>

        {errorAgenda && <Card className="p-4 text-sm font-semibold text-bad">{errorAgenda}</Card>}

        {tecnico && !tecnico.odooUserId && (
          <Card small className="p-4 text-sm font-semibold text-muted">
            Este técnico no tiene una cuenta de Odoo vinculada, así que no se le puede traer la agenda.
          </Card>
        )}

        {tecnico?.odooUserId && (
          <Card className={`p-4 transition-opacity ${loadingAgenda && !agendaTasks ? 'opacity-60' : ''}`}>
            {agendaTasks && (
              <CalendarGrid range={week} tasks={agendaTasks} canDrag={false} onSelectTask={setSelectedTask} onTaskMoved={() => {}} />
            )}
            {!agendaTasks && !errorAgenda && <div className="px-3 py-6 text-sm font-semibold text-muted">Cargando...</div>}
          </Card>
        )}
      </div>

      {tecnico?.odooUserId && agendaTasks && agendaTasks.length > 0 && (
        <div>
          <div className="mb-2 text-[13px] font-extrabold">Tareas y subtareas de la semana</div>
          <Card className="flex flex-col gap-1 p-2.5">
            {agendaTasks.map((task) => {
              const swatch = resolveStatusSwatch(task.stage);
              return (
                <div key={task.id} className="flex flex-col gap-1 border-b border-line py-1.5 last:border-0">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTask(task)}
                      className="flex flex-1 items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition hover:bg-bg"
                    >
                      <span className={`h-2.5 w-2.5 flex-none rounded-full ${swatch.dot}`} />
                      <span className="flex w-[160px] flex-none flex-col leading-tight">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
                          {formatArWeekdayShort(parseOdooUtcString(task.start))}
                        </span>
                        <span className="text-[12px] font-semibold text-muted">{formatArTimeRange(task.start, task.end)}</span>
                      </span>
                      <span className="flex-1 truncate text-[13px] font-bold">{task.partnerName ?? task.title}</span>
                      {task.stage && <Badge tone="neutral">{task.stage}</Badge>}
                      {task.subtaskCount > 0 && <Badge tone="primary">{task.subtaskCount} unidades</Badge>}
                    </button>
                    {task.ticketOdoo && (
                      <a
                        href={`${process.env.NEXT_PUBLIC_ODOO_BASE_URL}/odoo/all-tickets/${task.ticketOdoo.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-none whitespace-nowrap text-[11px] font-bold text-primary hover:underline"
                      >
                        {task.ticketOdoo.label}
                      </a>
                    )}
                  </div>

                  {task.subtasks.length > 0 && (
                    <ul className="ml-8 flex flex-col gap-0.5">
                      {task.subtasks.map((s) => (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedTask(task)}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition hover:bg-bg"
                          >
                            <span
                              className={`h-1.5 w-1.5 flex-none rounded-full ${
                                s.isClosed ? 'bg-ok' : s.stage ? 'bg-primary-600' : 'bg-muted'
                              }`}
                            />
                            <span className="flex-1 truncate text-[12px] font-semibold text-text">{s.name}</span>
                            <span className="flex-none text-[10.5px] font-bold text-muted">
                              {s.isClosed ? 'Completada' : (s.stage ?? 'Pendiente')}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </Card>
        </div>
      )}

      {selectedTask && (
        <TaskDetailPanel task={selectedTask} swatch={resolveStatusSwatch(selectedTask.stage)} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  );
}
