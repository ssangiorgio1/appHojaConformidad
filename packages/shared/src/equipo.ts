// Ported verbatim from hoja-de-conformidad-wara_1.html (EQUIP_GROUPS / EQUIP_CHECK_FIELDS).
// The 5 groups below are a UI grouping concern only — API and storage layers
// treat `equipo` as one flat object keyed by these field keys.
import type { ChecklistValue } from './checklist.js';

export const EQUIP_GROUPS = [
  {
    title: 'Datos del equipo',
    fields: [
      { key: 'modelo', label: 'Modelo', required: true },
      { key: 'imei', label: 'IMEI', required: true },
      // Solo se piden (y se muestran) cuando tipoServicio es 'cambio_equipo'
      // — ahí modelo/imei de arriba pasan a describir el equipo que se
      // retira. Ver la lógica condicional en la PWA's post/[id]/page.tsx.
      { key: 'modeloInstalado', label: 'Modelo (equipo instalado)' },
      { key: 'imeiInstalado', label: 'IMEI (equipo instalado)' },
      { key: 'antenaGpsExt', label: 'Antena GPS (Ext)', checkbox: true },
    ],
  },
  {
    title: 'Sensores',
    fields: [
      { key: 'sensorTemperatura', label: 'Temperatura', checkbox: true },
      { key: 'sensorTemperaturaCantidad', label: 'Cantidad', dependsOn: 'sensorTemperatura', cantidad: true },
      { key: 'sensorAperturaPuertas', label: 'Apertura de puertas', checkbox: true },
      { key: 'sensorAperturaPuertasCantidad', label: 'Cantidad', dependsOn: 'sensorAperturaPuertas', cantidad: true },
      { key: 'sensorAperturaPSemi', label: 'Apertura p/semi', checkbox: true },
      { key: 'sensorAperturaPSemiCantidad', label: 'Cantidad', dependsOn: 'sensorAperturaPSemi', cantidad: true },
      { key: 'sensorGiro', label: 'Sensor de giro', checkbox: true },
      { key: 'canbus', label: 'CANBUS', checkbox: true },
      { key: 'trabaRobusta', label: 'Traba robusta', checkbox: true },
      { key: 'medComb', label: 'Varilla de combustible', checkbox: true },
      { key: 'medCombCantidad', label: 'Cantidad', dependsOn: 'medComb', cantidad: true },
      { key: 'desAcopSemi', label: 'Desacople / semi', checkbox: true },
    ],
  },
  {
    title: 'Módulos',
    fields: [
      { key: 'modCMotor', label: 'Corte de motor', checkbox: true },
      { key: 'modMicrofono', label: 'Micrófono', checkbox: true },
      { key: 'modBPanico', label: 'Botón de pánico', checkbox: true },
      { key: 'modBuzzerVelocidad', label: 'Buzzer velocidad', checkbox: true },
      { key: 'modIdConductor', label: 'Id. Conductor', checkbox: true },
      { key: 'modRFID', label: 'RFID', checkbox: true },
      { key: 'modDALLAS', label: 'DALLAS', checkbox: true },
      { key: 'modPantallaSerie', label: 'Pantalla N° serie', checkbox: true },
      // Only asked (and shown) when modPantallaSerie is checked.
      { key: 'modPantallaSerieDetalle', label: 'N° de serie (Pantalla)', dependsOn: 'modPantallaSerie' },
    ],
  },
  {
    title: 'Entradas / Salidas',
    fields: [
      { key: 'io1', label: 'Entrada digital 1 (IO1)', checkbox: true },
      // Solo se pide (y se muestra) cuando io1 está tildado — ver dependsOn.
      { key: 'io1Detalle', label: 'Detalle entrada digital 1 (IO1)', dependsOn: 'io1' },
      { key: 'io2', label: 'Entrada digital 2 (IO2)', checkbox: true },
      { key: 'io2Detalle', label: 'Detalle entrada digital 2 (IO2)', dependsOn: 'io2' },
      { key: 'ao1', label: 'Entrada analógica 1 (AO1)', checkbox: true },
      { key: 'ao1Detalle', label: 'Detalle entrada analógica 1 (AO1)', dependsOn: 'ao1' },
      { key: 'ao2', label: 'Entrada analógica 2 (AO2)', checkbox: true },
      { key: 'ao2Detalle', label: 'Detalle entrada analógica 2 (AO2)', dependsOn: 'ao2' },
    ],
  },
  {
    title: 'Elementos adicionales instalados',
    fields: [
      { key: 'camarasAdas', label: 'Cámaras ADAS', checkbox: true },
      // Only asked (and shown) when camarasAdas is checked — same idea as
      // io1Detalle/etc.
      // Una cámara por vehículo es lo habitual, pero hay trabajos con varias (ej. 10): el N° de serie de cada una va en su
      // propia línea (`series: true`, ver seriesDe) y la cantidad es la cantidad de series.
      { key: 'camarasAdasSerie', label: 'N° de serie (Cámaras ADAS)', dependsOn: 'camarasAdas', series: true },
      // La DSM (monitoreo del conductor) es un añadido de la cámara ADAS: no tiene N° de serie propio. Suele ir, pero no siempre.
      { key: 'camarasDsm', label: 'Cámara DSM (añadido de la ADAS)', checkbox: true },
      // Grabador de 4 u 8 cámaras: uno por unidad.
      { key: 'mdvr', label: 'MDVR (grabador de video)', checkbox: true },
      { key: 'mdvrCanales', label: 'Cámaras del MDVR (canales)', dependsOn: 'mdvr', canales: true },
      { key: 'mdvrSerie', label: 'N° de serie (MDVR)', dependsOn: 'mdvr' },
      { key: 'moduloWifi', label: 'Módulo wifi', checkbox: true },
      { key: 'antenaStarlink', label: 'Antena Starlink', checkbox: true },
      { key: 'antenaStarlinkSerie', label: 'N° de serie (Antena Starlink)', dependsOn: 'antenaStarlink' },
    ],
  },
  {
    title: 'Control de instalación',
    fields: [
      { key: 'controlSenalModem', label: 'Señal Modem' },
      { key: 'controlCantidadSatGps', label: 'Cantidad de Sat. GPS' },
      { key: 'controlBateriaInterna', label: 'Batería interna' },
      { key: 'controlAlimentacionExterna', label: 'Alimentación externa' },
      { key: 'controlOdometro', label: 'Odómetro (km)' },
      { key: 'controlHorometro', label: 'Horómetro (hs)' },
    ],
  },
] as const;

