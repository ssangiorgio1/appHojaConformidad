'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CHECKLIST_ITEMS } from '@wara/shared/src/checklist';
import { EQUIP_CHECK_FIELDS, EQUIP_GROUPS } from '@wara/shared/src/equipo';
import { PRE_PHOTO_SLOTS, POST_PHOTO_SLOTS } from '@wara/shared/src/photoSlots';
import { SATISFACCION_LABELS, TIPO_SERVICIO_LABELS, type ChecklistValue, type SatisfaccionFirma } from '@wara/shared';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { IconCamera, IconChevronDown, IconChevronLeft, IconLock, IconDocument, IconX } from '@/components/ui/Icons';
import { AltaCheckToggle, canToggleAlta } from '@/components/AltaCheckToggle';
import { getConformidad, generateConformidadPdf, listUsuarios, setAltaConformidad } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { useApiData } from '@/lib/useApiData';
import { formatFechaHora, formatIsoDateTime } from '@/lib/format';
import type { EstadoConformidad, Phase } from '@/lib/types';

const ESTADO_LABEL: Record<EstadoConformidad, string> = {
  borrador_pre: 'Borrador PRE',
  pendiente_post: 'Pendiente POST',
  completo: 'Completo',
};

const ESTADO_TONE: Record<EstadoConformidad, BadgeTone> = {
  borrador_pre: 'neutral',
  pendiente_post: 'warn',
  completo: 'ok',
};

const SATISFACCION_TONE: Record<SatisfaccionFirma, BadgeTone> = {
  satisfecho: 'ok',
  insatisfecho: 'warn',
  no_firma_insatisfecho: 'bad',
};

function checklistTone(value: ChecklistValue): BadgeTone {
  if (value === 'SI') return 'ok';
  if (value === 'NO') return 'bad';
  return 'neutral';
}

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

function InfoField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] font-extrabold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 text-sm font-bold">{children}</div>
    </div>
  );
}

