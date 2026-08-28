'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/auth/AuthContext';
import { updateMe, ApiError } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { IconDocument, IconGrid, IconLogout, IconUsers } from '@/components/ui/Icons';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: IconGrid },
  { href: '/conformidades', label: 'Conformidades', icon: IconDocument },
  { href: '/usuarios', label: 'Usuarios', icon: IconUsers, roles: ['admin', 'superadmin'] as const },
];

function roleLabel(role: string) {
  if (role === 'superadmin') return 'Superadmin';
  if (role === 'admin') return 'Admin';
  if (role === 'coordinacion') return 'Coordinación';
  if (role === 'mesa_ayuda') return 'Mesa de ayuda';
  return 'Técnico';
}

export function Sidebar() {
  const pathname = usePathname();
  const { usuario, signOut, getIdToken, refreshUsuario } = useAuth();
  const [editing, setEditing] = useState(false);
  const [nombre, setNombre] = useState(usuario?.nombre ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  function openEditor() {
    setNombre(usuario?.nombre ?? '');
    setError(null);
    setEditing(true);
  }

  useEffect(() => {
    if (!editing) return;
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setEditing(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [editing]);

  const items = NAV_ITEMS.filter((item) => !item.roles || (usuario && item.roles.includes(usuario.role as never)));
  const initials = (usuario?.nombre || usuario?.email || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  async function handleSave() {
    if (!nombre.trim()) {
      setError('Ingresá un nombre.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const token = await getIdToken();
      await updateMe(token, { nombre: nombre.trim() });
      await refreshUsuario();
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside className="sticky top-6 flex h-[calc(100vh-3rem)] w-[236px] flex-none flex-col gap-7 overflow-y-auto rounded-lg bg-surface p-4 shadow-soft">
      <div className="px-1.5">
        <Image src="/logo-wara.png" alt="WARA" width={150} height={42} priority />
      </div>

      <nav className="flex flex-col gap-1.5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-md px-4 py-3 text-sm font-semibold transition ${
                active ? 'bg-surface text-primary shadow-inset' : 'text-muted hover:text-text'
              }`}
            >
              <Icon />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="relative mt-auto flex flex-col gap-3.5" ref={wrapRef}>
        <div className="flex items-center gap-2.5 rounded-md bg-surface p-2.5 shadow-inset">
          <button
            type="button"
            onClick={editing ? () => setEditing(false) : openEditor}
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          >
            <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-gradient-to-br from-[#d8cfc9] to-[#efe9e5] text-[13px] font-extrabold text-primary">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-bold">{usuario?.nombre || usuario?.email}</div>
              <div className="text-[10.5px] font-semibold text-muted">{roleLabel(usuario?.role ?? 'tecnico')}</div>
            </div>
          </button>
          <button
            type="button"
            aria-label="Cerrar sesión"
            onClick={() => signOut()}
            className="flex-none text-muted transition hover:text-primary"
          >
            <IconLogout />
          </button>
        </div>

        {editing && (
          <div className="absolute bottom-full left-0 z-10 mb-2 w-full rounded-lg bg-surface p-3.5 shadow-soft">
            <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-muted">Nombre</div>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre completo" autoFocus />
            {error && <div className="mt-2 text-[11.5px] font-semibold text-bad">{error}</div>}
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" className="px-3 py-2 text-xs" onClick={() => setEditing(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button className="px-3 py-2 text-xs" onClick={handleSave} disabled={saving}>
                Guardar
              </Button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
