'use client';

import { useState } from 'react';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconCalendar, IconCheck, IconChevronDown, IconClock, IconLock, IconPlus } from '@/components/ui/Icons';
import { ETAPAS_TICKET, TICKETS, type EstadoHoja, type Subtarea, type TareaPadre, type Ticket } from './mock';

type Pestana = 'tareas' | 'cotizacion';

const ESTADO_HOJA: Record<EstadoHoja, { label: string; tone: BadgeTone }> = {
  sin_hoja: { label: 'Sin hoja', tone: 'neutral' },
  borrador_pre: { label: 'PRE en curso', tone: 'warn' },
  pendiente_post: { label: 'POST pendiente', tone: 'warn' },
  completo: { label: 'Completa', tone: 'ok' },
};

const ETAPA_TONE: Record<Subtarea['etapa'], BadgeTone> = {
  Nuevo: 'neutral',
  Coordinado: 'primary',
  'En curso': 'warn',
  Hecho: 'ok',
};

const peso = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

function Iniciales({ nombre }: { nombre: string | null }) {
  if (!nombre) return <span className="text-xs font-semibold text-muted">Sin técnico</span>;
  const ini = nombre
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary-50 text-[10px] font-extrabold text-secondary-700">{ini}</span>
      {nombre}
    </span>
  );
}

