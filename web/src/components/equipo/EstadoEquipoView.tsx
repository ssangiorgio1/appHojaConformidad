'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { bo3DiagnosticoUrl } from '@/lib/bo3';
import { formatIsoDateTime } from '@/lib/format';
import type { EstadoEquipo, EventoEquipo } from '@/lib/types';

export function haceCuanto(iso: string | null): string {
  if (!iso) return 'nunca';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return 'hace instantes';
  if (min < 60) return `hace ${min} min`;
  if (min < 60 * 48) return `hace ${Math.round(min / 60)} h`;
  return `hace ${Math.round(min / 1440)} días`;
}

type Chequeo = { label: string; tone: BadgeTone; detalle: string };

function chequeos(e: EstadoEquipo): Chequeo[] {
  const minReporte = e.ultimoReporte ? (Date.now() - new Date(e.ultimoReporte).getTime()) / 60_000 : null;
  const minPos = e.posicion?.fecha ? (Date.now() - new Date(e.posicion.fecha).getTime()) / 60_000 : null;
  const v = e.voltajeCargador;
  return [
    {
      label: 'Reporta',
      tone: minReporte === null ? 'bad' : minReporte <= 15 ? 'ok' : minReporte <= 60 ? 'warn' : 'bad',
      detalle: e.ultimoReporte ? `último reporte ${haceCuanto(e.ultimoReporte)}` : 'nunca reportó',
    },
    {
      label: 'Alimentación',
      tone: v === null ? 'warn' : v < 9 ? 'bad' : 'ok',
      detalle: v === null ? 'sin dato de cargador' : v < 9 ? `${v.toFixed(1)} V — sin alimentación externa` : `${v.toFixed(1)} V`,
    },
    {
      label: 'Señal del módem',
      tone: e.senalDbm === null ? 'neutral' : e.senalDbm >= -85 ? 'ok' : e.senalDbm >= -100 ? 'warn' : 'bad',
      detalle: e.senalDbm === null ? 'sin dato' : `${e.senalDbm} dBm`,
    },
    // Un vehículo detenido (ignición apagada) deja de mandar posiciones y sólo manda el latido
    // cada 10 min: una posición vieja es normal, no una falla.
    e.ignicion && !e.ignicion.encendida && minPos !== null
      ? { label: 'GPS', tone: 'ok', detalle: `última posición ${haceCuanto(e.posicion!.fecha)} · detenido (ignición apagada)` }
      : {
          label: 'GPS',
          tone: minPos === null ? 'warn' : minPos <= 30 ? 'ok' : 'warn',
          detalle: minPos === null ? 'sin posición' : `posición ${haceCuanto(e.posicion!.fecha)}`,
        },
  ];
}

function datosCorto(datos: Record<string, unknown>): string {
  const s = Object.entries(datos)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(', ');
  return s.length > 140 ? `${s.slice(0, 140)}…` : s;
}

function Dato({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[11.5px] font-bold uppercase tracking-wide text-muted">{label}</span>
      <span className="break-words text-sm font-semibold text-text">{children}</span>
    </div>
  );
}

// En modo compacto cada sección aparece con un retraso según su orden (carga escalonada).
function Seccion({ compact, orden = 0, children }: { compact: boolean; orden?: number; children: ReactNode }) {
  return compact ? (
    <div
      className="reveal flex flex-col gap-3 border-t border-neutral-100 pt-4"
      style={{ '--reveal-delay': `${orden * 220}ms` } as CSSProperties}
    >
      {children}
    </div>
  ) : (
    <Card className="flex flex-col gap-3 p-5">{children}</Card>
  );
}

