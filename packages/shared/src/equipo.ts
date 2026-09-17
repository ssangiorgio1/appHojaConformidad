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
      { key: 'antenaGsmInt', label: 'Antena GSM (Int)', checkbox: true },
      { key: 'antenaGsmExt', label: 'Antena GSM (Ext)', checkbox: true },
      { key: 'antenaGpsInt', label: 'Antena GPS (Int)', checkbox: true },
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
      { key: 'camarasAdasSerie', label: 'N° de serie (Cámaras ADAS)', dependsOn: 'camarasAdas' },
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
      { key: 'controlOdometro', label: 'Odómetro / Horómetro (km o hs)' },
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

export type Equipo = Partial<Record<EquipoTextKey, string>> & Partial<Record<EquipoCheckKey, ChecklistValue>>;

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
