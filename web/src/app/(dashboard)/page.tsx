'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { IconAlertTriangle, IconCheck, IconDocument } from '@/components/ui/Icons';
import { AltaCheckToggle, canToggleAlta } from '@/components/AltaCheckToggle';
import { listConformidades, listUsuarios, setAltaConformidad } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import type { ConformidadDoc, EstadoConformidad, UsuarioRole } from '@/lib/types';

// Mesa de ayuda y coordinación son las únicas que tienen algo que "dar de
// alta" — a un técnico igual nunca le llega a este dashboard (AuthContext lo
// bloquea antes), pero admin/superadmin sí lo ven porque gestionan ambas
// áreas.
const ALTA_ROLES: UsuarioRole[] = ['mesa_ayuda', 'coordinacion', 'admin', 'superadmin'];

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

// Solo tiene sentido pedir esto para los roles que efectivamente cargan el
// equipo en el sistema externo — completo y no pedido todavía es lo único
// "accionable" acá (un borrador o un pendiente_post ni siquiera tiene los
// datos finales del equipo confirmados). "dadas" trae las últimas altas
// marcadas (ordenadas por el server por altaEquipo.<area>.fecha, ver
// conformidades.controller.ts) para mostrar quién y cuándo.
async function loadAltaResumen(idToken: string) {
  const [pendientesMesaAyuda, pendientesCoordinacion, dadasMesaAyuda, dadasCoordinacion] = await Promise.all([
    listConformidades(idToken, { pageSize: 6, status: 'completo', altaMesaAyuda: 'pendiente' }),
    listConformidades(idToken, { pageSize: 6, status: 'completo', altaCoordinacion: 'pendiente' }),
    listConformidades(idToken, { pageSize: 6, altaMesaAyuda: 'hecho' }),
    listConformidades(idToken, { pageSize: 6, altaCoordinacion: 'hecho' }),
  ]);
  return { pendientesMesaAyuda, pendientesCoordinacion, dadasMesaAyuda, dadasCoordinacion };
}

export default function DashboardPage() {
  const { usuario, getIdToken } = useAuth();
  const { data, loading, error } = useApiData(loadDashboard, []);

  const canSeeAlta = Boolean(usuario && ALTA_ROLES.includes(usuario.role));
  const {
    data: altaData,
    loading: altaLoading,
    setData: setAltaData,
  } = useApiData((idToken) => (canSeeAlta ? loadAltaResumen(idToken) : Promise.resolve(null)), [canSeeAlta]);

  const { data: usuariosData } = useApiData((idToken) => (canSeeAlta ? listUsuarios(idToken) : Promise.resolve(null)), [canSeeAlta]);
  const usuarioNombre = useMemo(() => {
    const map = new Map((usuariosData ?? []).map((u) => [u._id, u.nombre || u.email]));
    return (usuarioId: string) => map.get(usuarioId) ?? usuarioId.slice(-6);
  }, [usuariosData]);

  // "pendientes" pierde el ítem tildado y "dadas" lo gana al frente — con la
  // respuesta del propio POST /alta (ya trae quién y cuándo), así que no hace
  // falta volver a pedirle nada al servidor.
  async function handleToggleAlta(id: string, area: 'mesaAyuda' | 'coordinacion', checked: boolean) {
    const idToken = await getIdToken();
    const updated = await setAltaConformidad(idToken, id, area, checked);
    const pendientesKey = area === 'mesaAyuda' ? 'pendientesMesaAyuda' : 'pendientesCoordinacion';
    const dadasKey = area === 'mesaAyuda' ? 'dadasMesaAyuda' : 'dadasCoordinacion';
    setAltaData((prev) => {
      if (!prev) return prev;
      const pendientesGrupo = prev[pendientesKey];
      const dadasGrupo = prev[dadasKey];
      return {
        ...prev,
        [pendientesKey]: {
          ...pendientesGrupo,
          data: pendientesGrupo.data.filter((c) => c._id !== id),
          total: Math.max(0, pendientesGrupo.total - 1),
        },
        [dadasKey]: {
          ...dadasGrupo,
          data: [updated, ...dadasGrupo.data.filter((c) => c._id !== id)].slice(0, 6),
          total: dadasGrupo.total + 1,
        },
      };
    });
  }

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

      {canSeeAlta && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <KpiCard
              icon={<IconAlertTriangle size={21} />}
              tone="warn"
              value={altaData?.pendientesMesaAyuda.total}
              label="Pendientes de alta · Mesa de ayuda"
              loading={altaLoading}
            />
            <KpiCard
              icon={<IconAlertTriangle size={21} />}
              tone="warn"
              value={altaData?.pendientesCoordinacion.total}
              label="Pendientes de alta · Coordinación"
              loading={altaLoading}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <PendientesAltaCard
              titulo="Pendientes de alta · Mesa de ayuda"
              area="mesaAyuda"
              items={altaData?.pendientesMesaAyuda.data}
              loading={altaLoading}
              canToggle={canToggleAlta(usuario?.role, 'mesaAyuda')}
              onToggle={handleToggleAlta}
            />
            <PendientesAltaCard
              titulo="Pendientes de alta · Coordinación"
              area="coordinacion"
              items={altaData?.pendientesCoordinacion.data}
              loading={altaLoading}
              canToggle={canToggleAlta(usuario?.role, 'coordinacion')}
              onToggle={handleToggleAlta}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <UltimasAltasCard
              titulo="Últimas altas · Mesa de ayuda"
              area="mesaAyuda"
              items={altaData?.dadasMesaAyuda.data}
              loading={altaLoading}
              usuarioNombre={usuarioNombre}
            />
            <UltimasAltasCard
              titulo="Últimas altas · Coordinación"
              area="coordinacion"
              items={altaData?.dadasCoordinacion.data}
              loading={altaLoading}
              usuarioNombre={usuarioNombre}
            />
          </div>
        </>
      )}

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