function Fecha({ etiqueta, valor, tone }: { etiqueta: string; valor: string | null; tone: 'plan' | 'limite' }) {
  if (!valor) return <span className="text-xs text-muted">{etiqueta}: sin fecha</span>;
  const cls = tone === 'plan' ? 'bg-secondary-50 text-secondary-700' : 'bg-warning-50 text-warning-700';
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${cls}`}>
      {tone === 'plan' ? <IconCalendar size={12} /> : <IconClock size={12} />}
      {etiqueta}: {valor}
    </span>
  );
}

function FilaSubtarea({ s, tarea }: { s: Subtarea; tarea: TareaPadre }) {
  const pareja = s.parejaId ? tarea.subtareas.find((x) => x.id === s.parejaId) : undefined;
  return (
    <div className="flex flex-col gap-2 border-t border-line px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-extrabold">{s.patente}</span>
          {s.rol && <Badge tone={s.rol === 'origen' ? 'warn' : 'primary'}>{s.rol === 'origen' ? 'Unidad de ORIGEN' : 'Unidad de DESTINO'}</Badge>}
          <Badge tone={ETAPA_TONE[s.etapa]}>{s.etapa}</Badge>
        </div>
        <div className="mt-0.5 text-xs font-semibold text-muted">{s.producto ?? 'Sin producto cargado'}</div>
        {pareja && (
          <div className="mt-0.5 text-xs text-muted">
            Vinculada con {pareja.patente} ({pareja.rol === 'origen' ? 'origen' : 'destino'})
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <Fecha etiqueta="Planeada" valor={s.planeada} tone="plan" />
        <Fecha etiqueta="Límite" valor={s.limite} tone="limite" />
        <Iniciales nombre={s.tecnico} />
        <Badge tone={ESTADO_HOJA[s.hoja.estado].tone}>{ESTADO_HOJA[s.hoja.estado].label}</Badge>
      </div>
    </div>
  );
}

function BloqueTarea({ tarea }: { tarea: TareaPadre }) {
  const [abierta, setAbierta] = useState(true);
  const [agendando, setAgendando] = useState(false);
  const hechas = tarea.subtareas.filter((s) => s.etapa === 'Hecho').length;
  const origenHecho = tarea.subtareas.some((s) => s.rol === 'origen' && s.etapa === 'Hecho');

  return (
    <Card className="overflow-hidden">
      <button type="button" onClick={() => setAbierta((v) => !v)} className="flex w-full items-center justify-between gap-3 bg-bg px-4 py-3 text-left">
        <span className="flex min-w-0 items-center gap-2">
          <IconChevronDown size={16} className={`shrink-0 text-muted transition ${abierta ? '' : '-rotate-90'}`} />
          <span className="truncate text-sm font-extrabold">{tarea.nombre}</span>
          <span className="shrink-0 text-xs font-semibold text-muted">
            #{tarea.id} · {hechas}/{tarea.subtareas.length} unidades hechas
          </span>
        </span>
        <span className="hidden shrink-0 items-center gap-2 lg:flex">
          {tarea.esCambioUnidad && <Badge tone="neutral">Cambio de unidad</Badge>}
          <Fecha etiqueta="Planeada" valor={tarea.planeada} tone="plan" />
        </span>
      </button>

      {abierta && (
        <>
          {tarea.subtareas.map((s) => (
            <FilaSubtarea key={s.id} s={s} tarea={tarea} />
          ))}

          <div className="border-t border-line bg-bg px-4 py-3">
            {!agendando ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted">
                  {tarea.esCambioUnidad
                    ? origenHecho
                      ? 'El origen está hecho: se puede agendar la instalación en la unidad de destino.'
                      : 'Se puede agendar el destino antes de que termine el origen.'
                    : 'Agregar otra unidad a esta tarea.'}
                </span>
                <Button onClick={() => setAgendando(true)} className="!px-4 !py-2">
                  <IconPlus size={14} />
                  {tarea.esCambioUnidad ? 'Agendar unidad de destino' : 'Agregar unidad'}
                </Button>
              </div>
            ) : (
              <FormularioAgendar esCambioUnidad={tarea.esCambioUnidad} onCerrar={() => setAgendando(false)} />
            )}
          </div>
        </>
      )}
    </Card>
  );
}

// MAQUETA: el formulario no guarda nada. La versión real llamaría a la API, que crearía la subtarea en Odoo
// (parent_id, planned_date_begin, date_deadline, user_ids, sale_line_id).
function FormularioAgendar({ esCambioUnidad, onCerrar }: { esCambioUnidad: boolean; onCerrar: () => void }) {
  const [enviado, setEnviado] = useState(false);
  const campo = 'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm font-semibold';
  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm font-extrabold">{esCambioUnidad ? 'Agendar unidad de destino' : 'Agregar unidad'}</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs font-bold text-muted">
          Patente o nombre
          <input className={campo} placeholder="AF 098 HX" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-muted">
          Fecha planeada
          <input type="date" className={campo} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-muted">
          Hora y duración
          <div className="flex gap-2">
            <input type="time" className={campo} />
            <select className={campo} defaultValue="60">
              <option value="30">30 min</option>
              <option value="60">1 h</option>
              <option value="120">2 h</option>
            </select>
          </div>
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-muted">
          Técnico
          <select className={campo} defaultValue="">
            <option value="">Sin asignar</option>
            <option>Joaquín Sangiorgio</option>
            <option>Renzo González</option>
          </select>
        </label>
      </div>
      {esCambioUnidad && (
        <label className="flex flex-col gap-1 text-xs font-bold text-muted">
          Producto de instalación
          <select className={campo} defaultValue="INS.001">
            <option value="INS.001">INS.001 Instalación GPS</option>
            <option value="INS.002">INS.002 Instalación GPS + sensores</option>
          </select>
        </label>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setEnviado(true)} className="!px-4 !py-2">
          <IconCheck size={14} />
          Crear subtarea
        </Button>
        <Button variant="ghost" onClick={onCerrar} className="!px-3 !py-2">
          Cancelar
        </Button>
        {enviado && <span className="text-xs font-bold text-warning-700">Maqueta: no se guardó nada en Odoo ni en la base.</span>}
      </div>
    </div>
  );
}

function Cotizacion({ ticket }: { ticket: Ticket }) {
  const c = ticket.cotizacion;
  if (!c) {
    return <Card className="p-5 text-sm font-semibold text-muted">Este ticket no tiene una cotización asociada.</Card>;
  }
  const total = c.lineas.reduce((acc, l) => acc + l.cantidad * l.precio, 0);
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-bg px-4 py-3">
        <div>
          <div className="text-sm font-extrabold">Orden de venta {c.numero}</div>
          <div className="text-xs font-semibold text-muted">Vinculada al ticket #{ticket.id} · Validez {c.validez}</div>
        </div>
        <Badge tone="neutral">
          <IconLock size={12} /> Solo lectura
        </Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="text-xs uppercase text-muted">
              <th className="px-4 py-2">Producto / servicio</th>
              <th className="px-3 py-2 text-center">Cant.</th>
              <th className="px-3 py-2 text-right">Precio</th>
              <th className="px-4 py-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {c.lineas.map((l) => (
              <tr key={l.codigo} className="border-t border-line">
                <td className="px-4 py-2.5">
                  <span className="font-bold">{l.codigo}</span> <span className="text-muted">{l.producto}</span>
                </td>
                <td className="px-3 py-2.5 text-center font-semibold">{l.cantidad}</td>
                <td className="px-3 py-2.5 text-right">{peso(l.precio)}</td>
                <td className="px-4 py-2.5 text-right font-bold">{peso(l.cantidad * l.precio)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-line bg-bg px-4 py-3 text-sm">
        <span className="font-semibold text-muted">Total sin impuestos</span>
        <span className="text-base font-extrabold">{peso(total)}</span>
      </div>
    </Card>
  );
}

// MAQUETA: datos de ejemplo de ./mock.ts. Base de diseño: diseñoOdoo.md. El chatter (responder al cliente y
// notas nuevas) queda anclado para una etapa posterior; acá las notas son solo lectura.
export default function TicketsPage() {
  const [ticketId, setTicketId] = useState(TICKETS[0].id);
  const [pestana, setPestana] = useState<Pestana>('tareas');
  const ticket = TICKETS.find((t) => t.id === ticketId) ?? TICKETS[0];
  const totalUnidades = ticket.tareas.reduce((n, t) => n + t.subtareas.length, 0);
  const hechas = ticket.tareas.reduce((n, t) => n + t.subtareas.filter((s) => s.etapa === 'Hecho').length, 0);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="text-xl font-extrabold lg:text-2xl">Tickets</div>
        <div className="mt-0.5 text-sm font-semibold text-muted">
          Vista de un ticket con sus tareas y unidades. Maqueta con datos de ejemplo: no lee ni escribe en Odoo.
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TICKETS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTicketId(t.id);
              setPestana('tareas');
            }}
            className={`rounded-md px-3 py-2 text-left text-xs font-bold transition ${t.id === ticket.id ? 'bg-primary-600 text-white' : 'bg-surface text-muted shadow-soft-sm'}`}
          >
            #{t.id} · {t.titulo}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="p-4 lg:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge tone="neutral">helpdesk.ticket #{ticket.id}</Badge>
              <div className="flex overflow-hidden rounded-md border border-line text-xs font-bold">
                {ETAPAS_TICKET.map((e) => (
                  <span key={e} className={`px-3 py-1.5 ${e === ticket.etapa ? 'bg-primary-600 text-white' : 'bg-bg text-muted'}`}>
                    {e}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-3 text-lg font-extrabold lg:text-xl">{ticket.titulo}</div>
            <div className="mt-3 grid gap-3 rounded-md bg-bg p-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="font-semibold text-muted">Cliente</div>
                <div className="font-extrabold">{ticket.cliente}</div>
              </div>
              <div>
                <div className="font-semibold text-muted">Teléfono</div>
                <div className="font-extrabold">{ticket.telefono}</div>
              </div>
              <div>
                <div className="font-semibold text-muted">Fecha planeada</div>
                <Fecha etiqueta="Inicio" valor={ticket.planeada} tone="plan" />
              </div>
              <div>
                <div className="font-semibold text-muted">Fecha límite</div>
                <Fecha etiqueta="Fin" valor={ticket.limite} tone="limite" />
              </div>
            </div>
          </Card>

          <div className="flex gap-5 border-b border-line text-sm font-bold">
            <button
              type="button"
              onClick={() => setPestana('tareas')}
              className={`-mb-px border-b-2 py-2.5 ${pestana === 'tareas' ? 'border-primary-600 text-primary-600' : 'border-transparent text-muted'}`}
            >
              Tareas y unidades ({hechas}/{totalUnidades})
            </button>
            <button
              type="button"
              onClick={() => setPestana('cotizacion')}
              className={`-mb-px border-b-2 py-2.5 ${pestana === 'cotizacion' ? 'border-primary-600 text-primary-600' : 'border-transparent text-muted'}`}
            >
              Cotización {ticket.cotizacion ? `(${ticket.cotizacion.numero})` : ''}
            </button>
          </div>

          {pestana === 'tareas' ? (
            <div className="flex flex-col gap-4">
              {ticket.tareas.map((t) => (
                <BloqueTarea key={t.id} tarea={t} />
              ))}
            </div>
          ) : (
            <Cotizacion ticket={ticket} />
          )}
        </div>

        <div className="flex flex-col gap-3">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-extrabold">Notas del ticket</div>
              <Badge tone="neutral">
                <IconLock size={12} /> Solo lectura
              </Badge>
            </div>
            <div className="mt-3 flex flex-col gap-3">
              {ticket.notas.map((n) => (
                <div key={n.id} className="rounded-md bg-warning-50 p-3 text-xs">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-extrabold text-warning-700">{n.autor}</span>
                    <span className="font-semibold text-warning-700/80">{n.fecha}</span>
                  </div>
                  <p className="leading-relaxed text-text">{n.texto}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-md bg-bg p-3 text-xs font-semibold text-muted">
              Responder al cliente y escribir notas nuevas: pendiente para una etapa posterior.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
