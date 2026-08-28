'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CHECKLIST_ITEMS } from '@wara/shared/src/checklist';
import { EQUIP_CHECK_FIELDS, EQUIP_GROUPS } from '@wara/shared/src/equipo';
import { SATISFACCION_LABELS, type ChecklistValue, type SatisfaccionFirma } from '@wara/shared';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { IconCamera, IconChevronLeft, IconLock } from '@/components/ui/Icons';
import { getConformidad } from '@/lib/api';
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
  const [fase, setFase] = useState<'pre' | 'post'>('pre');
  const { data: c, loading, error } = useApiData((idToken) => getConformidad(idToken, id), [id]);

  const phase: Phase | undefined = c?.[fase];

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
            Instalador: <Badge tone="primary">{c.instalador || '—'}</Badge> · {formatFechaHora(c.fecha, c.hora)}
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          Unidad:
          <Badge tone="primary">{c.matricula || 'sin matrícula'}</Badge>
          <Badge tone={ESTADO_TONE[c.status]}>{ESTADO_LABEL[c.status]}</Badge>
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

          <Card className="p-6">
            <div className="mb-3.5 flex items-center justify-between">
              <div className="text-sm font-extrabold">Fotos ({fase.toUpperCase()})</div>
              <div className="text-[11.5px] font-bold text-muted">{phase?.fotos.length ?? 0}</div>
            </div>
            {phase && phase.fotos.length > 0 ? (
              <div className="grid grid-cols-4 gap-2.5">
                {phase.fotos.map((f) => (
                  <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-sm shadow-inset">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.url} alt="" className="h-full w-full object-cover" />
                  </a>
                ))}
              </div>
            ) : (
              <div className="flex aspect-[3/1] items-center justify-center rounded-sm text-muted shadow-inset">
                <IconCamera />
                <span className="ml-2 text-xs font-semibold">Sin fotos cargadas</span>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <div className="mb-3.5 flex items-center justify-between">
              <div className="text-sm font-extrabold">Firma digital</div>
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
            {phase?.firma?.firmedAt && (
              <div className="mt-2 text-right text-[11.5px] font-semibold text-muted">
                {formatIsoDateTime(phase.firma.firmedAt)}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
