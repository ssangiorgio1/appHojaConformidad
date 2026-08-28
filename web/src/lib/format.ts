const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// fecha/hora are the técnico's local wall-clock strings (YYYY-MM-DD / HH:mm,
// no timezone) — reformatted in place, never parsed through Date, since that
// would re-interpret them in the browser's timezone and shift them again.
export function formatFechaHora(fecha?: string, hora?: string): string {
  if (!fecha) return '—';
  const [y, m, d] = fecha.split('-').map(Number);
  if (!y || !m || !d || m < 1 || m > 12) return hora ? `${fecha} ${hora}` : fecha;
  const datePart = `${d} ${MONTHS_ES[m - 1]} ${y}`;
  return hora ? `${datePart}, ${hora}` : datePart;
}

// For real UTC instants (firmedAt, createdAt...) — always rendered in
// Argentina's timezone regardless of the viewer's own, since this is an
// internal tool for a team that's always there.
export function formatIsoDateTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return formatFechaHora(`${parts.year}-${parts.month}-${parts.day}`, `${parts.hour}:${parts.minute}`);
}
