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
  // Mismo slot que retiro — el PRE de un cambio_equipo (esquema nuevo, hoja
  // única) documenta el equipo saliente antes de tocarlo, igual que un retiro.
  cambio_equipo: { key: 'equipo_a_retirar', label: 'Equipo a retirar (N° de serie)', required: true },
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
  // Optional for now — not every service has a panic button. Once the
  // product catalog exists this should depend on whether the install order
  // includes one (see post/[id]/page.tsx in the PWA: meanwhile, if the
  // technician checked "Botón de pánico" under Módulos but didn't upload
  // this photo, a non-blocking confirm warns them, not this flag).
  { key: 'boton_panico', label: 'Botón de pánico (que se note la ubicación)', required: false },
];

// Capture guide for POST in 'retiro' mode — nothing gets installed, so
// instead of placement photos it asks to verify the equipment actually left
// and nothing was left loose/exposed. No photo of the removed equipment's
// serial number: the PRE already asks for it ('equipo_a_retirar', see
// PRE_MODE_SLOT) and it's the same info twice. "Lugar donde estaba" and
// "cableado retirado" are optional (not every retiro leaves something worth
// photographing there) — placed last, after the required ones, same
// criterion as the PRE's "Extra" slot.
const POST_PHOTO_SLOTS_RETIRO: PhotoSlotDef[] = [
  { key: 'torpedo', label: 'Torpedo (tablero encendido, luces de check y estado general)', required: true },
  { key: 'odometro', label: 'Odómetro', required: true },
  { key: 'lugar_vacio', label: 'Lugar donde estaba el equipo', required: false },
  { key: 'cableado_retirado', label: 'Cableado retirado / puntas aisladas', required: false },
];

// POST de un cambio_equipo (esquema nuevo, hoja única): en el mismo paso hay
// que probar tanto que el equipo viejo salió como que el nuevo quedó bien
// instalado — es la unión de los dos sets de arriba, sin repetir torpedo ni
// odómetro (ya sirven para las dos cosas, no tiene sentido pedir la foto 2
// veces). Tampoco repite la foto del N° de serie del equipo retirado — ya la
// pide el PRE, ver comentario en POST_PHOTO_SLOTS_RETIRO. "Lugar donde
// estaba" y "cableado retirado" son opcionales acá también, mismo criterio
// que POST_PHOTO_SLOTS_RETIRO — van al final.
const POST_PHOTO_SLOTS_CAMBIO_EQUIPO: PhotoSlotDef[] = [
  { key: 'equipo_serie', label: 'Equipo a colocar (N° de serie)', required: true },
  { key: 'precintos', label: 'N° de precintos a usar', required: true },
  { key: 'ubicacion_equipo', label: 'Ubicación y colocación del equipo', required: true },
  { key: 'ramales', label: 'Ramales', required: true },
  { key: 'torpedo', label: 'Torpedo (tablero encendido, luces de check y estado general)', required: true },
  { key: 'odometro', label: 'Odómetro', required: true },
  // Optional for now — see comment in POST_PHOTO_SLOTS_INSTALACION.
  { key: 'boton_panico', label: 'Botón de pánico (que se note la ubicación)', required: false },
  { key: 'lugar_vacio', label: 'Lugar donde estaba el equipo', required: false },
  { key: 'cableado_retirado', label: 'Cableado retirado / puntas aisladas', required: false },
];

export function postPhotoSlotsFor(mode: ServiceMode): PhotoSlotDef[] {
  if (mode === 'retiro') return POST_PHOTO_SLOTS_RETIRO;
  if (mode === 'cambio_equipo') return POST_PHOTO_SLOTS_CAMBIO_EQUIPO;
  return POST_PHOTO_SLOTS_INSTALACION;
}

// slotKey shared by every photo in the sensores/accesorios gallery (see
// GalleryPhotoCapture in the PWA) — not a PhotoSlotDef because it isn't 1
// photo = 1 slot, it's N photos tagged with the same key.
export const SENSORES_ACCESORIOS_GROUP_KEY = 'sensores_accesorios';
