'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { EQUIP_CHECK_FIELDS, EQUIP_GROUPS, EQUIP_ITEM_PHOTO_LABEL, isEquipoFieldVisible } from '@wara/shared/src/equipo';
import { prePhotoSlotsFor, postPhotoSlotsFor, INTERVENCION_GROUP_KEY, EXTRA_POST_PHOTOS_KEY, VIDEO_SERVICIO_KEY } from '@wara/shared/src/photoSlots';
import type { ServiceMode } from '@wara/shared/src/serviceMode';
import { TIPO_SERVICIO_LABELS, UNIDAD_NO_REVISABLE_LABELS, checklistOmitido, ACCION_ELEMENTO_LABELS, detalleElementoTexto, FOTO_ELEMENTO_INTERVENIDO_PREFIX, accionIntervencionLabel, CAMBIO_EQUIPO_RAZON_LABELS, formatSeries, isEquipoSwap, ocultaCambioEquipoEnPdf } from '@wara/shared';
import { Badge } from '@/components/ui/Badge';
import { TicketOdooLink } from '@/components/TicketOdooLink';
import { IconAlertTriangle } from '@/components/ui/Icons';
import { formatIsoDateTime } from '@/lib/format';
import { formatDemora, llegadaTarde } from '@/lib/llegadaTarde';
import { IconCamera, IconChevronDown, IconX } from '@/components/ui/Icons';
import type { ConformidadDoc } from '@/lib/types';

// Combina los slots de los 3 modos — ver misma nota en conformidades/[id]/page.tsx.
const ALL_MODES: ServiceMode[] = ['instalacion', 'retiro', 'reparacion'];
const PHOTO_SLOT_LABELS: Record<'pre' | 'post', Record<string, string>> = {
  pre: Object.fromEntries(ALL_MODES.flatMap((m) => [...prePhotoSlotsFor(m), ...prePhotoSlotsFor(m, 'otro_equipo')]).map((s) => [s.key, s.label])),
  post: Object.fromEntries(ALL_MODES.flatMap((m) => postPhotoSlotsFor(m)).map((s) => [s.key, s.label])),
};

// Fotos de galería libre (no 1 foto = 1 slot fijo) — ver misma nota en
// conformidades/[id]/page.tsx.
const GALLERY_LABELS: Record<string, string> = {
  ...EQUIP_ITEM_PHOTO_LABEL,
  [INTERVENCION_GROUP_KEY]: 'Intervención realizada',
  [EXTRA_POST_PHOTOS_KEY]: 'Otras fotos',
  [VIDEO_SERVICIO_KEY]: 'Video del servicio',
};

// Fotos sincronizadas antes de que el servidor empezara a persistir slotKey
// no van a tener match acá — se muestran sin descripción en vez de romper.
function fotoLabel(fase: 'pre' | 'post', slotKey?: string): string | null {
  if (!slotKey) return null;
  // Foto de un sensor/módulo reemplazado o reparado en una intervención (ver FOTO_ELEMENTO_INTERVENIDO_PREFIX).
  if (slotKey.startsWith(FOTO_ELEMENTO_INTERVENIDO_PREFIX)) {
    const k = slotKey.slice(FOTO_ELEMENTO_INTERVENIDO_PREFIX.length);
    return `${EQUIP_ITEM_PHOTO_LABEL[k] ?? k} (reemplazado / reparado)`;
  }
  return PHOTO_SLOT_LABELS[fase][slotKey] ?? GALLERY_LABELS[slotKey] ?? null;
}

// Nombres cortos para el resumen: la etiqueta de EQUIP_CHECK_FIELDS ("Revisión de ...")
// venía de cuando era un Sí/No manual.
const CONTROL_LABEL: Record<string, string> = {
  controlRevisionIgnicion: 'Ignición',
  controlRevisionPanico: 'Pánico',
  controlConexionRed: 'Conexión a la red',
  controlRevisionSensores: 'Sensores / módulos',
};