export const EQUIP_CHECK_FIELDS = [
  { key: 'controlRevisionIgnicion', label: 'Revisión de ignición' },
  { key: 'controlRevisionPanico', label: 'Revisión de pánico' },
  { key: 'controlConexionRed', label: 'Conexión a la red' },
  { key: 'controlRevisionSensores', label: 'Revisión de sensores (si corresponde)' },
] as const;

export type EquipoTextKey = (typeof EQUIP_GROUPS)[number]['fields'][number]['key'];
export type EquipoCheckKey = (typeof EQUIP_CHECK_FIELDS)[number]['key'];

export const EQUIP_TEXT_KEYS = EQUIP_GROUPS.flatMap((g) => g.fields.map((f) => f.key)) as EquipoTextKey[];
export const EQUIP_CHECK_KEYS = EQUIP_CHECK_FIELDS.map((f) => f.key) as EquipoCheckKey[];

// Label of every installable checkbox (antena/sensor/módulo/elemento
// adicional — not "Control de instalación", which isn't checked, nor
// "Entradas / Salidas", which are electrical connections with nothing
// physical to photograph separately) — used to name the "what was checked"
// photo instead of the generic category (see post/[id]/page.tsx in the PWA
// and GALLERY_LABELS in printHtml.ts).
export const EQUIP_ITEM_PHOTO_LABEL: Record<string, string> = Object.fromEntries(
  EQUIP_GROUPS.filter((g) => g.title !== 'Control de instalación' && g.title !== 'Entradas / Salidas').flatMap((g) =>
    g.fields.filter((f) => 'checkbox' in f && f.checkbox === true).map((f) => [f.key, f.label] as const),
  ),
);

