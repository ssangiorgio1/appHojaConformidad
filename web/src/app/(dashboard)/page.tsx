'use client';

import Link from 'next/link';
import { useAuth } from '@/auth/AuthContext';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { IconAlertTriangle, IconCheck, IconDocument } from '@/components/ui/Icons';
import { listConformidades } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
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

async function loadDashboard(idToken: string) {
  const [total, completadas, pendientes, borrador, recientes] = await Promise.all([
    listConformidades(idToken, { pageSize: 1 }),
    listConformidades(idToken, { pageSize: 1, status: 'completo' }),
    listConformidades(idToken, { pageSize: 1, status: 'pendiente_post' }),
    listConformidades(idToken, { pageSize: 1, status: 'borrador_pre' }),
    listConformidades(idToken, { pageSize: 6 }),
  ]);
  return {
    total: total.total,
    completadas: completadas.total,
    pendientes: pendientes.total,
    borrador: borrador.total,
    recientes: recientes.data,
  };
}

export default function DashboardPage() {
  const { usuario } = useAuth();
  const { data, loading, error } = useApiData(loadDashboard, []);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="text-2xl font-extrabold">Buen día, {usuario?.nombre?.split(' ')[0] || usuario?.email}</div>
        <div className="mt-0.5 text-sm font-semibold text-muted">Resumen general</div>
      </div>

      {error && <Card className="p-4 text-sm font-semibold text-bad">{error}</Card>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={<IconDocument size={21} />} tone="primary" value={data?.total} label="Conformidades totales" loading={loading} />
        <KpiCard icon={<IconCheck size={21} />} tone="ok" value={data?.completadas} label="Completadas" loading={loading} />
        <KpiCard icon={<IconAlertTriangle size={21} />} tone="warn" value={data?.pendientes} label="Pendientes de POST" loading={loading} />
        <KpiCard icon={<IconDocument size={21} />} tone="neutral" value={data?.borrador} label="Borrador PRE" loading={loading} />
      </div>

      <Card className="p-6">
        <div className="mb-4 text-[15px] font-extrabold">Últimas conformidades</div>
        {loading && <div className="text-sm font-semibold text-muted">Cargando...</div>}
        {!loading && data?.recientes.length === 0 && (
          <div className="text-sm font-semibold text-muted">Todavía no hay conformidades cargadas.</div>
        )}
        <div className="flex flex-col gap-2">
          {data?.recientes.map((c) => (
            <Link
              key={c._id}
              href={`/conformidades/${c._id}`}
              className="flex items-center justify-between gap-3 rounded-md bg-surface p-3.5 shadow-inset transition hover:opacity-90"
            >
              <div className="min-w-0">
                <div className="truncate text-[13px] font-bold">{c.cliente || 'Sin nombre de cliente'}</div>
                <div className="text-[11.5px] font-semibold text-muted">
                  {c.codigoActa} · {c.matricula || 'sin matrícula'}
                </div>
              </div>
              <Badge tone={ESTADO_TONE[c.status]}>{ESTADO_LABEL[c.status]}</Badge>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

function KpiCard({
  icon,
  tone,
  value,
  label,
  loading,
}: {
  icon: React.ReactNode;
  tone: 'primary' | 'ok' | 'warn' | 'neutral';
  value: number | undefined;
  label: string;
  loading: boolean;
}) {
  const toneClasses: Record<string, string> = {
    primary: 'bg-line text-primary',
    ok: 'bg-ok-bg text-ok',
    warn: 'bg-warn-bg text-warn',
    neutral: 'bg-line text-muted',
  };
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className={`flex h-10 w-10 items-center justify-center rounded-md ${toneClasses[tone]}`}>{icon}</div>
      <div>
        <div className="text-[27px] font-extrabold leading-none">{loading ? '—' : (value ?? 0)}</div>
        <div className="mt-1.5 text-[12.5px] font-semibold text-muted">{label}</div>
      </div>
    </Card>
  );
}