// Aviso de que la hoja no se pudo enviar en el momento y llegó después (sin señal, app cerrada): muestra la hora real en que el
// técnico terminó y la hora en que el servidor la recibió. No aparece si llegó a tiempo ni en hojas anteriores a este dato.
export function LlegadaTardeAviso({ c }: { c: ConformidadDoc }) {
  const t = llegadaTarde(c);
  if (!t) return null;
  return (
    <div className="mt-2 rounded-md border border-warning-200 bg-warning-50 p-3 text-xs text-warning-700">
      <div className="flex items-center gap-1.5 font-extrabold">
        <IconAlertTriangle size={14} />
        Llegó al servidor {formatDemora(t.demoraMin)} después de terminarse
      </div>
      <div className="mt-1 leading-snug">
        {t.fase} terminado en el teléfono: {formatIsoDateTime(t.hechaAt)}. Recibido por el servidor: {formatIsoDateTime(t.llegoAt)}. Si se
        revisó el día del servicio, esta hoja todavía no estaba.
      </div>
    </div>
  );
}

// Aviso del resultado de la verificación en vivo del equipo (paso de control de la PWA). Solo se muestra cuando el
// técnico avanzó igual con el equipo sin confirmar: coordinación puede revisar esas hojas. Las hojas anteriores
// a este dato (sin `verificacionEquipo`) no muestran nada, porque no se puede afirmar nada de ellas.
export function VerificacionEquipoAviso({ c }: { c: ConformidadDoc }) {
  const v = c.verificacionEquipo;
  if (!v?.avanzoBajoResponsabilidad) return null;
  return (
    <div className="mt-2 rounded-md border border-warning-200 bg-warning-50 p-3 text-xs text-warning-700">
      <div className="flex items-center gap-1.5 font-extrabold">
        <IconAlertTriangle size={14} />
        {v.estado === 'sin_verificar' ? 'Cerrada sin verificar el equipo' : 'Cerrada con el equipo sin confirmar'}
      </div>
      <div className="mt-0.5 font-semibold">
        El técnico avanzó igual y quedó bajo su responsabilidad{v.at ? ` (${formatIsoDateTime(v.at)})` : ''}
        {v.intentos ? ` tras ${v.intentos} intento${v.intentos === 1 ? '' : 's'} de verificación` : ''}.
      </div>
      {v.problemas.length > 0 && (
        <ul className="mt-1 list-disc pl-4 font-medium">
          {v.problemas.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Sensores/módulos tildados en la hoja, cada uno con sus detalles (N° de serie, canales, texto de IO1...).
export function sensoresInstalados(c: ConformidadDoc): { key: string; label: string; detalles: string[] }[] {
  const equipo = c.equipo as Record<string, string | null | undefined>;
  const fields: { key: string; label: string; dependsOn?: string; series?: boolean; canales?: boolean; cantidad?: boolean; conexion?: boolean }[] = [];
  for (const group of EQUIP_GROUPS.slice(1)) {
    // skip "Datos del equipo" (modelo/imei se muestran aparte) y "Control
    // de instalación" (son campos de texto, no checkboxes)
    if (group.title === 'Control de instalación') continue;
    for (const f of group.fields) fields.push(f);
  }
  // Los campos de detalle (dependsOn, ej. el textfield de IO1) no son
  // checkboxes — su texto se anexa al checkbox del que dependen
  // en vez de listarse aparte con la etiqueta genérica del campo. Un checkbox puede tener
  // más de un detalle (MDVR: canales y serie).
  const detailsByCheckboxKey = new Map<string, typeof fields>();
  for (const f of fields.filter((x) => x.dependsOn)) {
    detailsByCheckboxKey.set(f.dependsOn as string, [...(detailsByCheckboxKey.get(f.dependsOn as string) ?? []), f]);
  }
  // Los checkbox de EQUIP_GROUPS guardan 'Sí' (truthy) / '' al desmarcar —
  // nunca 'SI' (mayúsculas, sin tilde), que es la convención de
  // EQUIP_CHECK_FIELDS nada más.
  return fields
    .filter((f) => !f.dependsOn && Boolean(equipo[f.key]))
    .map((f) => ({
      key: f.key,
      label: f.label,
      detalles: (detailsByCheckboxKey.get(f.key) ?? [])
        .map((d) => {
          // Cámaras ADAS / DSM guardan varios N° de serie, uno por línea (ver seriesDe en @wara/shared).
          const v = d.series ? formatSeries(equipo[d.key]) : equipo[d.key]?.trim();
          if (!v) return '';
          // "x4" y "conectado en IO1": solo el número o la entrada sueltos no se entendían en el panel.
          if (d.conexion) return `conectado en ${v}`;
          if (d.cantidad) return `x${v}`;
          return d.canales ? `${v} canales` : v;
        })
        .filter(Boolean) as string[],
    }));
}

export function InfoField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] font-extrabold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 text-sm font-bold">{children}</div>
    </div>
  );
}

export function ConformidadResumenHeader({
  c,
  open,
  onToggle,
}: {
  c: ConformidadDoc;
  open: boolean;
  onToggle: () => void;
}) {
  const esInstalacion = !c.tipoServicio || c.tipoServicio === 'instalacion';

  return (
    <button type="button" onClick={onToggle} className="flex w-full items-start justify-between gap-3">
      <div className="text-[15px] font-extrabold">{esInstalacion ? 'Resumen de instalación' : 'Resumen del servicio'}</div>
      <IconChevronDown className={`mt-0.5 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
  );
}

// Cuerpo del resumen (equipo, sensores/módulos instalados, control de
// instalación, y todas las fotos PRE+POST) — usado tanto en la página
// individual de la hoja como, desplegable por fila, en el listado de
// conformidades (ver conformidades/page.tsx) para poder dar de alta sin
// tener que entrar de a una.
// `mostrarTicket`: el detalle de la hoja ya tiene su propio link al ticket arriba, así que ahí no se repite.
export function ConformidadResumenBody({ c, mostrarTicket = true }: { c: ConformidadDoc; mostrarTicket?: boolean }) {
  // `isVideo` decide si el lightbox reproduce <video> (con controles) en vez
  // de <img> — ver Foto.mimeType en lib/types.ts (video corto de
  // verificación, Pantalla N° de serie / Cámaras ADAS).
  const [lightbox, setLightbox] = useState<{ url: string; isVideo: boolean } | null>(null);
  const [lightboxZoomed, setLightboxZoomed] = useState(false);

  useEffect(() => {
    if (!lightbox) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightbox(null);
        setLightboxZoomed(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightbox]);

  // modelo/imei del equipo describen el que se retira cuando el servicio es
  // una desinstalación o un cambio de equipo (ver equipo.ts en @wara/shared).
  const esSwap = isEquipoSwap(c.tipoServicio, c.motivoIntervencion);
  // Intervención sin cambio de equipo: el equipo ya estaba en la unidad, no se instaló.
  const intervencionSinCambio = c.tipoServicio === 'reparacion' && !esSwap;
  const equipoLabelSuffix =
    c.tipoServicio === 'desinstalacion' ? ' (desinstalado)' : esSwap ? ' (retirado)' : intervencionSinCambio ? ' (de la unidad)' : '';
  const tipoServicioLabel = TIPO_SERVICIO_LABELS[c.tipoServicio ?? 'instalacion'];

  const instaladosResumen = useMemo(
    () => sensoresInstalados(c).map((s) => (s.detalles.length ? `${s.label}: ${s.detalles.join(' · ')}` : s.label)),
    [c],
  );

  // Sensores/módulos que se desinstalaron además del equipo (ver Equipo.elementosRetirados en @wara/shared).
  const retiradosResumen = useMemo(
    () =>
      (c.equipo.elementosRetirados ?? '')
        .split(',')
        .filter(Boolean)
        .map((k) => EQUIP_ITEM_PHOTO_LABEL[k] ?? k),
    [c],
  );

  const todasLasFotos = useMemo(
    () => [
      ...c.pre.fotos.map((foto) => ({ ...foto, fase: 'PRE' as const })),
      ...c.post.fotos.map((foto) => ({ ...foto, fase: 'POST' as const })),
    ],
    [c],
  );

  return (
    <>
      <div className="flex min-h-0 flex-col gap-4">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          {mostrarTicket && (
            <InfoField label="Ticket Odoo">
              <TicketOdooLink ticket={c.ticketOdoo} />
            </InfoField>
          )}
          <InfoField label="Tipo de servicio">{tipoServicioLabel}</InfoField>
          {/* Desinstalación de una unidad destruida, chocada o incendiada: se salteó el checklist. Bien visible para mesa de ayuda. */}
          {checklistOmitido(c) && c.unidadNoRevisable?.motivo && (
            <InfoField label="Checklist omitido">
              <Badge tone="warn">{UNIDAD_NO_REVISABLE_LABELS[c.unidadNoRevisable.motivo]}</Badge>
              {c.unidadNoRevisable.detalle?.trim() && <span className="ml-1.5">{c.unidadNoRevisable.detalle.trim()}</span>}
            </InfoField>
          )}
          {c.tipoServicio === 'cambio_unidad' && c.cambioUnidad?.rol && (
            <InfoField label="Cambio de unidad">
              {c.cambioUnidad.rol === 'origen' ? 'Unidad de origen (desinstalación)' : 'Unidad de destino (instalación)'}
              {c.cambioUnidad.completo ? ' · cambio completo' : ''}
            </InfoField>
          )}
          {c.tipoServicio === 'cambio_unidad' && c.cambioUnidad?.rol === 'destino' && c.cambioUnidad.desdeRetiro && (
            <InfoField label="Equipo instalado">
              Entregado por el cliente{c.cambioUnidad.desdeRetiro.unidad ? ` (de ${c.cambioUnidad.desdeRetiro.unidad})` : ''}
            </InfoField>
          )}
          {c.tipoServicio === 'reparacion' && c.motivoIntervencion && (
            <InfoField label="Acción tomada">{accionIntervencionLabel(c)}</InfoField>
          )}
          {c.tipoServicio === 'reparacion' && c.motivoIntervencion === 'cambio_equipo' && c.cambioEquipoRazon && (
            <InfoField label="Razón del cambio de equipo">{CAMBIO_EQUIPO_RAZON_LABELS[c.cambioEquipoRazon]}</InfoField>
          )}
          {/* Diagnóstico de la PWA ("¿Qué se encontró?"): se guarda en motivoIntervencionDetalle para cualquier acción.
              Hojas anteriores: el detalle de "Otro" o el de la razón del cambio (cambioEquipoRazonDetalle). */}
          {c.tipoServicio === 'reparacion' && (c.motivoIntervencionDetalle?.trim() || c.cambioEquipoRazonDetalle?.trim()) && (
            <InfoField label="Diagnóstico">
              {[c.motivoIntervencionDetalle?.trim(), c.cambioEquipoRazonDetalle?.trim()].filter(Boolean).join(' · ')}
            </InfoField>
          )}
          <InfoField label={`Modelo${equipoLabelSuffix}`}>{c.equipo.modelo || '—'}</InfoField>
          <InfoField label={`IMEI${equipoLabelSuffix}`}>{c.equipo.imei || '—'}</InfoField>
          {esSwap && (
            <>
              <InfoField label="Modelo (instalado)">{c.equipo.modeloInstalado || '—'}</InfoField>
              <InfoField label="IMEI (instalado)">{c.equipo.imeiInstalado || '—'}</InfoField>
            </>
          )}
          {/* El técnico carga al menos uno de los dos (según tenga tablero con km o cuente horas de uso); los que
              quedaron vacíos, o los servicios que no los piden (retiro, otro equipo), no se muestran. */}
          {c.equipo.controlOdometro?.trim() && <InfoField label="Odómetro">{c.equipo.controlOdometro.trim()} km</InfoField>}
          {c.equipo.controlHorometro?.trim() && <InfoField label="Horómetro">{c.equipo.controlHorometro.trim()} hs</InfoField>}
          {/* Dónde quedó instalado, según el técnico (uso interno, no va al PDF). */}
          {c.ubicacionEquipo?.trim() && <InfoField label="Ubicación del equipo">{c.ubicacionEquipo.trim()}</InfoField>}
        </div>

        {ocultaCambioEquipoEnPdf(c) && (
          <div className="rounded-md border border-line bg-bg px-3 py-2 text-[12.5px] font-semibold text-muted">
            En la hoja del cliente (y en el ticket de Odoo) solo figura la instalación del sensor o módulo: el cambio de equipo por orden
            interna, el equipo retirado y sus fotos se ven únicamente acá.
          </div>
        )}

        {/* Intervención: sensores/módulos que ya estaban y se reemplazaron o repararon (no son instalaciones nuevas). */}
        {c.tipoServicio === 'reparacion' &&
          (c.motivoIntervencion === 'cambio_sensor_modulo' || Object.keys(c.elementosIntervenidos ?? {}).length > 0) && (
          <div>
            <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">
              Intervención realizada: sensores / módulos reemplazados o reparados
            </div>
            {Object.keys(c.elementosIntervenidos ?? {}).length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(c.elementosIntervenidos ?? {}).map(([k, accion]) => (
                  <Badge key={k} tone="primary">
                    {EQUIP_ITEM_PHOTO_LABEL[k] ?? k}: {ACCION_ELEMENTO_LABELS[accion] ?? accion}
                    {detalleElementoTexto(accion, c.elementosIntervenidosDetalle?.[k], true) ? ` — ${detalleElementoTexto(accion, c.elementosIntervenidosDetalle?.[k], true)}` : ''}
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="text-[12.5px] font-semibold text-muted">Ninguno marcado.</div>
            )}
          </div>
        )}

        <div>
          <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">
            {intervencionSinCambio && !c.instalaSensorModulo ? 'Sensores / módulos de la unidad' : 'Sensores / módulos instalados'}
          </div>
          {instaladosResumen.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {instaladosResumen.map((label) => (
                <Badge key={label} tone="ok">
                  {label}
                </Badge>
              ))}
            </div>
          ) : (
            <div className="text-[12.5px] font-semibold text-muted">Ninguno marcado.</div>
          )}
        </div>

        {retiradosResumen.length > 0 && (
          <div>
            <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">
              Sensores / módulos retirados
            </div>
            <div className="flex flex-wrap gap-1.5">
              {retiradosResumen.map((label) => (
                <Badge key={label} tone="neutral">
                  {label}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">
            {c.tipoServicio === 'reparacion' ? 'Control de funcionamiento' : 'Control de instalación'}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {EQUIP_CHECK_FIELDS.map((f) => {
              // Ya no es un Sí/No que marca el técnico: la PWA lo resuelve sola contra
              // lo que informa el equipo en VisionBLO. Sin valor = no aplicaba a este servicio.
              const value = c.equipo[f.key];
              const tone = value === 'SI' ? 'ok' : value === 'NO' ? 'bad' : 'neutral';
              const estado = value === 'SI' ? 'Verificado' : value === 'NO' ? 'No verificado' : 'No aplica';
              return (
                <Badge key={f.key} tone={tone}>
                  {CONTROL_LABEL[f.key] ?? f.label}: {estado}
                </Badge>
              );
            })}
          </div>
          <VerificacionEquipoAviso c={c} />
          <LlegadaTardeAviso c={c} />
        </div>

        {/* Reparación: lo que contó el técnico en "¿Qué se hizo?" (no figura en el PDF) y si pidió otra intervención. */}
        {c.tipoServicio === 'reparacion' && c.post.observaciones?.trim() && (
          <div>
            <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">
              Intervención realizada · no figura en el PDF
            </div>
            <div className="whitespace-pre-wrap rounded-md bg-surface p-3 text-[12.5px] font-medium leading-relaxed shadow-inset">
              {c.post.observaciones}
            </div>
          </div>
        )}
        {c.derivacion?.requerida && (
          <div>
            <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">
              Requiere otra intervención de otro técnico
              {c.derivacion.error ? (
                <Badge tone="bad">No se pudo crear la tarea en Odoo</Badge>
              ) : c.derivacion.procesadaAt ? (
                <Badge tone="ok">Tarea nueva creada{c.derivacion.subtareaNuevaOdooId ? ` (#${c.derivacion.subtareaNuevaOdooId})` : ''}</Badge>
              ) : (
                <Badge tone="neutral">Pendiente de procesar</Badge>
              )}
            </div>
            <div className="whitespace-pre-wrap rounded-md bg-surface p-3 text-[12.5px] font-medium leading-relaxed shadow-inset">
              {c.derivacion.motivo || '—'}
              {c.derivacion.error ? `

Error: ${c.derivacion.error}` : ''}
            </div>
          </div>
        )}

        {/* Por qué se intervino o reparó el equipo, y otros datos que carga el técnico y no salen en el PDF. */}
        {[
          { fase: 'PRE', texto: c.pre.observacionesInternas },
          { fase: 'POST', texto: c.post.observacionesInternas },
        ]
          .filter((o) => o.texto?.trim())
          .map((o) => (
            <div key={o.fase}>
              <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">
                Observaciones internas ({o.fase}) · no figuran en el PDF
              </div>
              <div className="whitespace-pre-wrap rounded-md bg-surface p-3 text-[12.5px] font-medium leading-relaxed shadow-inset">
                {o.texto}
              </div>
            </div>
          ))}

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <div className="text-[10.5px] font-extrabold uppercase tracking-wide text-muted">Todas las fotos (PRE + POST)</div>
            <div className="text-[11.5px] font-bold text-muted">{todasLasFotos.length}</div>
          </div>
          {todasLasFotos.length > 0 ? (
            <div className="grid grid-cols-4 gap-x-2.5 gap-y-3 sm:grid-cols-8">
              {todasLasFotos.map((foto) => {
                const label = fotoLabel(foto.fase === 'PRE' ? 'pre' : 'post', foto.slotKey);
                // Situación extrema (ver GalleryPhotoCapture en la PWA): el
                // técnico no pudo sacar esta foto y dejó el motivo en vez de
                // la imagen — no hay nada que abrir en el lightbox.
                if (foto.motivo) {
                  return (
                    <div
                      key={`${foto.fase}-${foto.id}`}
                      title={label ? `${foto.fase} · ${label}` : foto.fase}
                      className="flex flex-col gap-1 text-left"
                    >
                      <span className="relative flex aspect-square items-center justify-center overflow-hidden rounded-sm bg-bad-bg p-1.5 text-center shadow-inset">
                        <span className="line-clamp-4 text-[9px] font-semibold text-bad">{foto.motivo}</span>
                        <span className="absolute left-1 top-1 rounded-sm bg-black/60 px-1 py-0.5 text-[8.5px] font-extrabold text-white">
                          {foto.fase}
                        </span>
                      </span>
                      <span className="truncate text-[10px] font-semibold text-muted">{label ?? 'Foto'} (sin foto)</span>
                    </div>
                  );
                }
                const isVideo = foto.mimeType === 'video/webm';
                return (
                  <button
                    key={`${foto.fase}-${foto.id}`}
                    onClick={() => foto.url && setLightbox({ url: foto.url, isVideo })}
                    title={label ? `${foto.fase} · ${label}` : foto.fase}
                    className="flex flex-col gap-1 text-left"
                  >
                    <span className="relative block aspect-square overflow-hidden rounded-sm shadow-inset">
                      {isVideo ? (
                        <video src={foto.url} muted loop autoPlay playsInline className="h-full w-full object-cover" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={foto.url} alt="" className="h-full w-full object-cover" />
                      )}
                      <span className="absolute left-1 top-1 rounded-sm bg-black/60 px-1 py-0.5 text-[8.5px] font-extrabold text-white">
                        {foto.fase}
                      </span>
                    </span>
                    <span className="truncate text-[10px] font-semibold text-muted">{label ?? (isVideo ? 'Video' : 'Foto')}</span>
                    {foto.descripcion && (
                      <span className="line-clamp-3 text-[10px] font-medium leading-tight text-text">{foto.descripcion}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex aspect-[8/1] items-center justify-center rounded-sm text-muted shadow-inset">
              <IconCamera />
              <span className="ml-2 text-xs font-semibold">Sin fotos cargadas</span>
            </div>
          )}
        </div>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6"
          onClick={() => {
            setLightbox(null);
            setLightboxZoomed(false);
          }}
        >
          <button
            onClick={() => {
              setLightbox(null);
              setLightboxZoomed(false);
            }}
            className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
          >
            <IconX />
          </button>
          <div className={`max-h-full max-w-full ${lightboxZoomed ? 'overflow-auto' : 'overflow-hidden'}`}>
            {lightbox.isVideo ? (
              // El video no tiene el gesto de pinch-zoom del <img> — trae sus
              // propios controles nativos en vez del toggle de zoom.
              <video
                src={lightbox.url}
                controls
                autoPlay
                loop
                onClick={(e) => e.stopPropagation()}
                className="max-h-[85vh] max-w-[85vw]"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lightbox.url}
                alt=""
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxZoomed((v) => !v);
                }}
                className={lightboxZoomed ? 'max-w-none cursor-zoom-out' : 'max-h-[85vh] max-w-[85vw] cursor-zoom-in object-contain'}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Wrapper desplegable completo (header + body animado) para la página
// individual. El listado usa Header y Body por separado porque necesita
// intercalar el chevron en su propia columna de la grilla.
export function ConformidadResumen({ c, open, onToggle }: { c: ConformidadDoc; open: boolean; onToggle: () => void }) {
  return (
    <>
      <ConformidadResumenHeader c={c} open={open} onToggle={onToggle} />
      <div
        aria-hidden={!open}
        className={`mt-4 grid overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="min-h-0">
          <ConformidadResumenBody c={c} mostrarTicket={false} />
        </div>
      </div>
    </>
  );
}

// isEquipoFieldVisible re-exportado para que otras vistas de detalle
// (ej. la lista de "Equipo & SIM" completa) puedan ocultar los campos de
// detalle (IO1/IO2/AO1/AO2) cuando su checkbox no está tildado, sin
// importar directo desde @wara/shared/src/equipo en cada lugar.
export { isEquipoFieldVisible };
