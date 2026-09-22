import type { ServiceMode } from './serviceMode.js';

export interface PhotoSlotDef {
  key: string;
  label: string;
  required: boolean;
}

// Fixed, ordered capture guide for PRE — common to the 3 service modes.
const PRE_PHOTO_SLOTS_BASE: PhotoSlotDef[] = [
  { key: 'matricula', label: 'Matrícula', required: true },
  { key: 'lateral_izq', label: 'Lateral externo izquierdo (conductor)', required: true },
  { key: 'lateral_der', label: 'Lateral externo derecho', required: true },
  { key: 'frente', label: 'Frente de la unidad', required: true },
  { key: 'interior', label: 'Interior de la unidad', required: true },
  { key: 'torpedo', label: 'Torpedo (tablero encendido, luces de check y estado general)', required: true },
  { key: 'odometro', label: 'Odómetro / horómetro', required: true },
];

const PRE_EXTRA_SLOT: PhotoSlotDef = { key: 'extra', label: 'Extra', required: false };

// The equipment already physically exists at PRE time for retiro/reparación
// (unlike instalación, where there's nothing to photograph yet) — document
// it before touching it.
const PRE_MODE_SLOT: Partial<Record<ServiceMode, PhotoSlotDef>> = {
  retiro: { key: 'equipo_a_retirar', label: 'Equipo a retirar (N° de serie)', required: true },
  reparacion: { key: 'estado_equipo_prereparacion', label: 'Estado del equipo antes de reparar', required: true },
};

export function prePhotoSlotsFor(mode: ServiceMode): PhotoSlotDef[] {
  const modeSlot = PRE_MODE_SLOT[mode];
  return modeSlot ? [...PRE_PHOTO_SLOTS_BASE, modeSlot, PRE_EXTRA_SLOT] : [...PRE_PHOTO_SLOTS_BASE, PRE_EXTRA_SLOT];
}

// Fixed, ordered capture guide for POST when an equipment is installed/
// repaired ('instalacion' and 'reparacion' modes — reparación doesn't
// replace the unit, but still needs to prove it ended up properly placed and
// working again). The fixed "Accesorios" slot and the 3 optional "Sensores"
// slots were replaced by an unlimited gallery (see
// SENSORES_ACCESORIOS_GROUP_KEY) — sometimes there's 1 sensor/accesorio,
// sometimes 5, a fixed slot per unit didn't scale.
const POST_PHOTO_SLOTS_INSTALACION: PhotoSlotDef[] = [
  { key: 'equipo_serie', label: 'Equipo a colocar (N° de serie)', required: true },
  { key: 'precintos', label: 'N° de precintos a usar', required: true },
  { key: 'ubicacion_equipo', label: 'Ubicación y colocación del equipo', required: true },
  { key: 'ramales', label: 'Ramales', required: true },
  { key: 'torpedo', label: 'Torpedo (tablero encendido, luces de check y estado general)', required: true },
  { key: 'odometro', label: 'Odómetro', required: true },
  { key: 'boton_panico', label: 'Botón de pánico (que se note la ubicación)', required: true },
];

// Capture guide for POST in 'retiro' mode — nothing gets installed, so
// instead of placement photos it asks to verify the equipment actually left
// and nothing was left loose/exposed.
const POST_PHOTO_SLOTS_RETIRO: PhotoSlotDef[] = [
  { key: 'equipo_retirado', label: 'Equipo retirado (N° de serie)', required: true },
  { key: 'lugar_vacio', label: 'Lugar donde estaba el equipo', required: true },
  { key: 'cableado_retirado', label: 'Cableado retirado / puntas aisladas', required: true },
  { key: 'torpedo', label: 'Torpedo (tablero encendido, luces de check y estado general)', required: true },
  { key: 'odometro', label: 'Odómetro', required: true },
];

export function postPhotoSlotsFor(mode: ServiceMode): PhotoSlotDef[] {
  return mode === 'retiro' ? POST_PHOTO_SLOTS_RETIRO : POST_PHOTO_SLOTS_INSTALACION;
}

// slotKey shared by every photo in the sensores/accesorios gallery (see
// GalleryPhotoCapture in the PWA) — not a PhotoSlotDef because it isn't 1
// photo = 1 slot, it's N photos tagged with the same key.
export const SENSORES_ACCESORIOS_GROUP_KEY = 'sensores_accesorios';
