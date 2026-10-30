'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { EQUIP_CHECK_FIELDS, EQUIP_GROUPS, EQUIP_ITEM_PHOTO_LABEL, isEquipoFieldVisible } from '@wara/shared/src/equipo';
import { prePhotoSlotsFor, postPhotoSlotsFor, INTERVENCION_GROUP_KEY, EXTRA_POST_PHOTOS_KEY, VIDEO_SERVICIO_KEY } from '@wara/shared/src/photoSlots';
import type { ServiceMode } from '@wara/shared/src/serviceMode';
import { TIPO_SERVICIO_LABELS, formatSeries, isEquipoSwap } from '@wara/shared';
import { Badge } from '@/components/ui/Badge';
import { IconAlertTriangle } from '@/components/ui/Icons';
import { formatIsoDateTime } from '@/lib/format';
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
export function ConformidadResumenBody({ c }: { c: ConformidadDoc }) {
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
  const equipoLabelSuffix = c.tipoServicio === 'desinstalacion' ? ' (desinstalado)' : esSwap ? ' (retirado)' : '';
  const tipoServicioLabel = TIPO_SERVICIO_LABELS[c.tipoServicio ?? 'instalacion'];

  const instaladosResumen = useMemo(() => {
    const equipo = c.equipo as Record<string, string | null | undefined>;
    const fields: { key: string; label: string; dependsOn?: string; series?: boolean; canales?: boolean }[] = [];
    for (const group of EQUIP_GROUPS.slice(1)) {
      // skip "Datos del equipo" (modelo/imei se muestran aparte) y "Control
      // de instalación" (son campos de texto, no checkboxes)
      if (group.title === 'Control de instalación') continue;
      for (const f of group.fields) fields.push(f);
    }
    // Los campos de detalle (dependsOn, ej. el textfield de IO1) no son
    // checkboxes — su texto se anexa al badge del checkbox del que dependen
    // en vez de listarse aparte con la etiqueta genérica del campo. Un checkbox puede tener
    // más de un detalle (MDVR: canales y serie).
    const detailsByCheckboxKey = new Map<string, typeof fields>();
    for (const f of fields.filter((x) => x.dependsOn)) {
      detailsByCheckboxKey.set(f.dependsOn as string, [...(detailsByCheckboxKey.get(f.dependsOn as string) ?? []), f]);
    }
    // Los checkbox de EQUIP_GROUPS guardan 'Sí' (truthy) / '' al desmarcar —
    // nunca 'SI' (mayúsculas, sin tilde), que es la convención de
    // EQUIP_CHECK_FIELDS nada más. Comparar contra 'SI' acá nunca matcheaba.
    return fields
      .filter((f) => !f.dependsOn && Boolean(equipo[f.key]))
      .map((f) => {
        const detalles = (detailsByCheckboxKey.get(f.key) ?? [])
          .map((d) => {
            // Cámaras ADAS / DSM guardan varios N° de serie, uno por línea (ver seriesDe en @wara/shared).
            const v = d.series ? formatSeries(equipo[d.key]) : equipo[d.key]?.trim();
            return v ? (d.canales ? `${v} canales` : v) : '';
          })
          .filter(Boolean);
        return detalles.length ? `${f.label}: ${detalles.join(' · ')}` : f.label;
      });
  }, [c]);

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
          <InfoField label="Tipo de servicio">{tipoServicioLabel}</InfoField>
          <InfoField label={`Modelo${equipoLabelSuffix}`}>{c.equipo.modelo || '—'}</InfoField>
          <InfoField label={`IMEI${equipoLabelSuffix}`}>{c.equipo.imei || '—'}</InfoField>
          {esSwap && (
            <>
              <InfoField label="Modelo (instalado)">{c.equipo.modeloInstalado || '—'}</InfoField>
              <InfoField label="IMEI (instalado)">{c.equipo.imeiInstalado || '—'}</InfoField>
            </>
          )}
        </div>

        <div>
          <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">
            Sensores / módulos instalados
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
          <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">Control de instalación</div>
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
        </div>

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
          <ConformidadResumenBody c={c} />
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