export default function ConformidadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getIdToken, usuario } = useAuth();
  const [fase, setFase] = useState<'pre' | 'post'>('pre');
  const { data: c, loading, error, refetch, setData } = useApiData((idToken) => getConformidad(idToken, id), [id]);
  const { data: usuariosData } = useApiData((idToken) => listUsuarios(idToken), []);
  const usuarioNombre = useMemo(() => {
    const map = new Map((usuariosData ?? []).map((u) => [u._id, u.nombre || u.email]));
    return (usuarioId: string) => map.get(usuarioId) ?? usuarioId.slice(-6);
  }, [usuariosData]);

  // Actualiza con la respuesta del servidor en vez de refetchear todo el
  // registro — evita que la página entera vuelva a mostrar "Cargando..."
  // (loading pisa el `c` ya cargado) solo por tildar un check.
  async function handleToggleAlta(area: 'mesaAyuda' | 'coordinacion', checked: boolean) {
    const idToken = await getIdToken();
    const updated = await setAltaConformidad(idToken, id, area, checked);
    setData(updated);
  }
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [resumenOpen, setResumenOpen] = useState(false);
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

  const phase: Phase | undefined = c?.[fase];
  const tipoServicioLabel = c?.tipoServicio ? TIPO_SERVICIO_LABELS[c.tipoServicio] : null;
  const esInstalacion = !c?.tipoServicio || c.tipoServicio === 'instalacion';
  // modelo/imei del equipo describen el que se retira cuando el servicio es
  // una desinstalación o un cambio de equipo (ver equipo.ts en @wara/shared).
  const equipoLabelSuffix =
    c?.tipoServicio === 'desinstalacion' ? ' (desinstalado)' : c?.tipoServicio === 'cambio_equipo' ? ' (retirado)' : '';

  async function handleGeneratePdf() {
    setGeneratingPdf(true);
    setPdfError(null);
    try {
      const idToken = await getIdToken();
      await generateConformidadPdf(idToken, id);
      await refetch();
    } catch (err) {
      setPdfError((err as Error).message || 'No se pudo generar el PDF.');
    } finally {
      setGeneratingPdf(false);
    }
  }

  const instaladosResumen = useMemo(() => {
    if (!c) return [];
    const equipo = c.equipo as Record<string, string | null | undefined>;
    const fields: { key: string; label: string }[] = [];
    for (const group of EQUIP_GROUPS.slice(1)) {
      // skip "Datos del equipo" (modelo/imei se muestran aparte) y "Control
      // de instalación" (son campos de texto, no checkboxes)
      if (group.title === 'Control de instalación') continue;
      for (const f of group.fields) fields.push(f);
    }
    // Los checkbox de EQUIP_GROUPS guardan 'Sí' (truthy) / '' al desmarcar —
    // nunca 'SI' (mayúsculas, sin tilde), que es la convención de
    // EQUIP_CHECK_FIELDS nada más. Comparar contra 'SI' acá nunca matcheaba.
    return fields.filter((f) => Boolean(equipo[f.key])).map((f) => f.label);
  }, [c]);

  const todasLasFotos = useMemo(() => {
    if (!c) return [];
    return [
      ...c.pre.fotos.map((foto) => ({ ...foto, fase: 'PRE' as const })),
      ...c.post.fotos.map((foto) => ({ ...foto, fase: 'POST' as const })),
    ];
  }, [c]);

  const checklistRows = useMemo(() => {
    if (!phase) return [];
    let inGroup6 = false;
    const rows: Array<{ kind: 'header'; label: string } | { kind: 'item'; key: string; label: string; value: ChecklistValue }> = [];
    for (const item of CHECKLIST_ITEMS) {
      const isGroup6 = item.key.startsWith('item6_');
      if (isGroup6 && !inGroup6) {
        rows.push({ kind: 'header', label: '6. Revisión de luces del tablero en general' });
        inGroup6 = true;
      } else if (!isGroup6) {
        inGroup6 = false;
      }
      rows.push({ kind: 'item', key: item.key, label: item.label, value: phase.checklist[item.key] });
    }
    return rows;
  }, [phase]);

  if (loading && !c) return <div className="p-6 text-sm font-semibold text-muted">Cargando...</div>;
  if (error || !c) return <div className="p-6 text-sm font-semibold text-bad">{error || 'No encontrado'}</div>;

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-5">
      <Link href="/conformidades" className="flex items-center gap-2 text-sm font-semibold text-muted hover:text-text">
        <IconChevronLeft />
        Conformidades
        <span>/</span>
        <span className="font-bold text-text">{c.codigoActa}</span>
      </Link>

      <Card className="flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="text-lg font-extrabold">{c.cliente || 'Sin nombre de cliente'}</div>
          <div className="flex items-center gap-2.5">
            <Badge tone={ESTADO_TONE[c.status]}>{ESTADO_LABEL[c.status]}</Badge>
            {c.pdfReporte?.url ? (
              <a
                href={c.pdfReporte.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-md bg-surface px-3 py-2 text-[12.5px] font-bold shadow-soft-sm"
              >
                <IconDocument />
                Ver PDF
              </a>
            ) : (
              <button
                onClick={handleGeneratePdf}
                disabled={generatingPdf}
                className="flex items-center gap-1.5 rounded-md bg-surface px-3 py-2 text-[12.5px] font-bold shadow-soft-sm disabled:opacity-60"
              >
                <IconDocument />
                {generatingPdf ? 'Generando...' : 'Generar PDF'}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-line pt-4">
          <InfoField label="Instalador">{c.instalador || '—'}</InfoField>
          <InfoField label="Fecha">{formatFechaHora(c.fecha, c.hora)}</InfoField>
          <InfoField label="Tipo de servicio">{tipoServicioLabel || '—'}</InfoField>
          <InfoField label="Unidad">{c.matricula || 'Sin matrícula'}</InfoField>
          <InfoField label="Ticket">
            {c.ticketOdoo?.numero ? (
              <a
                href={`${process.env.NEXT_PUBLIC_ODOO_BASE_URL}/odoo/all-tickets/${c.ticketOdoo.odooId ?? c.ticketOdoo.numero}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {c.ticketOdoo.numero}
              </a>
            ) : (
              <span className="text-muted">Sin ticket</span>
            )}
          </InfoField>
        </div>

        {pdfError && <div className="text-right text-[11.5px] font-semibold text-bad">{pdfError}</div>}
      </Card>

      <Card className="flex flex-col gap-3 p-6">
        <div>
          <div className="text-[15px] font-extrabold">Alta de equipo</div>
          <div className="mt-1 text-[11.5px] font-semibold text-muted">
            Marcá cuando ya cargaste este equipo en el sistema correspondiente (VisionBLO, etc.).
          </div>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-line pt-3.5">
          {(['mesaAyuda', 'coordinacion'] as const).map((area) => (
            <InfoField key={area} label={area === 'mesaAyuda' ? 'Mesa de ayuda' : 'Coordinación'}>
              <AltaCheckToggle
                area={area}
                value={c.altaEquipo[area]}
                canToggle={canToggleAlta(usuario?.role, area)}
                usuarioNombre={usuarioNombre}
                onToggle={(checked) => handleToggleAlta(area, checked)}
                showDetail
              />
            </InfoField>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <button
          onClick={() => setResumenOpen((v) => !v)}
          className="flex w-full items-start justify-between gap-3"
        >
          <div>
            <div className="text-[15px] font-extrabold">{esInstalacion ? 'Resumen de instalación' : 'Resumen del servicio'}</div>
            {!esInstalacion && tipoServicioLabel && (
              <div className="mt-1 text-[11.5px] font-semibold text-muted">
                Tipo de servicio: <span className="font-extrabold text-text">{tipoServicioLabel}</span>
              </div>
            )}
          </div>
          <IconChevronDown className={`mt-0.5 text-muted transition-transform ${resumenOpen ? 'rotate-180' : ''}`} />
        </button>

        <div
          aria-hidden={!resumenOpen}
          className={`mt-4 grid overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out ${resumenOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
        >
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
              <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">
                Control de instalación
              </div>
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
                <div className="text-[10.5px] font-extrabold uppercase tracking-wide text-muted">
                  Todas las fotos (PRE + POST)
                </div>
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
        </div>
      </Card>

      <div className="inline-flex w-fit gap-1 rounded-md bg-surface p-1.5 shadow-inset">
        {(['pre', 'post'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFase(f)}
            className={`rounded-md px-5 py-2.5 text-sm font-bold ${
              fase === f ? 'bg-surface text-primary shadow-soft-sm' : 'text-muted'
            }`}
          >
            {f === 'pre' ? 'PRE-instalación' : 'POST-instalación'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-5">
          <Card className="p-6">
            <div className="mb-1 text-[15px] font-extrabold">Checklist de instalación</div>
            <div className="mb-3.5 text-xs font-semibold text-muted">Fase {fase.toUpperCase()}</div>

            {checklistRows.map((row) =>
              row.kind === 'header' ? (
                <div key={row.label} className="pb-1.5 pt-3.5 text-[11.5px] font-extrabold uppercase tracking-wide text-muted">
                  {row.label}
                </div>
              ) : (
                <div
                  key={row.key}
                  className={`flex items-center justify-between gap-3.5 border-b border-line py-3 last:border-none ${
                    row.key.startsWith('item6_') ? 'pl-4' : ''
                  }`}
                >
                  <div className="text-[13px] font-semibold leading-relaxed">{row.label}</div>
                  <Badge tone={checklistTone(row.value)}>{row.value ?? '—'}</Badge>
                </div>
              ),
            )}

            <div className="mt-4">
              <div className="mb-2 text-xs font-extrabold text-muted">Observaciones</div>
              <div className="rounded-md bg-surface p-3.5 text-[12.5px] font-medium leading-relaxed shadow-inset">
                {phase?.observaciones || 'Sin observaciones.'}
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-3.5 flex items-center justify-between">
              <div className="text-sm font-extrabold">Fotos ({fase.toUpperCase()})</div>
              <div className="text-[11.5px] font-bold text-muted">{phase?.fotos.length ?? 0}</div>
            </div>
            {phase && phase.fotos.length > 0 ? (
              <div className="grid grid-cols-4 gap-x-2.5 gap-y-3 sm:grid-cols-6">
                {phase.fotos.map((foto) => {
                  const label = fotoLabel(fase, foto.slotKey);
                  return (
                    <button
                      key={foto.id}
                      onClick={() => setLightboxUrl(foto.url)}
                      title={label ?? undefined}
                      className="flex flex-col gap-1 text-left"
                    >
                      <span className="block aspect-square overflow-hidden rounded-sm shadow-inset">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={foto.url} alt="" className="h-full w-full object-cover" />
                      </span>
                      <span className="truncate text-[10px] font-semibold text-muted">{label ?? 'Foto'}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex aspect-[5/1] items-center justify-center rounded-sm text-muted shadow-inset">
                <IconCamera />
                <span className="ml-2 text-xs font-semibold">Sin fotos cargadas</span>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <div className="mb-3.5 flex items-center justify-between">
              <div className="text-sm font-extrabold">Firma digital ({fase.toUpperCase()})</div>
              {phase?.firma?.firmedAt && (
                <Badge tone="neutral">
                  <IconLock />
                  Firmada
                </Badge>
              )}
            </div>
            {phase?.firma?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={phase.firma.url} alt="Firma" className="h-[100px] w-full rounded-sm object-contain shadow-inset" />
            ) : (
              <div className="flex h-[100px] items-center justify-center rounded-sm text-xs font-semibold text-muted shadow-inset">
                Sin firmar todavía
              </div>
            )}
            {phase?.firma?.satisfaccion && (
              <div className="mt-3 flex justify-end">
                <Badge tone={SATISFACCION_TONE[phase.firma.satisfaccion]}>
                  {SATISFACCION_LABELS[phase.firma.satisfaccion]}
                </Badge>
              </div>
            )}
            {phase?.firma?.satisfaccion !== 'satisfecho' && phase?.firma?.motivo && (
              <div className="mt-2 text-right text-[12.5px] font-semibold text-muted">
                Motivo: {phase.firma.motivo}
              </div>
            )}
            {phase?.firma?.firmedAt && (
              <div className="mt-2 text-right text-[11.5px] font-semibold text-muted">
                {formatIsoDateTime(phase.firma.firmedAt)}
              </div>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card className="p-6">
            <div className="mb-3.5 text-sm font-extrabold">Equipo &amp; SIM</div>
            <div className="flex flex-col gap-2.5 text-[12.5px]">
              {EQUIP_GROUPS.map((group) => (
                <div key={group.title}>
                  <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">{group.title}</div>
                  {group.fields.map((f) => (
                    <div key={f.key} className="flex justify-between border-b border-line py-1.5 last:border-none">
                      <span className="font-semibold text-muted">{f.label}</span>
                      <span className="font-bold">{c.equipo[f.key] || '—'}</span>
                    </div>
                  ))}
                </div>
              ))}
              <div>
                <div className="mb-1 mt-1 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">Control de instalación</div>
                {EQUIP_CHECK_FIELDS.map((f) => {
                  const value = c.equipo[f.key];
                  const tone = value === 'SI' ? 'ok' : value === 'NO' ? 'bad' : 'neutral';
                  const label = value === 'SI' ? 'Sí' : value === 'NO' ? 'No' : 'Sin responder';
                  return (
                    <div key={f.key} className="flex justify-between border-b border-line py-1.5 last:border-none">
                      <span className="font-semibold text-muted">{f.label}</span>
                      <Badge tone={tone}>{label}</Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
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
              className={
                lightboxZoomed
                  ? 'max-w-none cursor-zoom-out'
                  : 'max-h-[85vh] max-w-[85vw] cursor-zoom-in object-contain'
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
