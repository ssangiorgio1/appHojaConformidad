export interface PhotoSlotDef {
  key: string;
  label: string;
  required: boolean;
}

// Fixed, ordered capture guide for PRE-instalación — all 8 mandatory.
export const PRE_PHOTO_SLOTS: PhotoSlotDef[] = [
  { key: 'matricula', label: 'Matrícula', required: true },
  { key: 'lateral_izq', label: 'Lateral externo izquierdo (conductor)', required: true },
  { key: 'lateral_der', label: 'Lateral externo derecho', required: true },
  { key: 'frente', label: 'Frente de la unidad', required: true },
  { key: 'interior', label: 'Interior de la unidad', required: true },
  { key: 'torpedo', label: 'Torpedo (tablero encendido, luces de check y estado general)', required: true },
  { key: 'odometro', label: 'Odómetro / horómetro', required: true },
  { key: 'extra', label: 'Extra', required: true },
];

// Fixed, ordered capture guide for POST-instalación — all mandatory. The
// fixed "Accesorios" slot and the 3 optional "Sensores" slots were replaced
// by an unlimited gallery (see SENSORES_ACCESORIOS_GROUP_KEY) — sometimes
// there's 1 sensor/accesorio, sometimes 5, a fixed slot per unit didn't scale.
export const POST_PHOTO_SLOTS: PhotoSlotDef[] = [
  { key: 'equipo_serie', label: 'Equipo a colocar (N° de serie)', required: true },
  { key: 'precintos', label: 'N° de precintos a usar', required: true },
  { key: 'ubicacion_equipo', label: 'Ubicación y colocación del equipo', required: true },
  { key: 'ramales', label: 'Ramales', required: true },
  { key: 'torpedo', label: 'Torpedo (tablero encendido, luces de check y estado general)', required: true },
  { key: 'odometro', label: 'Odómetro', required: true },
  { key: 'boton_panico', label: 'Botón de pánico (que se note la ubicación)', required: true },
];

// slotKey shared by every photo in the sensores/accesorios gallery (see
// GalleryPhotoCapture in the PWA) — not a PhotoSlotDef because it isn't 1
// photo = 1 slot, it's N photos tagged with the same key.
export const SENSORES_ACCESORIOS_GROUP_KEY = 'sensores_accesorios';
