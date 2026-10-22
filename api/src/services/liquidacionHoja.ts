import type { CasillaInstalable } from '../config/productoMapeo.js';
import { cantidadCamarasAdas, type Equipo } from '@wara/shared';
import type { TrabajoLiquidable } from './liquidacion.service.js';

// Casillas de la hoja que cuentan para la liquidación; las que tienen `Cantidad` propia la leen de ahí.
const CASILLAS: CasillaInstalable[] = [
  'antenaGpsExt', 'sensorTemperatura', 'sensorAperturaPuertas', 'sensorAperturaPSemi', 'sensorGiro', 'canbus',
  'medComb', 'desAcopSemi', 'modCMotor', 'modMicrofono', 'modBPanico', 'modBuzzerVelocidad', 'modIdConductor',
  'modRFID', 'modPantallaSerie',
];

export interface HojaLiquidable {
  tipoServicio: TrabajoLiquidable['tipoServicio'];
  equipo?: Equipo | null;
}

// Qué se instaló en una hoja completa, en los términos de la tabla de coeficientes. Las visitas fallidas no salen de
// acá: viven en las incidencias, no en la hoja.
export function trabajoDeHoja(h: HojaLiquidable): TrabajoLiquidable {
  const equipo = (h.equipo ?? {}) as Record<string, string | null | undefined>;
  const casillas: Partial<Record<CasillaInstalable, number>> = {};
  if (h.tipoServicio === 'instalacion') {
    for (const key of CASILLAS) {
      if (equipo[key] !== 'SI') continue;
      const n = Number(equipo[`${key}Cantidad`]);
      casillas[key] = Number.isFinite(n) && n > 0 ? n : 1;
    }
    const adas = cantidadCamarasAdas(h.equipo ?? {});
    if (adas > 0) casillas.camarasAdas = adas;
  }
  return {
    tipoServicio: h.tipoServicio,
    // El IMEI ya no se tipea: alcanza con el N° de equipo (`modelo`) o con el IMEI si el QR lo trajo. "No es un equipo con
    // N° de equipo" (solo sensor/módulo) no cuenta como equipo GPS.
    equipoGps:
      h.tipoServicio === 'instalacion' && !equipo.equipoInstaladoSinSerie?.trim() && Boolean(equipo.imei?.trim() || equipo.modelo?.trim()),
    casillas,
  };
}
