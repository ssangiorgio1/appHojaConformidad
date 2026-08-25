// Ported verbatim from hoja-de-conformidad-wara_1.html (CHECKLIST_ITEMS) —
// this is the single source of truth for checklist keys/labels shared by the
// Mongoose schema, request validation, and (later) the mobile/web clients.
export const CHECKLIST_ITEMS = [
  { key: 'item1', label: '1. Luces de posición, guiñe, balizas, luces altas y bajas e ignición del vehículo.' },
  {
    key: 'item2',
    label: '2. Autorización por parte de un responsable para el encendido del vehículo.',
    note: 'Procedimiento: A) Freno de mano puesto. B) Cambio en punto neutro. C) Embrague y freno presionados antes de encender.',
  },
  { key: 'item3', label: '3. Estado general del vehículo (chapería y pintura).' },
  { key: 'item4', label: '4. Paragolpes traseros y delanteros.' },
  { key: 'item5', label: '5. Tablero y panel del vehículo (fotos del panel antes del desarme).' },
  { key: 'item6_airbag', label: 'a) Luz de airbag.', group: '6. Revisión de luces del tablero en general' },
  { key: 'item6_guine', label: 'b) Luces de guiñe.' },
  { key: 'item6_alternador', label: 'c) Luz de alternador.' },
  { key: 'item6_presion', label: 'd) Luz de presión de aceite.' },
  { key: 'item6_temp', label: 'e) Luz de temperatura.' },
  { key: 'item6_falla', label: 'f) Notificar sobre alguna luz de falla.' },
  { key: 'item7', label: '7. Tornillos de panel y tablero completo.' },
  { key: 'item8', label: '8. Tapizado de asientos delanteros (fotos).' },
] as const;

export type ChecklistKey = (typeof CHECKLIST_ITEMS)[number]['key'];

export const CHECKLIST_KEYS = CHECKLIST_ITEMS.map((i) => i.key) as ChecklistKey[];

export const CHECKLIST_LABELS: Record<ChecklistKey, string> = Object.fromEntries(
  CHECKLIST_ITEMS.map((i) => [i.key, i.label]),
) as Record<ChecklistKey, string>;
