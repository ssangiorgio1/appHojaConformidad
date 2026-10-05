'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CHECKLIST_ITEMS, DETAIL_FIELD_BY_KEY } from '@wara/shared/src/checklist';
import { EQUIP_CHECK_FIELDS, EQUIP_GROUPS, EQUIP_ITEM_PHOTO_LABEL } from '@wara/shared/src/equipo';
import { prePhotoSlotsFor, postPhotoSlotsFor, INTERVENCION_GROUP_KEY, EXTRA_POST_PHOTOS_KEY } from '@wara/shared/src/photoSlots';
import type { ServiceMode } from '@wara/shared/src/serviceMode';
import { SATISFACCION_LABELS, TIPO_SERVICIO_LABELS, type ChecklistValue, type SatisfaccionFirma } from '@wara/shared';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { IconCamera, IconChevronLeft, IconLock, IconDocument, IconX } from '@/components/ui/Icons';
import { AltaCheckToggle, canToggleAlta } from '@/components/AltaCheckToggle';
import { ConformidadResumen, InfoField, isEquipoFieldVisible } from '@/components/ConformidadResumen';
import {
  getConformidad,
  generateConformidadPdf,
  linkCambioEquipoPareja,
  listUsuarios,
  searchCambioEquipoPendientes,
  setAltaConformidad,
} from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { useApiData } from '@/lib/useApiData';
import { formatFechaHora, formatIsoDateTime } from '@/lib/format';
import type { ConformidadDoc, EstadoConformidad, Phase, RetiroPendiente } from '@/lib/types';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';

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

// Combina los slots de los 3 modos — para mostrar el label de una foto ya
// subida no hace falta saber el modo del registro puntual, alcanza con que
// la clave exista en algún modo (distintos modos reusan algunas claves, ej.
// "torpedo"/"odometro", por eso el orden no importa).
const ALL_MODES: ServiceMode[] = ['instalacion', 'retiro', 'reparacion'];
const PHOTO_SLOT_LABELS: Record<'pre' | 'post', Record<string, string>> = {
  pre: Object.fromEntries(ALL_MODES.flatMap((m) => prePhotoSlotsFor(m)).map((s) => [s.key, s.label])),
  post: Object.fromEntries(ALL_MODES.flatMap((m) => postPhotoSlotsFor(m)).map((s) => [s.key, s.label])),
};

// Fotos de galería libre (no 1 foto = 1 slot fijo) — mismo criterio que
// GALLERY_LABELS en printHtml.ts: cada ítem tildado de "Módulos y sensores"
// tiene su propia galería usando la key del campo de Equipo como slotKey, así
// que acá se muestra el nombre de lo que se marcó (ej. "Sensor de
// temperatura") en vez de un genérico "Foto".
const GALLERY_LABELS: Record<string, string> = {
  ...EQUIP_ITEM_PHOTO_LABEL,
  [INTERVENCION_GROUP_KEY]: 'Intervención realizada',
  [EXTRA_POST_PHOTOS_KEY]: 'Otras fotos',
};

// Fotos sincronizadas antes de que el servidor empezara a persistir slotKey
// no van a tener match acá — se muestran sin descripción en vez de romper.
function fotoLabel(fase: 'pre' | 'post', slotKey?: string): string | null {
  if (!slotKey) return null;
  return PHOTO_SLOT_LABELS[fase][slotKey] ?? GALLERY_LABELS[slotKey] ?? null;
}

