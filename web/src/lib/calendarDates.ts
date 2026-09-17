// Odoo devuelve los datetime de project.task en UTC (executeKw no setea
// context.tz — ver plan). Argentina es UTC-3 fijo, sin horario de verano
// (mismo criterio documentado para el resto de esta suite de paneles WARA).
// Estos helpers convierten entre "reloj de pared en Argentina" y los
// strings UTC que espera/devuelve Odoo ('YYYY-MM-DD HH:mm:ss').
const AR_OFFSET_MS = 3 * 60 * 60 * 1000;
export const AR_TIME_ZONE = 'America/Argentina/Buenos_Aires';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// Devuelve un Date cuyos getUTC*() leen el reloj de pared de Argentina (no
// es un instante real — es un truco de cómputo, nunca se muestra ni se manda
// a Odoo directamente).
function nowAsArWallClock(): Date {
  return new Date(Date.now() - AR_OFFSET_MS);
}

function arWallClockToUtcInstant(wallClock: Date): Date {
  return new Date(wallClock.getTime() + AR_OFFSET_MS);
}

// Exportado — lo necesita el drag-and-drop del calendario para convertir la
// nueva fecha/hora calculada de vuelta al formato que espera Odoo al guardar.
export function formatOdooUtcString(utcInstant: Date): string {
  return (
    `${utcInstant.getUTCFullYear()}-${pad(utcInstant.getUTCMonth() + 1)}-${pad(utcInstant.getUTCDate())} ` +
    `${pad(utcInstant.getUTCHours())}:${pad(utcInstant.getUTCMinutes())}:${pad(utcInstant.getUTCSeconds())}`
  );
}

// Parsea un string de Odoo ('YYYY-MM-DD HH:mm:ss', UTC) a un Date real.
export function parseOdooUtcString(s: string): Date {
  return new Date(`${s.replace(' ', 'T')}Z`);
}

// Un rango contiguo de días (1 para vista día, 7 para vista semana) — mismo
// shape para ambas vistas, así el grid no necesita saber cuál es cuál.
export interface CalendarRange {
  /** Medianoche del primer día, hora Argentina, como string UTC para mandar a Odoo. */
  from: string;
  /** Medianoche del día siguiente al último, hora Argentina (exclusivo), como string UTC. */
  to: string;
  /** Cada día del rango, como el instante UTC real de su medianoche en Argentina. */
  days: Date[];
  /** Primer día del rango, como instante UTC real — para mostrar el rango. */
  rangeStartUtc: Date;
}

function buildRange(wallStart: Date, dayCount: number): CalendarRange {
  const rangeStartUtc = arWallClockToUtcInstant(wallStart);
  const wallEnd = new Date(wallStart.getTime() + dayCount * 24 * 60 * 60 * 1000);
  const rangeEndUtc = arWallClockToUtcInstant(wallEnd);

  const days: Date[] = [];
  for (let i = 0; i < dayCount; i++) {
    days.push(arWallClockToUtcInstant(new Date(wallStart.getTime() + i * 24 * 60 * 60 * 1000)));
  }

  return { from: formatOdooUtcString(rangeStartUtc), to: formatOdooUtcString(rangeEndUtc), days, rangeStartUtc };
}

// `weekOffset` = 0 es la semana actual, 1 la próxima, -1 la anterior, etc.
export function getArWeek(weekOffset: number): CalendarRange {
  const wallNow = nowAsArWallClock();
  const dayOfWeek = wallNow.getUTCDay(); // 0=domingo..6=sábado
  const daysSinceMonday = (dayOfWeek + 6) % 7;

  const wallMonday = new Date(
    Date.UTC(wallNow.getUTCFullYear(), wallNow.getUTCMonth(), wallNow.getUTCDate() - daysSinceMonday + weekOffset * 7, 0, 0, 0),
  );
  return buildRange(wallMonday, 7);
}

// `dayOffset` = 0 es hoy, 1 mañana, -1 ayer, etc.
export function getArDay(dayOffset: number): CalendarRange {
  const wallNow = nowAsArWallClock();
  const wallDay = new Date(Date.UTC(wallNow.getUTCFullYear(), wallNow.getUTCMonth(), wallNow.getUTCDate() + dayOffset, 0, 0, 0));
  return buildRange(wallDay, 1);
}

export function formatArTime(d: Date): string {
  // hourCycle: 'h23' fuerza 24hs ("15:00") — sin esto, algunos entornos ICU
  // igual muestran a. m./p. m. para es-AR.
  return new Intl.DateTimeFormat('es-AR', { timeZone: AR_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
}

export const DEFAULT_TASK_DURATION_HOURS = 1;

/** "15:00 – 17:00", o "15:00 – 16:00 (aprox.)" cuando Odoo no tiene fin cargado. */
export function formatArTimeRange(startStr: string, endStr: string | null): string {
  const start = parseOdooUtcString(startStr);
  const startLabel = formatArTime(start);
  if (endStr) {
    const end = parseOdooUtcString(endStr);
    return `${startLabel} – ${formatArTime(end)}`;
  }
  const estimatedEnd = new Date(start.getTime() + DEFAULT_TASK_DURATION_HOURS * 60 * 60 * 1000);
  return `${startLabel} – ${formatArTime(estimatedEnd)} (aprox.)`;
}

export function formatArWeekdayShort(d: Date): string {
  return new Intl.DateTimeFormat('es-AR', { timeZone: AR_TIME_ZONE, weekday: 'short', day: 'numeric', month: 'short' }).format(d);
}

export function formatArFullDate(d: Date): string {
  return new Intl.DateTimeFormat('es-AR', { timeZone: AR_TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long' }).format(d);
}

export function formatArRange(from: Date, to: Date): string {
  const fmt = new Intl.DateTimeFormat('es-AR', { timeZone: AR_TIME_ZONE, day: 'numeric', month: 'short' });
  return `${fmt.format(from)} – ${fmt.format(new Date(to.getTime() - 24 * 60 * 60 * 1000))}`;
}

/** A qué día (0-based) del rango en curso pertenece el instante, en hora Argentina. */
export function arDayIndexInRange(d: Date, range: CalendarRange): number | null {
  for (let i = 0; i < range.days.length; i++) {
    const dayStart = range.days[i].getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    if (d.getTime() >= dayStart && d.getTime() < dayEnd) return i;
  }
  return null;
}
