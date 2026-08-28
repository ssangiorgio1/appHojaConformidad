export interface PhotoSlotDef {
  key: string;
  label: string;
  required: boolean;
}

// Fixed, ordered capture guide for PRE-instalación — all 7 mandatory.
export const PRE_PHOTO_SLOTS: PhotoSlotDef[] = [
  { key: 'matricula', label: 'Matrícula', required: true },
  { key: 'lateral_izq', label: 'Lateral externo izquierdo (conductor)', required: true },
  { key: 'lateral_der', label: 'Lateral externo derecho', required: true },
  { key: 'frente', label: 'Frente de la unidad', required: true },
  { key: 'interior', label: 'Interior de la unidad', required: true },
  { key: 'torpedo', label: 'Torpedo (tablero encendido, luces de check y estado general)', required: true },
  { key: 'extra', label: 'Extra', required: true },
];

// Fixed, ordered capture guide for POST-instalación — 1-8 mandatory, 9-11 optional.
export const POST_PHOTO_SLOTS: PhotoSlotDef[] = [
  { key: 'equipo_serie', label: 'Equipo a colocar (N° de serie)', required: true },
  { key: 'precintos', label: 'N° de precintos a usar', required: true },
  { key: 'ubicacion_equipo', label: 'Ubicación y colocación del equipo', required: true },
  { key: 'ramales', label: 'Ramales', required: true },
  { key: 'accesorios', label: 'Accesorios conectados a la unidad', required: true },
  { key: 'torpedo', label: 'Torpedo (tablero encendido, luces de check y estado general)', required: true },
  { key: 'odometro', label: 'Odómetro', required: true },
  { key: 'boton_panico', label: 'Botón de pánico (que se note la ubicación)', required: true },
  { key: 'sensor_1', label: 'Sensores', required: false },
  { key: 'sensor_2', label: 'Sensores', required: false },
  { key: 'sensor_3', label: 'Sensores', required: false },
];
