'use client';

// PRUEBA (2026-11-17): tres formas de mostrar los datos de una hoja para que mesa de ayuda y coordinación den de alta
// la unidad (panel lateral, desplegable por bloques y columnas en la tabla). Se eligen con el selector "Vista" del
// listado de conformidades; cuando el usuario elija una, se borran las otras.

import { useEffect, useState, type ReactNode } from 'react';
import { EQUIP_CHECK_FIELDS, EQUIP_ITEM_PHOTO_LABEL } from '@wara/shared/src/equipo';
import { ACCION_ELEMENTO_LABELS, detalleElementoTexto, CAMBIO_EQUIPO_RAZON_LABELS, accionIntervencionLabel, isEquipoSwap } from '@wara/shared';
import { servicioLabel } from '@/lib/servicioLabel';
import { formatFechaHora } from '@/lib/format';
import { IconAlertTriangle, IconChevronDown, IconX } from '@/components/ui/Icons';
import { ConformidadResumenBody, sensoresInstalados } from '@/components/ConformidadResumen';
import { ticketOdooUrl } from '@/components/TicketOdooLink';
import type { ConformidadDoc } from '@/lib/types';

export type VistaAlta = 'actual' | 'lateral' | 'bloques' | 'columnas';

export const VISTA_ALTA_LABEL: Record<VistaAlta, string> = {
  actual: 'Actual',
  lateral: 'Panel lateral',
  bloques: 'Bloques',
  columnas: 'Columnas',
};

const CONTROL_CORTO: Record<string, string> = {
  controlRevisionIgnicion: 'Ignición',
  controlRevisionPanico: 'Pánico',
  controlConexionRed: 'Red',
  controlRevisionSensores: 'Sensores',
};

// Lo que hace falta para dar de alta, ya ordenado. El equipo principal es el que QUEDA en la unidad (en un cambio de
// equipo, el entrante); en una desinstalación es el que se sacó.
export function datosAlta(c: ConformidadDoc) {
  const esSwap = isEquipoSwap(c.tipoServicio, c.motivoIntervencion);
  const esDesinstalacion = c.tipoServicio === 'desinstalacion';
  const equipo = esSwap
    ? { titulo: 'Equipo instalado', numero: c.equipo.modeloInstalado?.trim() ?? '', imei: c.equipo.imeiInstalado?.trim() ?? '' }
    : { titulo: esDesinstalacion ? 'Equipo retirado' : 'Equipo', numero: c.equipo.modelo?.trim() ?? '', imei: c.equipo.imei?.trim() ?? '' };
  const equipoRetirado = esSwap ? { numero: c.equipo.modelo?.trim() ?? '', imei: c.equipo.imei?.trim() ?? '' } : null;

  let accion = '';
  if (c.tipoServicio === 'reparacion' && c.motivoIntervencion) {
    accion = accionIntervencionLabel(c);
    if (c.motivoIntervencion === 'cambio_equipo' && c.cambioEquipoRazon) accion += ` (${CAMBIO_EQUIPO_RAZON_LABELS[c.cambioEquipoRazon]})`;
    {
      // Con cualquier acción (ej. cambio de equipo que además reemplaza la pantalla).
      const els = Object.entries(c.elementosIntervenidos ?? {}).map(
        ([k, a]) => {
          const serie = detalleElementoTexto(a, c.elementosIntervenidosDetalle?.[k], true);
          return `${EQUIP_ITEM_PHOTO_LABEL[k] ?? k} ${(ACCION_ELEMENTO_LABELS[a] ?? a).toLowerCase()}${serie ? ` ${serie}` : ''}`;
        },
      );
      if (els.length) accion += ` (${els.join(', ')})`;
    }
    // motivoIntervencionDetalle es el diagnóstico ("¿Qué se encontró?") de cualquier acción, no solo de "Otro".
    if (c.motivoIntervencionDetalle?.trim()) accion += `: ${c.motivoIntervencionDetalle.trim()}`;
  }
  if (c.tipoServicio === 'cambio_unidad' && c.cambioUnidad?.rol) {
    accion = c.cambioUnidad.rol === 'origen' ? 'Unidad de origen (se desinstala)' : 'Unidad de destino (se instala)';
  }

  const ticketUrl = ticketOdooUrl(c.ticketOdoo);

  return {
    servicio: servicioLabel(c),
    accion,
    esOtroEquipo: c.tipoUnidad === 'otro_equipo',
    equipo,
    equipoRetirado,
    ticketUrl,
    instalados: sensoresInstalados(c),
    retirados: (c.equipo.elementosRetirados ?? '')
      .split(',')
      .filter(Boolean)
      .map((k) => EQUIP_ITEM_PHOTO_LABEL[k] ?? k),
    odometro: c.equipo.controlOdometro?.trim() ?? '',
    horometro: c.equipo.controlHorometro?.trim() ?? '',
    controles: EQUIP_CHECK_FIELDS.map((f) => ({ key: f.key, label: CONTROL_CORTO[f.key] ?? f.label, valor: c.equipo[f.key] })),
    sinVerificar: Boolean(c.verificacionEquipo?.avanzoBajoResponsabilidad),
    fotos: [...c.pre.fotos.map((f) => ({ ...f, fase: 'PRE' })), ...c.post.fotos.map((f) => ({ ...f, fase: 'POST' }))].filter((f) => f.url),
  };
}

