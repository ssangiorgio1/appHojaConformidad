// Colores para diferenciar técnicos en el calendario. Usa las familias de
// color que ya existen en el theme (design.md / globals.css) en vez de
// inventar tonos nuevos, para que quede consistente con el resto del panel.
// Es una preferencia puramente visual y por-navegador — se guarda en
// localStorage, no en el backend (no hay nada que sincronizar entre
// coordinadores).
export interface TechnicianColorSwatch {
  key: string;
  label: string;
  bg: string;
  text: string;
  dot: string;
}

export const TECHNICIAN_PALETTE: TechnicianColorSwatch[] = [
  { key: 'primary', label: 'Rosa', bg: 'bg-primary-50', text: 'text-primary-700', dot: 'bg-primary-600' },
  { key: 'secondary', label: 'Azul', bg: 'bg-secondary-50', text: 'text-secondary-700', dot: 'bg-secondary-600' },
  { key: 'accent', label: 'Violeta', bg: 'bg-accent-50', text: 'text-accent-700', dot: 'bg-accent-600' },
  { key: 'success', label: 'Verde', bg: 'bg-success-50', text: 'text-success-700', dot: 'bg-success-600' },
  { key: 'warning', label: 'Naranja', bg: 'bg-warning-50', text: 'text-warning-700', dot: 'bg-warning-600' },
  { key: 'danger', label: 'Rojo', bg: 'bg-danger-50', text: 'text-danger-700', dot: 'bg-danger-600' },
  { key: 'neutral', label: 'Gris', bg: 'bg-neutral-100', text: 'text-neutral-700', dot: 'bg-neutral-600' },
];

const STORAGE_KEY = 'wara.calendario.coloresPorTecnico';

export type TechnicianColorMap = Record<number, string>;

export function loadTechnicianColorOverrides(): TechnicianColorMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveTechnicianColorOverrides(map: TechnicianColorMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage no disponible (modo privado, etc.) — la preferencia
    // simplemente no persiste entre sesiones, no es crítico.
  }
}

function defaultPaletteKeyFor(technicianId: number): string {
  const index = Math.abs(technicianId) % TECHNICIAN_PALETTE.length;
  return TECHNICIAN_PALETTE[index].key;
}

export function resolveTechnicianSwatch(technicianId: number | null, overrides: TechnicianColorMap): TechnicianColorSwatch {
  const key = (technicianId != null && overrides[technicianId]) || (technicianId != null ? defaultPaletteKeyFor(technicianId) : 'neutral');
  return TECHNICIAN_PALETTE.find((s) => s.key === key) ?? TECHNICIAN_PALETTE[TECHNICIAN_PALETTE.length - 1];
}
