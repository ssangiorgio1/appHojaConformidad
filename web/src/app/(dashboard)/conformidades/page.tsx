'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { IconEye, IconSearch } from '@/components/ui/Icons';
import { listConformidades, listUsuarios } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import { formatFechaHora } from '@/lib/format';
import type { EstadoConformidad } from '@/lib/types';

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

const PAGE_SIZE = 20;

export default function ConformidadesPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<EstadoConformidad | ''>('');
  const [tecnicoId, setTecnicoId] = useState('');
  const [page, setPage] = useState(1);

  // Wait for a pause in typing before hitting the API — avoids firing a
  // request on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: usuariosData } = useApiData((idToken) => listUsuarios(idToken), []);
  const tecnicos = useMemo(() => (usuariosData ?? []).filter((u) => u.role === 'tecnico'), [usuariosData]);
  const tecnicoNombre = useMemo(() => {
    const map = new Map((usuariosData ?? []).map((u) => [u._id, u.nombre || u.email]));
    return (id?: string) => (id && map.get(id)) || (id ? id.slice(-6) : '—');
  }, [usuariosData]);

  const { data, loading, error } = useApiData(
    (idToken) =>
      listConformidades(idToken, {
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: status || undefined,
        tecnicoId: tecnicoId || undefined,
      }),
    [page, debouncedSearch, status, tecnicoId],
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="text-2xl font-extrabold">Conformidades</div>
        <div className="mt-0.5 text-sm font-semibold text-muted">
          {data ? `${data.total} registros` : 'Cargando...'}
        </div>
      </div>

      <Card small className="flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-[220px] flex-1">
          <IconSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            className="pl-10"
            placeholder="Cliente, matrícula, IMEI o N° acta..."
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>

        <select
          className="rounded-md bg-surface px-4 py-3 text-sm font-semibold shadow-inset outline-none"
          value={tecnicoId}
          onChange={(e) => {
            setPage(1);
            setTecnicoId(e.target.value);
          }}
        >
          <option value="">Técnico: todos</option>
          {tecnicos.map((t) => (
            <option key={t._id} value={t._id}>
              {t.nombre || t.email}
            </option>
          ))}
        </select>

        <select
          className="rounded-md bg-surface px-4 py-3 text-sm font-semibold shadow-inset outline-none"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value as EstadoConformidad | '');
          }}
        >
          <option value="">Estado: todos</option>
          <option value="borrador_pre">Borrador PRE</option>
          <option value="pendiente_post">Pendiente POST</option>
          <option value="completo">Completo</option>
        </select>
      </Card>

      {error && <Card className="p-4 text-sm font-semibold text-bad">{error}</Card>}

      <Card className="p-2.5 pb-4">
        <div className="overflow-x-auto">
          <div className="min-w-[820px]">
            <div className="grid grid-cols-[1.3fr_1.6fr_1.2fr_1fr_1.1fr_1fr_60px] pb-2.5 pt-4">
              {['Código acta', 'Cliente', 'Técnico', 'Unidad', 'Fecha', 'Estado', ''].map((h) => (
                <div key={h} className="px-3.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">
                  {h}
                </div>
              ))}
            </div>

            {loading && !data && <div className="px-3 py-6 text-sm font-semibold text-muted">Cargando...</div>}
            {!loading && data?.data.length === 0 && (
              <div className="px-3 py-6 text-sm font-semibold text-muted">No se encontraron conformidades.</div>
            )}

            <div className={`transition-opacity ${loading && data ? 'opacity-60' : ''}`}>
              {data?.data.map((c) => (
                <div key={c._id} className="grid grid-cols-[1.3fr_1.6fr_1.2fr_1fr_1.1fr_1fr_60px] items-center border-t border-line">
                  <div className="p-3.5 text-[13px] font-bold text-primary">{c.codigoActa}</div>
                  <div className="p-3.5 text-[13px] font-semibold">{c.cliente || '—'}</div>
                  <div className="p-3.5 text-[13px] font-semibold text-muted">{tecnicoNombre(c.tecnicoId)}</div>
                  <div className="p-3.5 text-[13px] font-semibold">{c.matricula || '—'}</div>
                  <div className="p-3.5 text-[13px] font-semibold text-muted">{formatFechaHora(c.fecha)}</div>
                  <div className="p-3.5">
                    <Badge tone={ESTADO_TONE[c.status]}>{ESTADO_LABEL[c.status]}</Badge>
                  </div>
                  <div className="p-3.5">
                    <Link
                      href={`/conformidades/${c._id}`}
                      className="flex h-[34px] w-[34px] items-center justify-center rounded-md bg-surface shadow-soft-sm"
                    >
                      <IconEye />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-2.5 pt-4">
            <div className="text-[12.5px] font-semibold text-muted">
              Página {data.page} de {data.totalPages}
            </div>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-md px-3 py-1.5 text-xs font-bold text-muted shadow-inset disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md px-3 py-1.5 text-xs font-bold text-muted shadow-inset disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
