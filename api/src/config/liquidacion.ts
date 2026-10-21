// Liquidación de técnicos: coeficientes por trabajo realizado y adicional fijo por zona.
// Fuente de los coeficientes: "Coeficientes (2) (1).pdf", columna "Coeficiente A", trabajos desde el 2024-12-01
// (ver docs-liquidacion-coeficientes.md). La tabla se carga tal cual, sin calcular: hay excepciones (Buzzer).
import type { CasillaInstalable } from './productoMapeo.js';

export interface CoeficienteItem {
  nombre: string;
  /** El ítem solo (sin instalar equipo GPS en la misma visita). */
  solo: number;
  /** El ítem junto con la instalación del equipo GPS (incluye los 1,00 del equipo). */
  conGps: number;
}

export type ItemSensor =
  | 'corteMotor'
  | 'puertaCabina'
  | 'puertaCarga'
  | 'fichaTrailer'
  | 'fichaVulcanizada'
  | 'buzzer'
  | 'canbus'
  | 'varilla'
  | 'microfono'
  | 'giro'
  | 'rfid'
  | 'temperatura'
  | 'pantalla';

export const COEFICIENTES_ITEM: Record<ItemSensor, CoeficienteItem> = {
  corteMotor: { nombre: 'Corte de motor', solo: 0.75, conGps: 1.75 },
  puertaCabina: { nombre: 'Apertura de puerta de cabina', solo: 0.75, conGps: 1.75 },
  puertaCarga: { nombre: 'Apertura de puerta de carga', solo: 1.75, conGps: 2.75 },
  fichaTrailer: { nombre: 'Desenganche ficha tráiler', solo: 1.15, conGps: 2.15 },
  fichaVulcanizada: { nombre: 'Desenganche ficha vulcanizada', solo: 0.9, conGps: 1.9 },
  buzzer: { nombre: 'Buzzer', solo: 1.0, conGps: 1.5 },
  canbus: { nombre: 'CANBUS', solo: 1.0, conGps: 2.0 },
  varilla: { nombre: 'Varilla', solo: 3.0, conGps: 4.0 },
  microfono: { nombre: 'Micrófono', solo: 0.75, conGps: 1.75 },
  giro: { nombre: 'Sensor/módulo de giro', solo: 0.9, conGps: 1.9 },
  rfid: { nombre: 'Módulo RFID', solo: 0.75, conGps: 1.75 },
  temperatura: { nombre: 'Sensor de temperatura', solo: 2.0, conGps: 3.0 },
  pantalla: { nombre: 'Pantalla', solo: 1.15, conGps: 2.15 },
};

// Trabajos sin sensores.
export const COEFICIENTES_TRABAJO = {
  instalacionGps: 1.0, // incluye pánico, caja estanca y SIM Vodafone; también entrega de backup/personal
  desinstalacion: 0.5, // desinstalación / cambio de unidad
  reparacionTecnica: 0.9, // ignición, masa, reubicación de equipo, fusible
  reparacionCambioEquipo: 0.75, // cambio de equipo, tornillos, precintos, pegado
  reparacionCambioSensor: 0.75,
  pantallaReparacion: 0.9,
  revisionTecnica: 0.75,
  visitaFallida: 0.6, // también entrega de tarjetas RFID
} as const;

// Casilla de la PWA -> ítem de la tabla. `revisar`: la correspondencia es una suposición a confirmar.
// Las casillas que no están acá (botón de pánico, cámaras, wifi, Starlink, antena, identificador de chofer) no
// tienen coeficiente en la tabla: la liquidación las informa en `sinCoeficiente` y no suman puntos.
export const CASILLA_A_ITEM: Partial<Record<CasillaInstalable, { item: ItemSensor; revisar?: string }>> = {
  modCMotor: { item: 'corteMotor' },
  sensorAperturaPuertas: { item: 'puertaCabina', revisar: 'se multiplica por la cantidad de puertas' },
  sensorAperturaPSemi: { item: 'puertaCarga', revisar: 'apertura de acoplado asumida como puerta de carga' },
  desAcopSemi: { item: 'fichaTrailer', revisar: 'no distingue ficha tráiler de vulcanizada' },
  modBuzzerVelocidad: { item: 'buzzer' },
  canbus: { item: 'canbus' },
  medComb: { item: 'varilla' },
  modMicrofono: { item: 'microfono' },
  sensorGiro: { item: 'giro' },
  modRFID: { item: 'rfid' },
  sensorTemperatura: { item: 'temperatura' },
  modPantallaSerie: { item: 'pantalla' },
};

// Adicional fijo (en pesos) por zona de distancia desde la oficina, índice 0 = Zona 1 (ver zonaPorRadio en el panel).
// `null` = todavía no definido: la liquidación calcula los puntos y deja el monto en blanco.
export const ADICIONAL_ZONA: ReadonlyArray<number | null> = [null, null, null, null, null];

// Valor en pesos de 1,00 punto de coeficiente. `null` = todavía no definido.
export const VALOR_COEFICIENTE: number | null = null;
