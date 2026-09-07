'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { EQUIP_CHECK_FIELDS, EQUIP_GROUPS, isEquipoFieldVisible } from '@wara/shared/src/equipo';
import { PRE_PHOTO_SLOTS, POST_PHOTO_SLOTS } from '@wara/shared/src/photoSlots';
import { TIPO_SERVICIO_LABELS } from '@wara/shared';
import { Badge } from '@/components/ui/Badge';
import { IconCamera, IconChevronDown, IconX } from '@/components/ui/Icons';
import type { ConformidadDoc } from '@/lib/types';

const PHOTO_SLOT_LABELS: Record<'pre' | 'post', Record<string, string>> = {
  pre: Object.fromEntries(PRE_PHOTO_SLOTS.map((s) => [s.key, s.label])),
  post: Object.fromEntries(POST_PHOTO_SLOTS.map((s) => [s.key, s.label])),
};

// Fotos sincronizadas antes de que el servidor empezara a persistir slotKey
// no van a tener match acá — se muestran sin descripción en vez de romper.
function fotoLabel(fase: 'pre' | 'post', slotKey?: string): string | null {
  if (!slotKey) return null;
  return PHOTO_SLOT_LABELS[fase][slotKey] ?? null;
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
  const tipoServicioLabel = c.tipoServicio ? TIPO_SERVICIO_LABELS[c.tipoServicio] : null;

  return (
    <button type="button" onClick={onToggle} className="flex w-full items-start justify-between gap-3">
      <div>
        <div className="text-[15px] font-extrabold">{esInstalacion ? 'Resumen de instalación' : 'Resumen del servicio'}</div>
        {!esInstalacion && tipoServicioLabel && (
          <div className="mt-1 text-[11.5px] font-semibold text-muted">
            Tipo de servicio: <span className="font-extrabold text-text">{tipoServicioLabel}</span>
          </div>
        )}
      </div>
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
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxZoomed, setLightboxZoomed] = useState(false);

  useEffect(() => {
    if (!lightboxUrl) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxUrl(null);
        setLightboxZoomed(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxUrl]);

  // modelo/imei del equipo describen el que se retira cuando el servicio es
  // una desinstalación o un cambio de equipo (ver equipo.ts en @wara/shared).
  const equipoLabelSuffix =
    c.tipoServicio === 'desinstalacion' ? ' (desinstalado)' : c.tipoServicio === 'cambio_equipo' ? ' (retirado)' : '';

  const instaladosResumen = useMemo(() => {
    const equipo = c.equipo as Record<string, string | null | undefined>;
    const fields: { key: string; label: string; dependsOn?: string }[] = [];
    for (const group of EQUIP_GROUPS.slice(1)) {
      // skip "Datos del equipo" (modelo/imei se muestran aparte) y "Control
      // de instalación" (son campos de texto, no checkboxes)
      if (group.title === 'Control de instalación') continue;
      for (const f of group.fields) fields.push(f);
    }
    // Los campos de detalle (dependsOn, ej. el textfield de IO1) no son
    // checkboxes — su texto se anexa al badge del checkbox del que dependen
    // en vez de listarse aparte con la etiqueta genérica del campo.
    const detailByCheckboxKey = new Map(fields.filter((f) => f.dependsOn).map((f) => [f.dependsOn as string, f]));
    // Los checkbox de EQUIP_GROUPS guardan 'Sí' (truthy) / '' al desmarcar —
    // nunca 'SI' (mayúsculas, sin tilde), que es la convención de
    // EQUIP_CHECK_FIELDS nada más. Comparar contra 'SI' acá nunca matcheaba.
    return fields
      .filter((f) => !f.dependsOn && Boolean(equipo[f.key]))
      .map((f) => {
        const detail = detailByCheckboxKey.get(f.key);
        const detailValue = detail && equipo[detail.key]?.trim();
        return detailValue ? `${f.label}: ${detailValue}` : f.label;
      });
  }, [c]);

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
          <InfoField label={`Modelo${equipoLabelSuffix}`}>{c.equipo.modelo || '—'}</InfoField>
          <InfoField label={`IMEI${equipoLabelSuffix}`}>{c.equipo.imei || '—'}</InfoField>
          {c.tipoServicio === 'cambio_equipo' && (
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

        <div>
          <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">Control de instalación</div>
          <div className="flex flex-wrap gap-1.5">
            {EQUIP_CHECK_FIELDS.map((f) => {
              const value = c.equipo[f.key];
              const tone = value === 'SI' ? 'ok' : value === 'NO' ? 'bad' : 'neutral';
              const label = value === 'SI' ? 'Sí' : value === 'NO' ? 'No' : 'Sin responder';
              return (
                <Badge key={f.key} tone={tone}>
                  {f.label}: {label}
                </Badge>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <div className="text-[10.5px] font-extrabold uppercase tracking-wide text-muted">Todas las fotos (PRE + POST)</div>
            <div className="text-[11.5px] font-bold text-muted">{todasLasFotos.length}</div>
          </div>
          {todasLasFotos.length > 0 ? (
            <div className="grid grid-cols-4 gap-x-2.5 gap-y-3 sm:grid-cols-8">
              {todasLasFotos.map((foto) => {
                const label = fotoLabel(foto.fase === 'PRE' ? 'pre' : 'post', foto.slotKey);
                return (
                  <button
                    key={`${foto.fase}-${foto.id}`}
                    onClick={() => setLightboxUrl(foto.url)}
                    title={label ? `${foto.fase} · ${label}` : foto.fase}
                    className="flex flex-col gap-1 text-left"
                  >
                    <span className="relative block aspect-square overflow-hidden rounded-sm shadow-inset">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={foto.url} alt="" className="h-full w-full object-cover" />
                      <span className="absolute left-1 top-1 rounded-sm bg-black/60 px-1 py-0.5 text-[8.5px] font-extrabold text-white">
                        {foto.fase}
                      </span>
                    </span>
                    <span className="truncate text-[10px] font-semibold text-muted">{label ?? 'Foto'}</span>
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

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6"
          onClick={() => {
            setLightboxUrl(null);
            setLightboxZoomed(false);
          }}
        >
          <button
            onClick={() => {
              setLightboxUrl(null);
              setLightboxZoomed(false);
            }}
            className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
          >
            <IconX />
          </button>
          <div className={`max-h-full max-w-full ${lightboxZoomed ? 'overflow-auto' : 'overflow-hidden'}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxUrl}
              alt=""
              onClick={(e) => {
                e.stopPropagation();
                setLightboxZoomed((v) => !v);
              }}
              className={lightboxZoomed ? 'max-w-none cursor-zoom-out' : 'max-h-[85vh] max-w-[85vw] cursor-zoom-in object-contain'}
            />
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
