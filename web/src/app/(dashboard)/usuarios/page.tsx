'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { AddUsuarioPanel } from '@/components/AddUsuarioPanel';
import { EditUsuarioPanel } from '@/components/EditUsuarioPanel';
import { IconEdit, IconPlus, IconSearch } from '@/components/ui/Icons';
import { listUsuarios, updateUsuario } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import { useAuth } from '@/auth/AuthContext';
import type { Usuario, UsuarioRole } from '@/lib/types';

const ROLE_LABEL: Record<UsuarioRole, string> = {
  tecnico: 'Técnico',
  coordinacion: 'Coordinación',
  mesa_ayuda: 'Mesa de ayuda',
  admin: 'Admin',
  superadmin: 'Superadmin',
};

function initials(u: Usuario) {
  return (u.nombre || u.email)
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function UsuariosPage() {
  const { getIdToken, usuario: currentUser } = useAuth();
  const { data, loading, error, refetch } = useApiData(listUsuarios, []);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null);
  const [search, setSearch] = useState('');

  async function patch(id: string, body: { role?: UsuarioRole; activo?: boolean }) {
    setPendingId(id);
    try {
      const token = await getIdToken();
      await updateUsuario(token, id, body);
      await refetch();
    } finally {
      setPendingId(null);
    }
  }

  const counts = (data ?? []).reduce(
    (acc, u) => {
      acc[u.role] += 1;
      return acc;
    },
    { tecnico: 0, coordinacion: 0, mesa_ayuda: 0, admin: 0, superadmin: 0 } as Record<UsuarioRole, number>,
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data ?? [];
    return (data ?? []).filter(
      (u) => u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || ROLE_LABEL[u.role].toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-extrabold">Usuarios</div>
          <div className="mt-0.5 text-sm font-semibold text-muted">
            {data
              ? `${data.length} cuentas · ${counts.tecnico} técnicos, ${counts.coordinacion} coordinación, ${counts.mesa_ayuda} mesa de ayuda, ${counts.admin} admins, ${counts.superadmin} superadmin`
              : 'Cargando...'}
          </div>
        </div>
        <Button onClick={() => setPanelOpen(true)}>
          <IconPlus />
          Nuevo Usuario
        </Button>
      </div>

      {error && <Card className="p-4 text-sm font-semibold text-bad">{error}</Card>}

      <Card small className="p-4">
        <div className="relative max-w-[360px]">
          <IconSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <Input className="pl-10" placeholder="Buscar por nombre, email o rol..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </Card>

      <Card className="p-2.5 pb-4">
        <div className="overflow-x-auto">
          <div className="min-w-[560px]">
            <div className="grid grid-cols-[1.8fr_1fr_1fr_60px] pb-2.5 pt-4">
              {['Usuario', 'Rol', 'Estado', ''].map((h) => (
                <div key={h} className="px-3.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">
                  {h}
                </div>
              ))}
            </div>

            {loading && !data && <div className="px-3 py-6 text-sm font-semibold text-muted">Cargando...</div>}

            {data && !filtered.length && (
              <div className="px-3 py-6 text-sm font-semibold text-muted">No se encontraron usuarios.</div>
            )}

            <div className={`transition-opacity ${loading && data ? 'opacity-60' : ''}`}>
              {filtered.map((u) => (
                <div key={u._id} className="grid grid-cols-[1.8fr_1fr_1fr_60px] items-center border-t border-line">
                  <div className="flex items-center gap-3 p-3.5">
                    <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary-50 text-xs font-extrabold text-primary-700">
                      {initials(u)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-bold">{u.nombre || '(sin nombre)'}</div>
                      <div className="text-[11.5px] font-semibold text-muted">{u.email}</div>
                    </div>
                  </div>
                  <div className="p-3.5">
                    <select
                      className="rounded-md bg-surface px-2.5 py-1.5 text-xs font-bold shadow-inset outline-none disabled:opacity-40"
                      value={u.role}
                      disabled={
                        pendingId === u._id ||
                        u._id === currentUser?._id ||
                        u.protegido ||
                        (u.role === 'superadmin' && currentUser?.role !== 'superadmin')
                      }
                      title={u.protegido ? 'Esta cuenta es intocable: su rol no se puede cambiar.' : undefined}
                      onChange={(e) => patch(u._id, { role: e.target.value as UsuarioRole })}
                    >
                      <option value="tecnico">{ROLE_LABEL.tecnico}</option>
                      <option value="coordinacion">{ROLE_LABEL.coordinacion}</option>
                      <option value="mesa_ayuda">{ROLE_LABEL.mesa_ayuda}</option>
                      <option value="admin">{ROLE_LABEL.admin}</option>
                      <option value="superadmin">{ROLE_LABEL.superadmin}</option>
                    </select>
                  </div>
                  <div className="p-3.5">
                    <ToggleSwitch
                      checked={u.activo}
                      disabled={pendingId === u._id || u._id === currentUser?._id || u.role === 'superadmin'}
                      title={u.role === 'superadmin' ? 'Las cuentas superadmin no se pueden desactivar.' : undefined}
                      onChange={(next) => patch(u._id, { activo: next })}
                    />
                  </div>
                  <div className="p-3.5">
                    <button
                      type="button"
                      onClick={() => setEditingUsuario(u)}
                      aria-label="Editar usuario"
                      className="flex h-[34px] w-[34px] items-center justify-center rounded-md bg-surface shadow-soft-sm"
                    >
                      <IconEdit />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {panelOpen && (
        <AddUsuarioPanel
          onClose={() => setPanelOpen(false)}
          onCreated={() => {
            setPanelOpen(false);
            refetch();
          }}
        />
      )}

      {editingUsuario && (
        <EditUsuarioPanel
          usuario={editingUsuario}
          onClose={() => setEditingUsuario(null)}
          onUpdated={() => {
            setEditingUsuario(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