export type Equipo = Partial<Record<EquipoTextKey, string>> &
  Partial<Record<EquipoCheckKey, ChecklistValue>> & {
    // Solo aplica en modo 'retiro' (desinstalación): lo que se desinstala no
    // siempre es un equipo propiamente dicho con IMEI/N° de serie (puede ser
    // un sensor, accesorio, cableado, etc.) — ver la PWA's post/[id]/page.tsx,
    // paso "Equipo a desinstalar". Tildado, "Modelo" pasa a usarse como
    // descripción libre de lo desinstalado y el IMEI deja de ser obligatorio.
    equipoRetiradoSinSerie?: string;
    // Retiro only: keys (EQUIP_ITEM_PHOTO_LABEL) of extra sensors/modules/items also
    // uninstalled, comma-separated — each with its own photo gallery (slotKey = key).
    elementosRetirados?: string;
  };

// Campos `series: true` (cámaras ADAS / DSM): varios N° de serie en un solo texto, uno por línea. Se aceptan también comas
// o punto y coma por si se pega una lista.
export function seriesDe(valor: string | undefined | null): string[] {
  return (valor ?? '')
    .split(/[\n,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

// "A1" + salto de línea + "A2" -> "A1, A2" (PDF, panel, comentario del ticket).
export function formatSeries(valor: string | undefined | null): string {
  return seriesDe(valor).join(', ');
}

// Cantidad de cámaras ADAS cargadas: la cantidad de series; tildada sin series todavía cuenta 1.
export function cantidadCamarasAdas(equipo: Equipo): number {
  if (!equipo.camarasAdas) return 0;
  return Math.max(1, seriesDe(equipo.camarasAdasSerie).length);
}

export const CANALES_MDVR_OPTIONS = ['4', '8'] as const;

export function emptyEquipo(): Equipo {
  return {};
}

// Campos con `dependsOn` (ej. los detalles de IO1/IO2/AO1/AO2) solo se
// muestran — en el wizard, en el resumen del panel, o donde sea — cuando el
// checkbox del que dependen está tildado.
export function isEquipoFieldVisible(field: { key: string; dependsOn?: string }, equipo: Equipo): boolean {
  return !field.dependsOn || Boolean(equipo[field.dependsOn as EquipoTextKey | EquipoCheckKey]);
}

export function missingRequiredEquipoLabels(equipo: Equipo): string[] {
  const missing: string[] = [];
  for (const group of EQUIP_GROUPS) {
    for (const f of group.fields) {
      // A field with `dependsOn` becomes required as soon as the field it
      // depends on is checked — no point letting the técnico move on with
      // the checkbox ticked but no detail describing what it is.
      const isRequired = ('required' in f && f.required) || ('dependsOn' in f && f.dependsOn && isEquipoFieldVisible(f, equipo));
      if (isRequired && !equipo[f.key]?.trim()) {
        missing.push(f.label);
      }
    }
  }
  return missing;
}

// The "Control de instalación" check step is mandatory as a whole — every
// item must be explicitly answered SI/NO before the técnico can move on.
// Checked against the literal values (not just truthiness) so a record
// carrying a pre-migration boolean value isn't mistaken for an answer.
export function missingEquipoChecks(equipo: Equipo): (typeof EQUIP_CHECK_FIELDS)[number][] {
  return EQUIP_CHECK_FIELDS.filter((f) => equipo[f.key] !== 'SI' && equipo[f.key] !== 'NO');
}
