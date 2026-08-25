// Ported verbatim from hoja-de-conformidad-wara_1.html (EQUIP_GROUPS / EQUIP_CHECK_FIELDS).
// The 5 groups below are a UI grouping concern only — API and storage layers
// treat `equipo` as one flat object keyed by these field keys.
export const EQUIP_GROUPS = [
  {
    title: 'Datos del equipo',
    fields: [
      { key: 'modelo', label: 'Modelo' },
      { key: 'imei', label: 'IMEI' },
      { key: 'antenaGsmInt', label: 'Antena GSM (Int)' },
      { key: 'antenaGsmExt', label: 'Antena GSM (Ext)' },
      { key: 'antenaGpsInt', label: 'Antena GPS (Int)' },
      { key: 'antenaGpsExt', label: 'Antena GPS (Ext)' },
    ],
  },
  {
    title: 'Sensores',
    fields: [
      { key: 'sensorTemperatura', label: 'Temperatura' },
      { key: 'sensorAperturaPuertas', label: 'Apertura de puertas' },
      { key: 'sensorAperturaPSemi', label: 'Apertura p/semi' },
      { key: 'sensorGiro', label: 'Sensor de giro' },
      { key: 'canbus', label: 'CANBUS' },
      { key: 'trabaRobusta', label: 'Traba robusta' },
      { key: 'medComb', label: 'Medidor de combustible' },
      { key: 'desAcopSemi', label: 'Desacople / semi' },
    ],
  },
  {
    title: 'Módulos',
    fields: [
      { key: 'modCMotor', label: 'Corte de motor' },
      { key: 'modMicrofono', label: 'Micrófono' },
      { key: 'modBPanico', label: 'Botón de pánico' },
      { key: 'modBuzzerVelocidad', label: 'Buzzer velocidad' },
      { key: 'modIdConductor', label: 'Id. Conductor' },
      { key: 'modRFID', label: 'RFID' },
      { key: 'modDALLAS', label: 'DALLAS' },
      { key: 'modPantallaSerie', label: 'Pantalla N° serie' },
    ],
  },
  {
    title: 'Entradas / Salidas',
    fields: [
      { key: 'in1', label: 'Input 1' },
      { key: 'in2', label: 'Input 2' },
      { key: 'in3', label: 'Input 3' },
      { key: 'out1', label: 'Output 1' },
      { key: 'out2', label: 'Output 2' },
      { key: 'out3', label: 'Output 3' },
    ],
  },
  {
    title: 'Control de instalación',
    fields: [
      { key: 'controlSenalModem', label: 'Señal Modem' },
      { key: 'controlCantidadSatGps', label: 'Cantidad de Sat. GPS' },
      { key: 'controlBateriaInterna', label: 'Batería interna' },
      { key: 'controlAlimentacionExterna', label: 'Alimentación externa' },
    ],
  },
] as const;

export const EQUIP_CHECK_FIELDS = [
  { key: 'controlRevisionIgnicion', label: 'Revisión de ignición' },
  { key: 'controlRevisionPanico', label: 'Revisión de pánico' },
  { key: 'controlConexionRed', label: 'Conexión a la red' },
  { key: 'controlFotografiaVehiculo', label: 'Fotografía del vehículo' },
] as const;

export type EquipoTextKey = (typeof EQUIP_GROUPS)[number]['fields'][number]['key'];
export type EquipoCheckKey = (typeof EQUIP_CHECK_FIELDS)[number]['key'];

export const EQUIP_TEXT_KEYS = EQUIP_GROUPS.flatMap((g) => g.fields.map((f) => f.key)) as EquipoTextKey[];
export const EQUIP_CHECK_KEYS = EQUIP_CHECK_FIELDS.map((f) => f.key) as EquipoCheckKey[];

export type Equipo = Partial<Record<EquipoTextKey, string>> & Partial<Record<EquipoCheckKey, boolean>>;

export function emptyEquipo(): Equipo {
  return {};
}