function IconCopy({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

// Valor con botón de copiar al lado: para pegar patente, N° de equipo o IMEI en bo3 / Odoo sin tipearlos.
export function Copiable({ value, mono = false, className = '' }: { value: string; mono?: boolean; className?: string }) {
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), 1200);
    return () => clearTimeout(t);
  }, [copiado]);
  if (!value) return <span className="text-muted">—</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className={mono ? 'font-mono tracking-tight' : ''}>{value}</span>
      <button
        type="button"
        title={copiado ? 'Copiado' : 'Copiar'}
        onClick={(e) => {
          e.stopPropagation();
          navigator.clipboard?.writeText(value).then(() => setCopiado(true));
        }}
        className={`flex h-6 items-center gap-1 rounded px-1 text-[10.5px] font-bold transition ${
          copiado ? 'text-success-700' : 'text-muted hover:bg-bg hover:text-text'
        }`}
      >
        {copiado ? 'Copiado' : <IconCopy />}
      </button>
    </span>
  );
}

function Bloque({ titulo, children, className = '' }: { titulo: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-md border border-line bg-surface p-3 ${className}`}>
      <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">{titulo}</div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </section>
  );
}

function Fila({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[84px_1fr] items-baseline gap-2 text-[13px]">
      <div className="text-[11.5px] font-semibold text-muted">{label}</div>
      <div className="min-w-0 break-words font-bold">{children}</div>
    </div>
  );
}

function marcaControl(valor: unknown) {
  if (valor === 'SI') return { simbolo: '✓', clase: 'bg-success-50 text-success-700', titulo: 'Verificado' };
  if (valor === 'NO') return { simbolo: '✗', clase: 'bg-danger-50 text-danger-700', titulo: 'No verificado' };
  return { simbolo: '—', clase: 'bg-neutral-100 text-neutral-500', titulo: 'No aplica' };
}

// Los cuatro bloques (Unidad, Equipo, Instalado, Control). `columnas` los pone uno al lado del otro (desplegable por
// bloques); si no, van apilados (panel lateral).
export function BloquesAlta({
  c,
  tecnicoNombre,
  columnas = false,
}: {
  c: ConformidadDoc;
  tecnicoNombre: (id?: string) => string;
  columnas?: boolean;
}) {
  const d = datosAlta(c);
  return (
    <div className={columnas ? 'grid grid-cols-4 gap-3' : 'flex flex-col gap-3'}>
      <Bloque titulo="Unidad">
        <Fila label={d.esOtroEquipo ? 'Equipo' : 'Patente'}>
          <Copiable value={c.matricula ?? ''} />
        </Fila>
        <Fila label="Cliente">{c.cliente || '—'}</Fila>
        <Fila label="Ticket">
          {d.ticketUrl ? (
            <a href={d.ticketUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">
              #{c.ticketOdoo?.numero} · abrir en Odoo ↗
            </a>
          ) : (
            '—'
          )}
        </Fila>
        <Fila label="Técnico">{tecnicoNombre(c.tecnicoId)}</Fila>
        <Fila label="Fecha">{formatFechaHora(c.fecha, c.hora)}</Fila>
      </Bloque>

      <Bloque titulo={d.equipo.titulo}>
        <Fila label="N° equipo">
          <Copiable value={d.equipo.numero} mono />
        </Fila>
        <Fila label="IMEI">
          <Copiable value={d.equipo.imei} mono />
        </Fila>
        {d.equipoRetirado && (
          <div className="mt-1 border-t border-line pt-1.5">
            <Fila label="Retirado">
              <span className="font-mono tracking-tight text-muted">
                {d.equipoRetirado.numero || '—'}
                {d.equipoRetirado.imei ? ` · ${d.equipoRetirado.imei}` : ''}
              </span>
            </Fila>
          </div>
        )}
      </Bloque>

      <Bloque titulo="Sensores / módulos">
        {d.instalados.length === 0 && d.retirados.length === 0 && <div className="text-[12.5px] font-semibold text-muted">Ninguno.</div>}
        {d.instalados.map((s) => (
          <div key={s.key} className="text-[13px]">
            <div className="flex items-center gap-1.5 font-bold">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success-500" />
              {s.label}
            </div>
            {s.detalles.map((det) => (
              <div key={det} className="pl-3 text-[12px] font-semibold text-muted">
                <Copiable value={det} mono />
              </div>
            ))}
          </div>
        ))}
        {d.retirados.length > 0 && (
          <div className="mt-1 border-t border-line pt-1.5 text-[12px] font-semibold text-muted">Retirados: {d.retirados.join(', ')}</div>
        )}
      </Bloque>

      <Bloque titulo="Control">
        {!d.esOtroEquipo && (
          <>
            <Fila label="Odómetro">{d.odometro ? `${d.odometro} km` : <span className="text-muted">—</span>}</Fila>
            {d.horometro && <Fila label="Horómetro">{d.horometro} hs</Fila>}
          </>
        )}
        <div className="mt-1 flex flex-wrap gap-1">
          {d.controles.map((k) => {
            const m = marcaControl(k.valor);
            return (
              <span key={k.key} title={`${k.label}: ${m.titulo}`} className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${m.clase}`}>
                {m.simbolo} {k.label}
              </span>
            );
          })}
        </div>
        {d.sinVerificar && (
          <div className="mt-1 flex items-center gap-1 text-[11.5px] font-bold text-warning-700">
            <IconAlertTriangle size={12} />
            Cerró con el equipo sin verificar
          </div>
        )}
      </Bloque>
    </div>
  );
}

