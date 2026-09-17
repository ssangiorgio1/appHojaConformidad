// Ported verbatim from hoja-de-conformidad-wara_1.html (CHECKLIST_ITEMS) —
// this is the single source of truth for checklist keys/labels shared by the
// API, the mobile app, and (later) the web admin panel.
export const CHECKLIST_KEYS = [
  'item1',
  'item2',
  'item3',
  'item4',
  'item5',
  'item6_airbag',
  'item6_guine',
  'item6_alternador',
  'item6_presion',
  'item6_temp',
  'item6_falla',
  'item7',
  'item8',
] as const;

export type ChecklistKey = (typeof CHECKLIST_KEYS)[number];

export interface ChecklistItemDef {
  key: ChecklistKey;
  label: string;
  note?: string;
  group?: string;
  // If set, answering this value (SI or NO) requires a separate detail
  // textfield (fallaDetalle/item7Detalle/item8Detalle on Phase, see
  // types.ts). item6_falla triggers on 'SI', item7/item8 on 'NO' — the value
  // differs per item on purpose, hence a config field instead of a boolean.
  requiresDetailWhen?: 'SI' | 'NO';
}

export const CHECKLIST_ITEMS: ChecklistItemDef[] = [
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
  { key: 'item6_falla', label: 'f) Notificar sobre alguna luz de falla.', requiresDetailWhen: 'SI' },
  { key: 'item7', label: '7. Tornillos de panel y tablero completo.', requiresDetailWhen: 'NO' },
  { key: 'item8', label: '8. Tapizados asientos en general.', requiresDetailWhen: 'NO' },
];

export const CHECKLIST_LABELS: Record<ChecklistKey, string> = Object.fromEntries(
  CHECKLIST_ITEMS.map((i) => [i.key, i.label]),
) as Record<ChecklistKey, string>;

export type ChecklistValue = 'SI' | 'NO' | null;
export type Checklist = Record<ChecklistKey, ChecklistValue>;

export function emptyChecklist(): Checklist {
  return Object.fromEntries(CHECKLIST_KEYS.map((key) => [key, null])) as Checklist;
}

export function missingChecklistItems(checklist: Checklist): ChecklistItemDef[] {
  return CHECKLIST_ITEMS.filter((item) => !checklist[item.key]);
}

// Field name on Phase (types.ts) holding the detail for each item that needs
// one — same mapping for PRE and POST.
export const DETAIL_FIELD_BY_KEY: Partial<Record<ChecklistKey, 'fallaDetalle' | 'item7Detalle' | 'item8Detalle'>> = {
  item6_falla: 'fallaDetalle',
  item7: 'item7Detalle',
  item8: 'item8Detalle',
};

// Which value (SI/NO) triggers the detail textfield for this item, if any.
export function checklistDetailTrigger(key: ChecklistKey): ChecklistValue {
  return CHECKLIST_ITEMS.find((i) => i.key === key)?.requiresDetailWhen ?? null;
}

// Which items with requiresDetailWhen are still missing their detail, given
// the current checklist and the detail values already typed.
export function missingChecklistDetail(checklist: Checklist, detalles: Partial<Record<ChecklistKey, string | undefined>>): ChecklistItemDef[] {
  return CHECKLIST_ITEMS.filter((item) => {
    if (!item.requiresDetailWhen) return false;
    if (checklist[item.key] !== item.requiresDetailWhen) return false;
    return !detalles[item.key]?.trim();
  });
}

export interface ChecklistDiffEntry {
  key: ChecklistKey;
  label: string;
  preValue: ChecklistValue;
  postValue: ChecklistValue;
}

// Only compares items answered on both sides — a point left blank on either
// phase isn't a "change", it's just incomplete (handled separately by
// missingChecklistItems).
export function diffChecklists(pre: Checklist, post: Checklist): ChecklistDiffEntry[] {
  return CHECKLIST_ITEMS.filter((item) => {
    const preValue = pre[item.key];
    const postValue = post[item.key];
    return preValue !== null && postValue !== null && preValue !== postValue;
  }).map((item) => ({ key: item.key, label: item.label, preValue: pre[item.key], postValue: post[item.key] }));
}