function PendientesAltaCard({
  titulo,
  area,
  items,
  loading,
  canToggle,
  onToggle,
}: {
  titulo: string;
  area: 'mesaAyuda' | 'coordinacion';
  items: ConformidadDoc[] | undefined;
  loading: boolean;
  canToggle: boolean;
  onToggle: (id: string, area: 'mesaAyuda' | 'coordinacion', checked: boolean) => Promise<void>;
}) {
  return (
    <Card className="p-6">
      <div className="mb-4 text-[15px] font-extrabold">{titulo}</div>
      {loading && <div className="text-sm font-semibold text-muted">Cargando...</div>}
      {!loading && items?.length === 0 && (
        <div className="text-sm font-semibold text-muted">No hay conformidades pendientes de alta. 🎉</div>
      )}
      <div className="flex flex-col gap-2">
        {items?.map((c) => (
          <div key={c._id} className="flex items-center justify-between gap-3 rounded-md bg-surface p-3.5 shadow-inset">
            <Link href={`/conformidades/${c._id}`} className="min-w-0 flex-1 transition hover:opacity-90">
              <div className="truncate text-[13px] font-bold">{c.cliente || 'Sin nombre de cliente'}</div>
              <div className="text-[11.5px] font-semibold text-muted">
                {c.codigoActa} · {c.matricula || 'sin matrícula'}
              </div>
            </Link>
            <AltaCheckToggle
              area={area}
              value={c.altaEquipo[area]}
              canToggle={canToggle}
              onToggle={(checked) => onToggle(c._id, area, checked)}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}

// Feed de solo lectura (canToggle siempre false) — el objetivo acá es
// auditoría: quién dio cada alta y cuándo, no volver a accionar sobre ella.
function UltimasAltasCard({
  titulo,
  area,
  items,
  loading,
  usuarioNombre,
}: {
  titulo: string;
  area: 'mesaAyuda' | 'coordinacion';
  items: ConformidadDoc[] | undefined;
  loading: boolean;
  usuarioNombre: (usuarioId: string) => string;
}) {
  return (
    <Card className="p-6">
      <div className="mb-4 text-[15px] font-extrabold">{titulo}</div>
      {loading && <div className="text-sm font-semibold text-muted">Cargando...</div>}
      {!loading && items?.length === 0 && <div className="text-sm font-semibold text-muted">Todavía no se dio ninguna alta.</div>}
      <div className="flex flex-col gap-2">
        {items?.map((c) => (
          <div key={c._id} className="flex items-center justify-between gap-3 rounded-md bg-surface p-3.5 shadow-inset">
            <Link href={`/conformidades/${c._id}`} className="min-w-0 flex-1 transition hover:opacity-90">
              <div className="truncate text-[13px] font-bold">{c.cliente || 'Sin nombre de cliente'}</div>
              <div className="text-[11.5px] font-semibold text-muted">
                {c.codigoActa} · {c.matricula || 'sin matrícula'}
              </div>
            </Link>
            <AltaCheckToggle area={area} value={c.altaEquipo[area]} canToggle={false} usuarioNombre={usuarioNombre} onToggle={async () => {}} showDetail />
          </div>
        ))}
      </div>
    </Card>
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
