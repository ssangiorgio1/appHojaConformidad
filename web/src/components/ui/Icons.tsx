// Íconos SVG inline (grilla de 24px), normalizados a la escala de íconos de
// design.md (16/20/24px, stroke 1.5). Componentes chicos en vez de una
// librería de íconos aparte.

type IconProps = { className?: string; size?: number };

const base = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 1.5 } as const;

export function IconGrid({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke="currentColor" className={className} {...base}>
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2" />
      <rect x="13" y="3.5" width="7.5" height="7.5" rx="2" />
      <rect x="3.5" y="13" width="7.5" height="7.5" rx="2" />
      <rect x="13" y="13" width="7.5" height="7.5" rx="2" />
    </svg>
  );
}

export function IconDocument({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke="currentColor" className={className} {...base}>
      <rect x="4.5" y="3" width="15" height="18" rx="2.5" />
      <path d="M8.5 8.5H15.5M8.5 12H15.5M8.5 15.5H12.5" />
    </svg>
  );
}

export function IconUsers({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke="currentColor" className={className} {...base}>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" />
      <circle cx="17" cy="8" r="2.4" />
      <path d="M15.8 13.6c2.4 0.3 4.2 2.3 4.2 5.1" />
    </svg>
  );
}

export function IconSearch({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke="currentColor" className={className} {...base}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export function IconBell({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke="currentColor" className={className} {...base}>
      <path d="M18 8a6 6 0 1 0-12 0c0 5.5-2 7-2 7h16s-2-1.5-2-7" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

export function IconChevronDown({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke="currentColor" className={className} {...base}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function IconChevronLeft({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke="currentColor" className={className} {...base}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function IconCheck({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke="currentColor" className={className} {...base}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function IconAlertTriangle({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke="currentColor" className={className} {...base}>
      <path d="M10.3 3.6 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

export function IconFilter({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke="currentColor" className={className} {...base}>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  );
}

export function IconDownload({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke="currentColor" className={className} {...base}>
      <path d="M4 12h16M12 4v16" transform="rotate(45 12 12)" />
    </svg>
  );
}

export function IconEye({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke="currentColor" className={className} {...base}>
      <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7-10.5-7-10.5-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconEdit({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke="currentColor" className={className} {...base}>
      <path d="M15.5 4.5 19.5 8.5 8 20H4v-4Z" />
      <path d="M13.5 6.5 17.5 10.5" />
    </svg>
  );
}

export function IconCalendar({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke="currentColor" className={className} {...base}>
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </svg>
  );
}

export function IconCamera({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke="currentColor" className={className} {...base}>
      <rect x="2.5" y="6" width="19" height="14" rx="2.5" />
      <circle cx="12" cy="13" r="3.4" />
      <path d="M8 6l1.4-2.2h5.2L16 6" />
    </svg>
  );
}

export function IconLock({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke="currentColor" className={className} {...base}>
      <rect x="4" y="10.5" width="16" height="10" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </svg>
  );
}

export function IconPlus({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke="currentColor" className={className} {...base}>
      <path d="M12 4v16M4 12h16" />
    </svg>
  );
}

export function IconX({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke="currentColor" className={className} {...base}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function IconLogout({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke="currentColor" className={className} {...base}>
      <path d="M15 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h9" />
      <path d="M10 12h11M17 8l4 4-4 4" />
    </svg>
  );
}

// Sparkle — usado para la sección Atilio (asistente de IA).
export function IconSparkle({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2.5c.4 3.1 1.2 5.2 2.4 6.4 1.2 1.2 3.3 2 6.4 2.4-3.1.4-5.2 1.2-6.4 2.4-1.2 1.2-2 3.3-2.4 6.4-.4-3.1-1.2-5.2-2.4-6.4-1.2-1.2-3.3-2-6.4-2.4 3.1-.4 5.2-1.2 6.4-2.4 1.2-1.2 2-3.3 2.4-6.4Z" />
      <path d="M19 3c.2 1 .5 1.7.9 2.1.4.4 1.1.7 2.1.9-1 .2-1.7.5-2.1.9-.4.4-.7 1.1-.9 2.1-.2-1-.5-1.7-.9-2.1-.4-.4-1.1-.7-2.1-.9 1-.2 1.7-.5 2.1-.9.4-.4.7-1.1.9-2.1Z" />
    </svg>
  );
}

export function IconClock({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke="currentColor" className={className} {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.5l4 2.5" />
    </svg>
  );
}
