'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { IconEye, IconX } from '@/components/ui/Icons';
import type { CalendarSubtask, CalendarTask } from '@/lib/types';
import { formatArTimeRange } from '@/lib/calendarDates';
import type { StatusColorSwatch } from '@/lib/taskStatusColors';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';

// Solo lectura por ahora — crear/mover/archivar tareas queda para una etapa
// posterior (ver plan). Esto es para poder inspeccionar una tarea (sobre
// todo las que ocupan varias horas y no entran enteras en el bloque de la
// grilla).
export function TaskDetailPanel({ task, swatch, onClose }: { task: CalendarTask; swatch: StatusColorSwatch; onClose: () => void }) {
  useBodyScrollLock();
  const [selectedSubtask, setSelectedSubtask] = useState<CalendarSubtask | null>(null);

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 animate-sheet-fade bg-black/45" onClick={onClose} />
      <Card className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col overflow-y-auto overscroll-contain rounded-b-none p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] animate-sheet-up lg:overflow-visible lg:rounded-b-lg lg:animate-none lg:inset-x-auto lg:bottom-6 lg:right-6 lg:top-6 lg:max-h-none lg:w-[420px] lg:pb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="text-lg font-extrabold">{task.title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-md text-muted transition hover:text-text"
          >
            <IconX />
          </button>
        </div>

        <div className="mt-5 flex flex-1 flex-col gap-4 overflow-y-auto">
          <div className={`inline-flex w-fit items-center gap-2 rounded-md px-3 py-1.5 text-sm font-bold ${swatch.bg} ${swatch.text}`}>
            {formatArTimeRange(task.start, task.end)}
          </div>

          <div>
            <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-muted">Técnico</div>
            <div className="text-sm font-semibold">{task.technicianName ?? 'Sin asignar'}</div>
          </div>

          {task.partnerName && (
            <div>
              <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-muted">Cliente</div>
              <div className="text-sm font-semibold">{task.partnerName}</div>
            </div>
          )}

          {task.stage && (
            <div>
              <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-muted">Etapa</div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className={`h-2.5 w-2.5 rounded-full ${swatch.dot}`} />
                {task.stage}
              </div>
            </div>
          )}

          {task.description && (
            <div>
              <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-muted">Descripción</div>
              <div className="whitespace-pre-wrap text-sm text-text">{task.description}</div>
            </div>
          )}

          {task.subtaskCount > 0 && (
            <div>
              {(() => {
                const done = task.subtasks.filter((s) => s.isClosed).length;
                const pct = task.subtaskCount > 0 ? Math.round((done / task.subtaskCount) * 100) : 0;
                return (
                  <>
                    <div className="mb-1 flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wide text-muted">
                      <span>
                        Subtareas ({done} de {task.subtaskCount} completadas)
                      </span>
                    </div>
                    <div className="mb-2.5 h-1.5 w-full overflow-hidden rounded-full bg-surface">
                      <div className="h-full rounded-full bg-ok transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </>
                );
              })()}

              <ul className="flex flex-col gap-1.5">
                {task.subtasks.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedSubtask(s)}
                      className="flex w-full items-center gap-2 rounded-md bg-surface px-2.5 py-1.5 text-left shadow-inset transition hover:brightness-95"
                    >
                      <span
                        className={`h-2 w-2 flex-none rounded-full ${
                          s.isClosed ? 'bg-ok' : s.stage ? 'bg-primary-600' : 'bg-muted'
                        }`}
                      />
                      <span className="flex-1 truncate text-[12.5px] font-semibold text-text">{s.name}</span>
                      {s.technicianName && s.technicianName !== task.technicianName && (
                        <span className="flex-none truncate text-[10.5px] font-semibold text-muted">{s.technicianName}</span>
                      )}
                      {s.stage && <span className="flex-none text-[10.5px] font-bold text-muted">{s.stage}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <a
            href={task.odooUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-auto inline-flex w-fit items-center gap-2 rounded-md bg-surface px-3.5 py-2 text-sm font-bold text-primary shadow-inset"
          >
            <IconEye />
            Ver ticket #{task.id} en Odoo
          </a>
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </Card>

      {selectedSubtask && (
        <div className="fixed inset-0 z-[45]">
          <div className="absolute inset-0 animate-sheet-fade bg-black/45" onClick={() => setSelectedSubtask(null)} />
          <Card className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col overflow-y-auto overscroll-contain rounded-b-none p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] animate-sheet-up lg:overflow-visible lg:rounded-b-lg lg:animate-none lg:inset-x-auto lg:bottom-10 lg:left-1/2 lg:top-10 lg:max-h-none lg:w-[380px] lg:-translate-x-1/2 lg:pb-5">
            <div className="flex items-start justify-between gap-3">
              <div className="text-base font-extrabold">{selectedSubtask.name}</div>
              <button
                type="button"
                onClick={() => setSelectedSubtask(null)}
                aria-label="Cerrar"
                className="flex h-8 w-8 flex-none items-center justify-center rounded-md text-muted transition hover:text-text"
              >
                <IconX />
              </button>
            </div>

            <div className="mt-5 flex flex-1 flex-col gap-4 overflow-y-auto">
              <div>
                <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-muted">Estado</div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className={`h-2.5 w-2.5 rounded-full ${selectedSubtask.isClosed ? 'bg-ok' : selectedSubtask.stage ? 'bg-primary-600' : 'bg-muted'}`} />
                  {selectedSubtask.isClosed ? 'Completada' : (selectedSubtask.stage ?? 'Pendiente')}
                </div>
              </div>

              <div>
                <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-muted">Técnico</div>
                <div className="text-sm font-semibold">{selectedSubtask.technicianName ?? task.technicianName ?? 'Sin asignar'}</div>
              </div>

              {selectedSubtask.description && (
                <div>
                  <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-muted">Descripción</div>
                  <div className="whitespace-pre-wrap text-sm text-text">{selectedSubtask.description}</div>
                </div>
              )}

              <a
                href={selectedSubtask.odooUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-auto inline-flex w-fit items-center gap-2 rounded-md bg-surface px-3.5 py-2 text-sm font-bold text-primary shadow-inset"
              >
                <IconEye />
                Ver subtarea #{selectedSubtask.id} en Odoo
              </a>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