function EncabezadoServicio({ c }: { c: ConformidadDoc }) {
  const d = datosAlta(c);
  return (
    <div className="text-[13px] font-bold">
      {d.servicio}
      {d.accion && <span className="font-semibold text-muted"> · {d.accion}</span>}
    </div>
  );
}

// Opción 2: lo que se ve al desplegar la fila. Las fotos y el resto del resumen (observaciones, derivación) quedan
// detrás de un botón.
export function DesplegableBloques({ c, tecnicoNombre, alta }: { c: ConformidadDoc; tecnicoNombre: (id?: string) => string; alta: ReactNode }) {
  const [verTodo, setVerTodo] = useState(false);
  const d = datosAlta(c);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <EncabezadoServicio c={c} />
        {alta}
      </div>
      <BloquesAlta c={c} tecnicoNombre={tecnicoNombre} columnas />
      <div>
        <button
          type="button"
          onClick={() => setVerTodo((v) => !v)}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] font-bold text-primary hover:bg-surface"
        >
          {verTodo ? 'Ocultar fotos y resumen completo' : `Ver fotos (${d.fotos.length}) y resumen completo`}
          <IconChevronDown className={`transition-transform ${verTodo ? 'rotate-180' : ''}`} />
        </button>
        {verTodo && (
          <div className="mt-3">
            <ConformidadResumenBody c={c} mostrarTicket={false} />
          </div>
        )}
      </div>
    </div>
  );
}