export default function ConformidadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getIdToken, usuario } = useAuth();
  const [fase, setFase] = useState<'pre' | 'post'>('pre');
  const { data: c, loading, error, setData } = useApiData((idToken) => getConformidad(idToken, id), [id]);
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

  const phase: Phase | undefined = c?.[fase];
  const tipoServicioLabel = c?.tipoServicio ? TIPO_SERVICIO_LABELS[c.tipoServicio] : null;

  // El PDF se genera bajo demanda en el servidor y nunca se persiste (ver
  // api/src/controllers/conformidades.controller.ts) — no hay URL que
  // guardar, así que acá solo lo abrimos en una pestaña nueva, igual que en
  // la PWA (src/app/(app)/ver/[id]/page.tsx).
  async function handleGeneratePdf() {
    setGeneratingPdf(true);
    setPdfError(null);
    try {
      const idToken = await getIdToken();
      const blob = await generateConformidadPdf(idToken, id);
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (err) {
      setPdfError((err as Error).message || 'No se pudo generar el PDF.');
    } finally {
      setGeneratingPdf(false);
    }
  }

  const checklistRows = useMemo(() => {
    if (!phase) return [];
    let inGroup6 = false;
    const rows: Array<
      { kind: 'header'; label: string } | { kind: 'item'; key: string; label: string; value: ChecklistValue; detalle?: string }
    > = [];
    for (const item of CHECKLIST_ITEMS) {
      const isGroup6 = item.key.startsWith('item6_');
      if (isGroup6 && !inGroup6) {
        rows.push({ kind: 'header', label: '6. Revisión de luces del tablero en general' });
        inGroup6 = true;
      } else if (!isGroup6) {
        inGroup6 = false;
      }
      const detailField = DETAIL_FIELD_BY_KEY[item.key];
      const detalle = detailField ? phase[detailField] : undefined;
      rows.push({ kind: 'item', key: item.key, label: item.label, value: phase.checklist[item.key], detalle });
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
            <button
              onClick={handleGeneratePdf}
              disabled={generatingPdf}
              className="flex items-center gap-1.5 rounded-md bg-surface px-3 py-2 text-[12.5px] font-bold shadow-soft-sm disabled:opacity-60"
            >
              <IconDocument />
              {generatingPdf ? 'Generando...' : 'Ver PDF'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-line pt-4">
          <InfoField label="Técnico">{c.instalador || '—'}</InfoField>
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

      {c.cambioEquipo?.rol && <CambioEquipoCard c={c} onLinked={setData} />}

      <Card className="p-6">
        <ConformidadResumen c={c} open={resumenOpen} onToggle={() => setResumenOpen((v) => !v)} />
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
                  className={`flex flex-col gap-1.5 border-b border-line py-3 last:border-none ${
                    row.key.startsWith('item6_') ? 'pl-4' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-3.5">
                    <div className="text-[13px] font-semibold leading-relaxed">{row.label}</div>
                    <Badge tone={checklistTone(row.value)}>{row.value ?? '—'}</Badge>
                  </div>
                  {row.detalle && (
                    <div className="rounded-md bg-surface p-2.5 text-[12px] font-medium leading-relaxed text-muted shadow-inset">
                      {row.detalle}
                    </div>
                  )}
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
                  // Situación extrema (ver GalleryPhotoCapture en la PWA): el
                  // técnico no pudo sacar esta foto y dejó el motivo en vez
                  // de la imagen — no hay nada que abrir en el lightbox.
                  if (foto.motivo) {
                    return (
                      <div key={foto.id} title={label ?? undefined} className="flex flex-col gap-1 text-left">
                        <span className="flex aspect-square items-center justify-center overflow-hidden rounded-sm bg-bad-bg p-1.5 text-center shadow-inset">
                          <span className="line-clamp-4 text-[9px] font-semibold text-bad">{foto.motivo}</span>
                        </span>
                        <span className="truncate text-[10px] font-semibold text-muted">{label ?? 'Foto'} (sin foto)</span>
                      </div>
                    );
                  }
                  const isVideo = foto.mimeType === 'video/webm';
                  return (
                    <button
                      key={foto.id}
                      onClick={() => foto.url && setLightbox({ url: foto.url, isVideo })}
                      title={label ?? undefined}
                      className="flex flex-col gap-1 text-left"
                    >
                      <span className="block aspect-square overflow-hidden rounded-sm shadow-inset">
                        {isVideo ? (
                          <video src={foto.url} muted loop autoPlay playsInline className="h-full w-full object-cover" />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={foto.url} alt="" className="h-full w-full object-cover" />
                        )}
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
              {/* firmedAt solo no alcanza: también se setea cuando el cliente
                  no firma por disconformidad (ver SATISFACCION_TONE abajo) o
                  está ausente — la píldora tiene que mirar si hay firma real
                  (url), igual que el criterio de "Sin firmar todavía" de abajo. */}
              {phase?.firma?.url ? (
                <Badge tone="neutral">
                  <IconLock />
                  Firmada
                </Badge>
              ) : (
                <Badge tone="bad">
                  <IconLock />
                  No firmado
                </Badge>
              )}
            </div>
            {phase?.firma?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={phase.firma.url} alt="Firma" className="h-[100px] w-full rounded-sm object-contain shadow-inset" />
            ) : (
              <div className="flex h-[100px] items-center justify-center rounded-sm text-xs font-semibold text-muted shadow-inset">
                {phase?.firma?.clienteAusente ? 'Cliente ausente' : 'Sin firmar todavía'}
              </div>
            )}
            {phase?.firma?.clienteAusente && (
              <div className="mt-3 flex justify-end">
                <Badge tone="bad">Cliente ausente</Badge>
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
                  {group.fields
                    .filter((f) => isEquipoFieldVisible(f, c.equipo))
                    .map((f) => (
                      <div key={f.key} className="flex justify-between border-b border-line py-1.5 last:border-none">
                        <span className="font-semibold text-muted">{f.label}</span>
                        <span className="font-bold">{c.equipo[f.key] || '—'}</span>
                      </div>
                    ))}
                </div>
              ))}
              {(c.equipo.elementosRetirados ?? '').split(',').filter(Boolean).length > 0 && (
                <div>
                  <div className="mb-1 mt-1 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">
                    Sensores / módulos retirados
                  </div>
                  {(c.equipo.elementosRetirados ?? '')
                    .split(',')
                    .filter(Boolean)
                    .map((k) => (
                      <div key={k} className="flex justify-between border-b border-line py-1.5 last:border-none">
                        <span className="font-semibold text-muted">{EQUIP_ITEM_PHOTO_LABEL[k] ?? k}</span>
                        <span className="font-bold">Retirado</span>
                      </div>
                    ))}
                </div>
              )}
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
                className={
                  lightboxZoomed
                    ? 'max-w-none cursor-zoom-out'
                    : 'max-h-[85vh] max-w-[85vw] cursor-zoom-in object-contain'
                }
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Ventana de 48hs desde que se firmó el POST del retiro — no se guarda un
// deadline en la base (se calcula acá para no desincronizarse si la hoja se
// reabre/edita, ver plan de cambio de equipo). Solo informativo por ahora.
function fmtDeadline48h(firmedAt: string): string {
  const deadline = new Date(new Date(firmedAt).getTime() + 48 * 60 * 60 * 1000);
  return deadline.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Card de vinculación de cambio de equipo — cubre 2 casos: la pareja ya está
// vinculada (se pide y muestra con un link a su detalle) o no (se ofrece
// buscarla y vincularla a mano, para el caso en que no se pudo hacer desde
// la PWA en el momento — ver plan de cambio de equipo).
function CambioEquipoCard({ c, onLinked }: { c: ConformidadDoc; onLinked: (updated: ConformidadDoc) => void }) {
  const { getIdToken } = useAuth();
  const rol = c.cambioEquipo!.rol;
  const parejaId = c.cambioEquipo!.parejaId;
  const parejaRol = rol === 'retiro' ? 'instalacion' : 'retiro';

  const [pareja, setPareja] = useState<ConformidadDoc | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  useBodyScrollLock(modalOpen);
  const [query, setQuery] = useState(c.matricula);
  const [results, setResults] = useState<RetiroPendiente[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!parejaId) return;
    let cancelled = false;
    getIdToken()
      .then((idToken) => getConformidad(idToken, parejaId))
      .then((doc) => {
        if (!cancelled) setPareja(doc);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parejaId]);

  async function runSearch() {
    if (!query.trim() || searching) return;
    setSearching(true);
    setError(null);
    try {
      const idToken = await getIdToken();
      const { data } = await searchCambioEquipoPendientes(idToken, query.trim(), parejaRol);
      setResults(data);
      if (!data.length) setError('Sin resultados para esa patente.');
    } catch {
      setError('No se pudo buscar.');
    } finally {
      setSearching(false);
    }
  }

  async function pick(candidato: RetiroPendiente) {
    setLinking(true);
    setError(null);
    try {
      const idToken = await getIdToken();
      const updated = await linkCambioEquipoPareja(idToken, c._id, candidato._id);
      onLinked(updated);
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo vincular.');
    } finally {
      setLinking(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-6">
      <div className="text-[15px] font-extrabold">
        Cambio de equipo — {rol === 'retiro' ? 'Retiro del equipo viejo' : 'Instalación del equipo nuevo'}
      </div>

      {rol === 'retiro' && c.status === 'completo' && c.post.firma?.firmedAt && (
        <div className="text-[12.5px] font-semibold text-muted">
          Plazo para instalar el equipo nuevo: {fmtDeadline48h(c.post.firma.firmedAt)}
        </div>
      )}

      {parejaId ? (
        <div className="text-[13px]">
          Vinculada a{' '}
          <Link href={`/conformidades/${parejaId}`} className="font-bold text-primary hover:underline">
            hoja #{pareja ? pareja.numero || pareja.codigoActa : parejaId}
          </Link>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="text-[13px] text-muted">
            Pendiente de vincular con la {parejaRol === 'retiro' ? 'hoja de retiro' : 'hoja de instalación'}.
          </div>
          <button
            onClick={() => {
              setQuery(c.matricula);
              setResults([]);
              setError(null);
              setModalOpen(true);
            }}
            className="shrink-0 rounded-md bg-surface px-3 py-2 text-[12.5px] font-bold shadow-soft-sm"
          >
            Vincular manualmente
          </button>
        </div>
      )}

      {modalOpen && (
        <div className="animate-sheet-fade fixed inset-0 z-50 flex items-end justify-center bg-black/45 lg:items-center lg:p-6" onClick={() => setModalOpen(false)}>
          <div className="w-full max-w-[440px] animate-sheet-up lg:animate-none" onClick={(e) => e.stopPropagation()}>
            <Card className="max-h-[85dvh] overflow-y-auto overscroll-contain rounded-b-none p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] lg:max-h-[80vh] lg:rounded-b-lg lg:pb-5">
              <div className="mb-2.5 text-base font-bold">
                Buscar {parejaRol === 'retiro' ? 'hoja de retiro' : 'hoja de instalación'}
              </div>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                placeholder="Patente del vehículo"
                className="w-full rounded-md bg-bg px-3 py-3 text-sm outline-none"
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={runSearch}
                  disabled={searching}
                  className="rounded-md bg-primary px-3.5 py-2 text-[12.5px] font-bold text-white disabled:opacity-60"
                >
                  {searching ? 'Buscando…' : 'Buscar'}
                </button>
                <button onClick={() => setModalOpen(false)} className="rounded-md bg-surface px-3.5 py-2 text-[12.5px] font-bold">
                  Cerrar
                </button>
              </div>
              {error && <div className="mt-2 text-xs font-semibold text-bad">{error}</div>}
              <div className="mt-2.5 max-h-[280px] overflow-y-auto">
                {results.map((r) => (
                  <button
                    key={r._id}
                    type="button"
                    disabled={linking}
                    onClick={() => pick(r)}
                    className="block w-full border-b border-line py-2.5 text-left disabled:opacity-60"
                  >
                    <div className="text-sm font-bold">#{r.numero || r.codigoActa}</div>
                    <div className="mt-0.5 text-xs text-muted">
                      {r.cliente || 'Sin cliente'} · {r.matricula} · {r.fecha}
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </Card>
  );
}
