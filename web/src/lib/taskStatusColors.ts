// Colores del calendario según el ESTADO de la tarea (project.task.stage_id
// en Odoo — la columna del Kanban de Field Service, expuesta acá como
// CalendarTask.stage), no según qué técnico la tiene asignada. Reemplaza el
// esquema anterior de "un color por técnico" (ver git history): coordinación
// quiere de un vistazo qué tareas están pendientes, hechas, canceladas, etc.
// — no quién las hace.
//
// Reusa las familias de color que ya existen en el theme (design.md /
// globals.css) en vez de inventar tonos nuevos, con dos intensidades por
// familia cuando Odoo tiene una variante "clara" y una "fuerte" del mismo
// estado (Cancelada / Cancelada por el cliente, Hecho / Hecho con Producto).
export interface StatusColorSwatch {
  bg: string;
  text: string;
  dot: string;
}

const DEFAULT_SWATCH: StatusColorSwatch = { bg: 'bg-neutral-50', text: 'text-muted', dot: 'bg-neutral-300' };

// Nombres tal cual figuran hoy en el stage_id de Odoo (confirmado contra la
// instancia real, ver calendarTask.service.ts). Se matchea por substring
// normalizado (sin acentos, minúsculas) porque viene como texto libre de
// Odoo, no un enum — más específico primero para que "Hecho con Producto" no
// caiga en la rama genérica de "Hecho", ídem "Cancelada por el cliente" vs
// "Cancelada".
const STATUS_RULES: Array<{ match: string; swatch: StatusColorSwatch }> = [
  { match: 'hecho con producto', swatch: { bg: 'bg-success-700', text: 'text-white', dot: 'bg-success-900' } },
  { match: 'hecho', swatch: { bg: 'bg-success-100', text: 'text-success-700', dot: 'bg-success-500' } },
  { match: 'cancelada por el cliente', swatch: { bg: 'bg-danger-50', text: 'text-danger-700', dot: 'bg-danger-500' } },
  { match: 'cancelada', swatch: { bg: 'bg-danger-500', text: 'text-white', dot: 'bg-danger-700' } },
  { match: 'visita fallida', swatch: { bg: 'bg-warning-100', text: 'text-warning-700', dot: 'bg-warning-500' } },
  { match: 'pendiente de respuesta', swatch: { bg: 'bg-accent-100', text: 'text-accent-700', dot: 'bg-accent-600' } },
  { match: 'sin respuesta', swatch: { bg: 'bg-neutral-100', text: 'text-neutral-700', dot: 'bg-neutral-600' } },
  { match: 'coordinado', swatch: { bg: 'bg-secondary-100', text: 'text-secondary-700', dot: 'bg-secondary-600' } },
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function resolveStatusSwatch(stage: string | null): StatusColorSwatch {
  if (!stage) return DEFAULT_SWATCH;
  const normalized = normalize(stage);
  const rule = STATUS_RULES.find((r) => normalized.includes(r.match));
  return rule ? rule.swatch : DEFAULT_SWATCH;
}