// Opción 1: ficha fija a la derecha. ↑/↓ pasan a la hoja anterior/siguiente del listado, Esc la cierra.
export function PanelLateralAlta({
  c,
  tecnicoNombre,
  alta,
  onClose,
  onAnterior,
  onSiguiente,
}: {
  c: ConformidadDoc;
  tecnicoNombre: (id?: string) => string;
  alta: ReactNode;
  onClose: () => void;
  onAnterior?: () => void;
  onSiguiente?: () => void;
}) {
  const [verTodo, setVerTodo] = useState(false);
  const d = datosAlta(c);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, select')) return;
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowDown' && onSiguiente) {
        e.preventDefault();
        onSiguiente();
      } else if (e.key === 'ArrowUp' && onAnterior) {
        e.preventDefault();
        onAnterior();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onAnterior, onSiguiente]);

  return (
    <aside className="fixed inset-y-0 right-0 z-40 flex w-[460px] flex-col border-l border-line bg-bg shadow-soft">
      <div className="flex items-start justify-between gap-3 border-b border-line bg-surface px-4 py-3">
        <div className="min-w-0">
          <div className="text-[13px] font-extrabold text-primary">{c.codigoActa}</div>
          <EncabezadoServicio c={c} />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onAnterior}
            disabled={!onAnterior}
            title="Hoja anterior (↑)"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-bg disabled:opacity-30"
          >
            <IconChevronDown className="rotate-180" />
          </button>
          <button
            type="button"
            onClick={onSiguiente}
            disabled={!onSiguiente}
            title="Hoja siguiente (↓)"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-bg disabled:opacity-30"
          >
            <IconChevronDown />
          </button>
          <button type="button" onClick={onClose} title="Cerrar (Esc)" className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-bg">
            <IconX />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <BloquesAlta c={c} tecnicoNombre={tecnicoNombre} />

        {d.fotos.length > 0 && !verTodo && (
          <div className="mt-3">
            <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">Fotos ({d.fotos.length})</div>
            <div className="grid grid-cols-5 gap-1.5">
              {d.fotos.slice(0, 10).map((f) => (
                <a
                  key={`${f.fase}-${f.id}`}
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="relative block aspect-square overflow-hidden rounded-sm shadow-inset"
                >
                  {f.mimeType === 'video/webm' ? (
                    <video src={f.url} muted className="h-full w-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.url} alt="" className="h-full w-full object-cover" />
                  )}
                  <span className="absolute left-0.5 top-0.5 rounded-sm bg-black/60 px-1 text-[8px] font-extrabold text-white">{f.fase}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setVerTodo((v) => !v)}
          className="mt-3 flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] font-bold text-primary hover:bg-surface"
        >
          {verTodo ? 'Ocultar resumen completo' : 'Ver resumen completo (fotos con detalle, observaciones)'}
          <IconChevronDown className={`transition-transform ${verTodo ? 'rotate-180' : ''}`} />
        </button>
        {verTodo && (
          <div className="mt-3">
            <ConformidadResumenBody c={c} mostrarTicket={false} />
          </div>
        )}
      </div>

      <div className="border-t border-line bg-surface px-4 py-3">{alta}</div>
    </aside>
  );
}

// Opción 3: celdas extra de la tabla, sin desplegar.
export function CeldaEquipo({ c }: { c: ConformidadDoc }) {
  const d = datosAlta(c);
  return (
    <div className="flex flex-col gap-0.5 text-[12.5px] font-semibold">
      <Copiable value={d.equipo.numero} mono className="font-bold" />
      {d.equipo.imei && <Copiable value={d.equipo.imei} mono className="text-[11.5px] text-muted" />}
      {d.equipoRetirado && <span className="text-[11px] text-muted">sale {d.equipoRetirado.numero || '—'}</span>}
    </div>
  );
}

export function CeldaInstalado({ c }: { c: ConformidadDoc }) {
  const d = datosAlta(c);
  if (d.instalados.length === 0) return <span className="text-[12px] font-semibold text-muted">—</span>;
  return (
    <div className="flex flex-col gap-0.5">
      {d.instalados.map((s) => (
        <div key={s.key} className="text-[12px] font-bold leading-tight">
          {s.label}
          {s.detalles.length > 0 && <span className="font-mono font-semibold text-muted"> {s.detalles.join(' · ')}</span>}
        </div>
      ))}
    </div>
  );
}

export function CeldaOdometro({ c }: { c: ConformidadDoc }) {
  const d = datosAlta(c);
  if (!d.odometro && !d.horometro) return <span className="text-[12px] font-semibold text-muted">—</span>;
  return (
    <div className="text-[12.5px] font-bold leading-tight">
      {d.odometro && <div>{d.odometro} km</div>}
      {d.horometro && <div>{d.horometro} hs</div>}
    </div>
  );
}

// Selector de vista (solo escritorio).
export function SelectorVistaAlta({ vista, onChange }: { vista: VistaAlta; onChange: (v: VistaAlta) => void }) {
  return (
    <div className="hidden items-center gap-2 lg:flex">
      <span className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Vista (prueba)</span>
      <div className="flex rounded-md bg-bg p-0.5 shadow-inset">
        {(Object.keys(VISTA_ALTA_LABEL) as VistaAlta[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`rounded px-3 py-1.5 text-[12px] font-bold transition ${vista === v ? 'bg-primary-600 text-white' : 'text-muted hover:text-text'}`}
          >
            {VISTA_ALTA_LABEL[v]}
          </button>
        ))}
      </div>
    </div>
  );
}