// `compact` = versión para el panel lateral del mapa (una columna, secciones sin tarjeta propia).
export function EstadoEquipoView({
  estado,
  cargando,
  onActualizar,
  compact = false,
}: {
  estado: EstadoEquipo;
  cargando: boolean;
  onActualizar: () => void;
  compact?: boolean;
}) {
  return (
    <>
      <Seccion compact={compact} orden={0}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-lg font-extrabold text-text">
              Equipo {estado.serie ?? `#${estado.equipoId}`}
              {estado.movil ? ` · ${estado.movil.movil}` : ' · sin unidad asignada'}
            </div>
            <div className="text-sm text-muted">
              {estado.movil?.cliente || (estado.movil ? 'Cliente reservado' : 'No está instalado en ningún vehículo')}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {estado.movil?.baja || estado.movil?.bajaCliente ? <Badge tone="neutral">De baja</Badge> : null}
            {estado.movil?.corteDeServicio ? <Badge tone="bad">Corte de servicio</Badge> : null}
            <a
              href={bo3DiagnosticoUrl(estado.equipoId)}
              target="_blank"
              rel="noopener noreferrer"
              title="Abre el diagnóstico del equipo en bo3"
              className="inline-flex items-center rounded-md px-3 py-1.5 text-sm font-bold text-primary-600 transition hover:bg-neutral-100"
            >
              Abrir en bo3 ↗
            </a>
            <Button variant="ghost" onClick={onActualizar} disabled={cargando}>
              {cargando ? 'Actualizando…' : 'Actualizar'}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {chequeos(estado).map((c) => (
            <span key={c.label} className="inline-flex items-center gap-2 rounded-full bg-neutral-100 py-1 pl-1 pr-3 text-xs font-semibold text-text">
              <Badge tone={c.tone}>{c.label}</Badge>
              {c.detalle}
            </span>
          ))}
        </div>

        <div className={`grid gap-4 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}`}>
          <Dato label="IMEI">{estado.imei ?? '—'}</Dato>
          <Dato label="ICCID (SIM)">{estado.iccid ?? '—'}</Dato>
          {(estado.simTelefono || estado.simOperador) && (
            <Dato label="SIM (línea)">{[estado.simTelefono, estado.simOperador].filter(Boolean).join(' · ')}</Dato>
          )}
          <Dato label="Ignición">
            {estado.ignicion ? `${estado.ignicion.encendida ? 'Encendida' : 'Apagada'} (${haceCuanto(estado.ignicion.fecha)})` : '—'}
          </Dato>
          <Dato label="Batería interna">{estado.bateriaInterna !== null ? `${estado.bateriaInterna.toFixed(2)} V` : '—'}</Dato>
          <Dato label="Firmware">
            {estado.firmware.version ?? '—'}
            {estado.firmware.actualizacionDisponible ? ' · hay actualización' : ''}
          </Dato>
          <Dato label="Posición">
            {estado.posicion ? `${estado.posicion.latitud.toFixed(5)}, ${estado.posicion.longitud.toFixed(5)}` : 'No disponible'}
          </Dato>
          <Dato label="Último reporte">{formatIsoDateTime(estado.ultimoReporte ?? undefined)}</Dato>
          <Dato label="Consultado">{formatIsoDateTime(estado.consultadoAt)}</Dato>
        </div>
      </Seccion>

      <Seccion compact={compact} orden={1}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-base font-extrabold text-text">Módulos detectados</div>
          <span className="text-xs text-muted">
            {estado.modulos.fecha ? `el equipo los informó ${haceCuanto(estado.modulos.fecha)}` : 'el equipo todavía no informó módulos'}
          </span>
        </div>
        {estado.modulos.detectados.length === 0 ? (
          <p className="text-sm text-muted">El equipo no detecta módulos conectados (equipo solo GPS, o el periférico no está conectado).</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {estado.modulos.detectados.map((m) => (
              <li key={m.serie} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-bold text-text">{m.descripcion}</span>
                <span className="font-mono text-xs text-muted">{m.serie}</span>
                {m.advertencia && <Badge tone="warn">{m.advertencia}</Badge>}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2 pt-1 text-xs text-muted">
          Eventos vistos alguna vez en el equipo:
          {(['pantalla', 'rfid', 'fuel', 'sim', 'corteMotor'] as const).map((k) => (
            <Badge key={k} tone={estado.senalesVistas[k] ? 'ok' : 'neutral'}>
              {k === 'corteMotor' ? 'corte de motor' : k}
            </Badge>
          ))}
        </div>
      </Seccion>

      <Seccion compact={compact} orden={2}>
        <div className="text-base font-extrabold text-text">Eventos recientes (últimas 6 h)</div>
        {estado.eventosRecientes.length === 0 ? (
          <p className="text-sm text-muted">Sin eventos en las últimas 6 horas (además de las posiciones).</p>
        ) : (
          <div className={`overflow-auto ${compact ? 'max-h-[260px]' : 'max-h-[360px]'}`}>
            <table className="w-full text-left text-[13px]">
              <thead className="sticky top-0 bg-surface text-xs uppercase text-muted">
                <tr>
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3">Evento</th>
                  {!compact && <th className="py-2">Datos</th>}
                </tr>
              </thead>
              <tbody>
                {estado.eventosRecientes.map((ev, i) => (
                  <FilaEvento key={`${ev.fecha}-${ev.evento}-${i}`} ev={ev} compact={compact} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Seccion>
    </>
  );
}

// Fila de evento desplegable: al tocarla muestra todos los campos del evento (voltaje_bateria, dbm_modem, etc.).
function FilaEvento({ ev, compact }: { ev: EventoEquipo; compact: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const campos = Object.entries(ev.datos ?? {});
  return (
    <>
      <tr
        className={`border-t border-neutral-100 align-top ${campos.length ? 'cursor-pointer hover:bg-neutral-50' : ''}`}
        onClick={() => campos.length && setAbierto((v) => !v)}
        aria-expanded={campos.length ? abierto : undefined}
      >
        <td className="whitespace-nowrap py-1.5 pr-3 text-muted">{formatIsoDateTime(ev.fecha)}</td>
        <td className="whitespace-nowrap py-1.5 pr-3 font-bold text-text">
          {campos.length > 0 && <span className="mr-1 text-muted">{abierto ? '▾' : '▸'}</span>}
          {ev.evento}
        </td>
        {!compact && <td className="py-1.5 font-mono text-xs text-muted">{datosCorto(ev.datos)}</td>}
      </tr>
      {abierto && (
        <tr className="bg-neutral-50">
          <td colSpan={compact ? 2 : 3} className="px-2 py-2">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 font-mono text-xs">
              {campos.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted">{k}</dt>
                  <dd className="break-all text-text">{typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)}</dd>
                </div>
              ))}
            </dl>
          </td>
        </tr>
      )}
    </>
  );
}
