import type { ServiceMode } from './serviceMode.js';
import type { MotivoIntervencion, TipoUnidad } from './types.js';

export interface PhotoSlotDef {
  key: string;
  label: string;
  required: boolean;
  // Permite más de una foto en el mismo slot (todas comparten slotKey).
  multi?: boolean;
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

// The equipment already physically exists at PRE time for reparación (unlike
// instalación, where there's nothing to photograph yet) — document it before
// touching it. 'retiro' and 'cambio_equipo' have NO slot here on purpose: at
// PRE time the equipment being removed is still installed (sometimes hard to
// access), so its photo is only asked for later, in POST — 'equipo_a_retirar'
// (see POST_PHOTO_SLOTS_RETIRO / POST_PHOTO_SLOTS_CAMBIO_EQUIPO below) — once
// it's actually been taken out and can be photographed properly.
const PRE_MODE_SLOT: Partial<Record<ServiceMode, PhotoSlotDef>> = {
  reparacion: { key: 'estado_equipo_prereparacion', label: 'Estado del equipo antes de reparar', required: true },
};

// Otro equipo (surtidor, generador, etc.): no hay patente, laterales ni tablero. Se pide el lugar donde va el equipo
// (instalación) o el equipo a intervenir; en una intervención además queda el slot de "estado antes de intervenir"
// de PRE_MODE_SLOT. A confirmar con operaciones qué más hace falta fotografiar en estos casos.
function preSlotsOtroEquipo(mode: ServiceMode): PhotoSlotDef[] {
  const label =
    mode === 'instalacion' ? 'Lugar donde se va a instalar el equipo' : mode === 'reparacion' ? 'Equipo a intervenir (vista general)' : 'Equipo y lugar (vista general)';
  return [{ key: 'lugar_instalacion', label, required: true, multi: true }];
}

export function prePhotoSlotsFor(mode: ServiceMode, tipoUnidad?: TipoUnidad | null): PhotoSlotDef[] {
  const base = tipoUnidad === 'otro_equipo' ? preSlotsOtroEquipo(mode) : PRE_PHOTO_SLOTS_BASE;
  const modeSlot = PRE_MODE_SLOT[mode];
  return modeSlot ? [...base, modeSlot, PRE_EXTRA_SLOT] : [...base, PRE_EXTRA_SLOT];
}

// Fixed, ordered capture guide for POST when an equipment is installed/
// repaired ('instalacion' and 'reparacion' modes — reparación doesn't
// replace the unit, but still needs to prove it ended up properly placed and
// working again). The fixed "Accesorios" slot and the 3 optional "Sensores"
// slots were replaced by an unlimited gallery (see
// SENSORES_ACCESORIOS_GROUP_KEY) — sometimes there's 1 sensor/accesorio,
// sometimes 5, a fixed slot per unit didn't scale.
const POST_PHOTO_SLOTS_INSTALACION: PhotoSlotDef[] = [
  { key: 'equipo_serie', label: 'Equipo a colocar (N° de serie)', required: true, multi: true },
  { key: 'precintos', label: 'N° de precintos a usar', required: false, multi: true },
  { key: 'ubicacion_equipo', label: 'Ubicación y colocación del equipo', required: true, multi: true },
  { key: 'ramales', label: 'Ramales', required: false, multi: true },
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
// and nothing was left loose/exposed. 'equipo_a_retirar' is asked here (not
// in PRE, see PRE_MODE_SLOT above) — only once the equipment is actually
// removed can it be photographed properly (legible serial number), unlike at
// PRE time when it's still installed. "Lugar donde estaba" and "cableado
// retirado" are optional (not every retiro leaves something worth
// photographing there) — placed last, after the required ones, same
// criterion as the PRE's "Extra" slot.
const POST_PHOTO_SLOTS_RETIRO: PhotoSlotDef[] = [
  { key: 'equipo_a_retirar', label: 'Equipo/elemento retirado', required: true, multi: true },
  { key: 'torpedo', label: 'Torpedo (tablero encendido, luces de check y estado general)', required: true },
  { key: 'odometro', label: 'Odómetro', required: true },
  { key: 'lugar_vacio', label: 'Lugar donde estaba el equipo', required: true, multi: true },
  { key: 'cableado_retirado', label: 'Cableado retirado / puntas aisladas', required: false, multi: true },
];

// POST de un cambio_equipo (esquema nuevo, hoja única): en el mismo paso hay
// que probar tanto que el equipo viejo salió como que el nuevo quedó bien
// instalado — es la unión de los dos sets de arriba, sin repetir torpedo ni
// odómetro (ya sirven para las dos cosas, no tiene sentido pedir la foto 2
// veces). A diferencia de una versión anterior de este flujo, la foto del N°
// de serie del equipo retirado ('equipo_a_retirar') ya no se pide en el PRE
// (ver PRE_MODE_SLOT) — se pide acá, recién cuando se desmonta y se lo puede
// fotografiar bien, mismo criterio que POST_PHOTO_SLOTS_RETIRO. "Lugar donde
// estaba" y "cableado retirado" son opcionales acá también, mismo criterio —
// van al final.
const POST_PHOTO_SLOTS_CAMBIO_EQUIPO: PhotoSlotDef[] = [
  { key: 'equipo_a_retirar', label: 'Equipo a retirar (N° de serie)', required: true, multi: true },
  { key: 'equipo_serie', label: 'Equipo a colocar (N° de serie)', required: true, multi: true },
  { key: 'precintos', label: 'N° de precintos a usar', required: false, multi: true },
  { key: 'ubicacion_equipo', label: 'Ubicación y colocación del equipo', required: true, multi: true },
  { key: 'ramales', label: 'Ramales', required: false, multi: true },
  { key: 'torpedo', label: 'Torpedo (tablero encendido, luces de check y estado general)', required: true },
  { key: 'odometro', label: 'Odómetro', required: true },
  // Optional for now — see comment in POST_PHOTO_SLOTS_INSTALACION.
  { key: 'boton_panico', label: 'Botón de pánico (que se note la ubicación)', required: false },
  // Cambio de unidad completo: el equipo nuevo va en OTRA unidad. Opcionales, para que quede constancia de en qué unidad se instaló.
  { key: 'unidad_destino_matricula', label: 'Unidad nueva (donde quedó el equipo): matrícula', required: false, multi: true },
  { key: 'unidad_destino', label: 'Unidad nueva (donde quedó el equipo): fotos de la unidad', required: false, multi: true },
  { key: 'lugar_vacio', label: 'Lugar donde estaba el equipo', required: false, multi: true },
  { key: 'cableado_retirado', label: 'Cableado retirado / puntas aisladas', required: false, multi: true },
];

function postSlotsBase(mode: ServiceMode): PhotoSlotDef[] {
  if (mode === 'retiro') return POST_PHOTO_SLOTS_RETIRO;
  if (mode === 'cambio_equipo') return POST_PHOTO_SLOTS_CAMBIO_EQUIPO;
  return POST_PHOTO_SLOTS_INSTALACION;
}

// Un equipo que no es un vehículo no tiene tablero ni odómetro: se sacan torpedo y odómetro/horómetro.
export function postPhotoSlotsFor(mode: ServiceMode, _motivoIntervencion?: unknown, tipoUnidad?: TipoUnidad | null): PhotoSlotDef[] {
  const slots = postSlotsBase(mode);
  return tipoUnidad === 'otro_equipo' ? slots.filter((s) => s.key !== 'torpedo' && s.key !== 'odometro') : slots;
}

// Each checkable item under "Módulos y sensores" (antena/sensor/módulo/
// elemento adicional) has its own free gallery in "Ubicación y sujeción" (see
// GalleryPhotoCapture in the PWA), using the Equipo field's own key as
// slotKey directly — already unique across the whole schema, so the photo's
// caption in the PDF is the name of what was checked (see
// EQUIP_ITEM_PHOTO_LABEL in equipo.ts) instead of a generic category. Not a
// PhotoSlotDef because it isn't 1 photo = 1 slot, it's N photos per key.

// Free gallery for the 'reparacion' mode's "Intervención realizada" step —
// same mechanism as above, with its own label in the PDF (see GALLERY_LABELS
// in printHtml.ts) so these photos aren't confused with the others.
export const INTERVENCION_GROUP_KEY = 'intervencion';

// Free gallery for extra/misc photos in POST (any service mode) that don't
// fit a fixed slot above — same mechanism as INTERVENCION_GROUP_KEY, own
// label in the PDF ("Otras fotos", see GALLERY_LABELS in printHtml.ts).
export const EXTRA_POST_PHOTOS_KEY = 'extra_post';

// Video opcional del servicio (todos los modos): un clip corto que el técnico puede grabar al cerrar, por ejemplo para
// dejar constancia de cómo quedó funcionando. Viaja como una Foto más (mimeType 'video/webm'); el PDF solo marca que hay
// un video adjunto y se ve en el panel.
export const VIDEO_SERVICIO_KEY = 'video_servicio';

// Galería libre y opcional en los pasos de desinstalación donde se tilda lo
// retirado (sensores/módulos): fotos adicionales a las de cada ítem.
export const EXTRA_RETIRO_PHOTOS_KEY = 'extra_retiro';
