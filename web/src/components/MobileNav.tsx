'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { IconLogout, IconX } from '@/components/ui/Icons';
import { NAV_ITEMS, roleLabel } from '@/components/Sidebar';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';

// Navegación para pantallas < lg (el Sidebar se oculta ahí): barra superior con logo y barra inferior fija
// con los 4 destinos principales + "Más" (hoja desplegable con el resto y cerrar sesión).
const MAX_EN_BARRA = 4;

export function MobileNav() {
  const pathname = usePathname();
  const { usuario, signOut } = useAuth();
  const [masAbierto, setMasAbierto] = useState(false);
  useBodyScrollLock(masAbierto);

  useEffect(() => {
    // Al navegar se cierra la hoja.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMasAbierto(false);
  }, [pathname]);

  const items = NAV_ITEMS.filter((item) => !('roles' in item) || (usuario && (item.roles as readonly string[]).includes(usuario.role)));
  const enBarra = items.length > MAX_EN_BARRA + 1 ? items.slice(0, MAX_EN_BARRA) : items;
  const enMas = items.slice(enBarra.length);
  const activo = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const masActivo = enMas.some((i) => activo(i.href));

  return (
    <div className="lg:hidden">
      {/* Mismo header que la PWA: barra primary-dark con el logo centrado. */}
      <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-center bg-primary-dark px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))]">
        <Image src="/logo-wara.png" alt="WARA" width={140} height={36} className="h-9 w-auto" priority />
      </header>

      {masAbierto && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Más opciones">
          <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-black/40" onClick={() => setMasAbierto(false)} />
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 rounded-t-xl bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-soft">
            <div className="mb-2 flex items-center justify-between">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">{usuario?.nombre || usuario?.email}</div>
                <div className="text-[11px] font-semibold text-muted">{roleLabel(usuario?.role ?? 'tecnico')}</div>
              </div>
              <button type="button" aria-label="Cerrar" onClick={() => setMasAbierto(false)} className="p-2 text-muted">
                <IconX />
              </button>
            </div>
            {enMas.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-md px-3 py-3.5 text-sm font-semibold ${
                  activo(href) ? 'bg-primary-50 text-primary-700' : 'text-text'
                }`}
              >
                <Icon />
                {label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => signOut()}
              className="mt-1 flex items-center gap-3 rounded-md border-t border-line px-3 py-3.5 text-left text-sm font-semibold text-muted"
            >
              <IconLogout size={20} />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 flex bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_var(--color-line)]">
        {enBarra.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10.5px] font-semibold ${
              activo(href) ? 'text-primary-700' : 'text-muted'
            }`}
          >
            <Icon />
            <span className="max-w-full truncate">{label === 'Unidades no encontradas' ? 'Unidades' : label}</span>
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setMasAbierto(true)}
          className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10.5px] font-semibold ${
            masActivo || masAbierto ? 'text-primary-700' : 'text-muted'
          }`}
        >
          <span className="flex h-5 items-center text-lg leading-none">⋯</span>
          Más
        </button>
      </nav>
    </div>
  );
}
