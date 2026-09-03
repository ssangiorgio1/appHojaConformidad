'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CHECKLIST_ITEMS } from '@wara/shared/src/checklist';
import { EQUIP_CHECK_FIELDS, EQUIP_GROUPS } from '@wara/shared/src/equipo';
import { SATISFACCION_LABELS, type ChecklistValue, type SatisfaccionFirma } from '@wara/shared';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { IconCamera, IconChevronDown, IconChevronLeft, IconLock, IconDocument, IconX } from '@/components/ui/Icons';
import { getConformidad, generateConformidadPdf } from '@/lib/api';
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

export default function ConformidadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getIdToken } = useAuth();
  const [fase, setFase] = useState<'pre' | 'post'>('pre');
  const { data: c, loading, error, refetch } = useApiData((idToken) => getConformidad(idToken, id), [id]);
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
      // skip "Datos del equipo" — modelo/imei shown separately
      for (const f of group.fields) fields.push(f);
    }
    return fields.filter((f) => equipo[f.key] === 'SI').map((f) => f.label);
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

  if (loading) return <div className="p-6 text-sm font-semibold text-muted">Cargando...</div>;
  if (error || !c) return <div className="p-6 text-sm font-semibold text-bad">{error || 'No encontrado'}</div>;

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-5">
      <Link href="/conformidades" className="flex items-center gap-2 text-sm font-semibold text-muted hover:text-text">
        <IconChevronLeft />
        Conformidades
        <span>/</span>
        <span className="font-bold text-text">{c.codigoActa}</span>
      </Link>

      <Card className="flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          
          <div className="text-lg font-extrabold">{c.cliente || 'Sin nombre de cliente'}</div>
          <div className="mt-1 text-[12.5px] font-semibold">
            Instalador: <Badge tone="primary">{c.instalador || '—'}</Badge>    ·   {formatFechaHora(c.fecha, c.hora)}
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          Ticket:
          <Badge tone={c.ticketOdoo?.numero ? 'primary' : 'neutral'}>{c.ticketOdoo?.numero || 'sin ticket'}</Badge>
          Unidad:
          <Badge tone="primary">{c.matricula || 'sin matrícula'}</Badge>
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
        {pdfError && <div className="w-full text-right text-[11.5px] font-semibold text-bad">{pdfError}</div>}
      </Card>

      <Card className="p-6">
        <button
          onClick={() => setResumenOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3"
        >
          <div className="text-[15px] font-extrabold">Resumen de instalación</div>
          <IconChevronDown className={`text-muted transition-transform ${resumenOpen ? 'rotate-180' : ''}`} />
        </button>

        {resumenOpen && (
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <div>
                <div className="text-[10.5px] font-extrabold uppercase tracking-wide text-muted">Modelo</div>
                <div className="text-sm font-bold">{c.equipo.modelo || '—'}</div>
              </div>
              <div>
                <div className="text-[10.5px] font-extrabold uppercase tracking-wide text-muted">IMEI</div>
                <div className="text-sm font-bold">{c.equipo.imei || '—'}</div>
              </div>
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
                <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-8">
                  {todasLasFotos.map((foto) => (
                    <button
                      key={`${foto.fase}-${foto.id}`}
                      onClick={() => setLightboxUrl(foto.url)}
                      className="relative aspect-square overflow-hidden rounded-sm shadow-inset"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={foto.url} alt="" className="h-full w-full object-cover" />
                      <span className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 text-center text-[9px] font-bold text-white">
                        {foto.fase}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex aspect-[8/1] items-center justify-center rounded-sm text-muted shadow-inset">
                  <IconCamera />
                  <span className="ml-2 text-xs font-semibold">Sin fotos cargadas</span>
                </div>
              )}
            </div>
          </div>
        )}
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
              <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6">
                {phase.fotos.map((foto) => (
                  <button
                    key={foto.id}
                    onClick={() => setLightboxUrl(foto.url)}
                    className="aspect-square overflow-hidden rounded-sm shadow-inset"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={foto.url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
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
