'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import {
  IconAlertTriangle,
  IconCalendar,
  IconChevronLeft,
  IconClock,
  IconDocument,
  IconGrid,
  IconMap,
  IconLogout,
  IconSparkle,
  IconUsers,
} from '@/components/ui/Icons';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: IconGrid },
  { href: '/conformidades', label: 'Conformidades', icon: IconDocument },
  { href: '/calendario', label: 'Calendario', icon: IconCalendar },
  { href: '/atilio', label: 'Atilio', icon: IconSparkle },
  {
    href: '/incidencias',
    label: 'Unidades no encontradas',
    icon: IconAlertTriangle,
    roles: ['coordinacion', 'mesa_ayuda', 'admin', 'superadmin'] as const,
  },
  {
    href: '/flota',
    label: 'Mapa de flota',
    icon: IconMap,
    roles: ['coordinacion', 'mesa_ayuda', 'admin', 'superadmin'] as const,
  },
  {
    href: '/reportes/tecnicos',
    label: 'Reportes',
    icon: IconClock,
    roles: ['coordinacion', 'admin', 'superadmin'] as const,
  },
  { href: '/usuarios', label: 'Usuarios', icon: IconUsers, roles: ['admin', 'superadmin'] as const },
];

const COLLAPSE_KEY = 'wara.sidebar.collapsed';

function roleLabel(role: string) {
  if (role === 'superadmin') return 'Superadmin';
  if (role === 'admin') return 'Admin';
  if (role === 'coordinacion') return 'Coordinación';
  if (role === 'mesa_ayuda') return 'Mesa de ayuda';
  return 'Técnico';
}

export function Sidebar() {
  const pathname = usePathname();
  const { usuario, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // localStorage no existe durante el render en el servidor; se sincroniza acá para evitar un mismatch de hidratación.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1');
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      return next;
    });
  }

  const items = NAV_ITEMS.filter((item) => !item.roles || (usuario && item.roles.includes(usuario.role as never)));
  const initials = (usuario?.nombre || usuario?.email || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <aside
      className={`sticky top-6 flex h-[calc(100vh-3rem)] flex-none flex-col gap-7 overflow-y-auto overflow-x-hidden rounded-lg bg-surface p-4 shadow-soft transition-[width] duration-200 ${
        collapsed ? 'w-[76px]' : 'w-[236px]'
      }`}
    >
      <div className={`flex items-center ${collapsed ? 'justify-center px-0' : 'justify-between px-1.5'}`}>
        {collapsed ? (
          <Image src="/logo-wara-icon.png" alt="WARA" width={32} height={32} priority />
        ) : (
          <Image src="/logo-wara.png" alt="WARA" width={150} height={42} priority />
        )}
      </div>

      <nav className="flex flex-col gap-1.5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-3 rounded-md border-l-[3px] py-3 text-sm font-semibold transition ${
                collapsed ? 'justify-center px-0' : 'px-3.5'
              } ${
                active ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-transparent text-muted hover:text-text'
              }`}
            >
              <Icon />
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
        title={collapsed ? 'Expandir menú' : 'Contraer menú'}
        className={`flex items-center gap-2 rounded-md py-2 text-xs font-semibold text-muted transition hover:text-text ${
          collapsed ? 'justify-center px-0' : 'px-3.5'
        }`}
      >
        <IconChevronLeft className={`transition-transform ${collapsed ? 'rotate-180' : ''}`} />
        {!collapsed && 'Contraer'}
      </button>

      <div
        className={`mt-auto flex items-center gap-2.5 rounded-md bg-surface p-2.5 shadow-inset ${
          collapsed ? 'flex-col' : ''
        }`}
      >
        <div className={`flex min-w-0 flex-1 items-center gap-2.5 ${collapsed ? 'flex-col' : ''}`}>
          <div
            title={!collapsed ? undefined : usuario?.nombre || usuario?.email}
            className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-primary-50 text-[13px] font-extrabold text-primary-700"
          >
            {initials}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-bold">{usuario?.nombre || usuario?.email}</div>
              <div className="text-[10.5px] font-semibold text-muted">{roleLabel(usuario?.role ?? 'tecnico')}</div>
            </div>
          )}
        </div>
        <button
          type="button"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          onClick={() => signOut()}
          className="flex-none text-muted transition hover:text-primary"
        >
          <IconLogout />
        </button>
      </div>
    </aside>
  );
}
