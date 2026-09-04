'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/auth/AuthContext';
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
  const { usuario, signOut } = useAuth();

  const items = NAV_ITEMS.filter((item) => !item.roles || (usuario && item.roles.includes(usuario.role as never)));
  const initials = (usuario?.nombre || usuario?.email || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

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

      <div className="mt-auto flex items-center gap-2.5 rounded-md bg-surface p-2.5 shadow-inset">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-gradient-to-br from-[#d8cfc9] to-[#efe9e5] text-[13px] font-extrabold text-primary">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] font-bold">{usuario?.nombre || usuario?.email}</div>
            <div className="text-[10.5px] font-semibold text-muted">{roleLabel(usuario?.role ?? 'tecnico')}</div>
          </div>
        </div>
        <button
          type="button"
          aria-label="Cerrar sesión"
          onClick={() => signOut()}
          className="flex-none text-muted transition hover:text-primary"
        >
          <IconLogout />
        </button>
      </div>
    </aside>
  );
}
