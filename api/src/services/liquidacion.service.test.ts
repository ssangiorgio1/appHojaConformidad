import { describe, expect, it } from 'vitest';
import { calcularPuntos, liquidarTrabajo } from './liquidacion.service.js';

const params = { valorCoeficiente: 1000, adicionalZona: [0, 500, null, null, null] as Array<number | null> };

describe('calcularPuntos', () => {
  it('equipo GPS solo vale 1,00', () => {
    expect(calcularPuntos({ tipoServicio: 'instalacion', equipoGps: true }).puntos).toBe(1);
  });

  it('GPS + apertura de puerta de carga = 2,75 (columna "+ Equipo GPS")', () => {
    const r = calcularPuntos({ tipoServicio: 'instalacion', equipoGps: true, casillas: { sensorAperturaPSemi: 1 } });
    expect(r.puntos).toBe(2.75);
  });

  it('GPS + buzzer = 1,50 (la excepción de la tabla)', () => {
    expect(calcularPuntos({ tipoServicio: 'instalacion', equipoGps: true, casillas: { modBuzzerVelocidad: 1 } }).puntos).toBe(1.5);
  });

  it('sensor sin GPS usa la columna "solo"', () => {
    expect(calcularPuntos({ tipoServicio: 'instalacion', casillas: { sensorTemperatura: 1 } }).puntos).toBe(2);
  });

  it('con GPS y dos sensores, uno va con GPS y el otro solo', () => {
    const r = calcularPuntos({ tipoServicio: 'instalacion', equipoGps: true, casillas: { modCMotor: 1, medComb: 1 } });
    // varilla con GPS (4,00) + corte de motor solo (0,75)
    expect(r.puntos).toBe(4.75);
  });

  it('las casillas sin coeficiente se informan y no suman', () => {
    const r = calcularPuntos({ tipoServicio: 'instalacion', equipoGps: true, casillas: { camarasAdas: 2 } });
    expect(r.puntos).toBe(1);
    expect(r.sinCoeficiente).toEqual(['camarasAdas']);
  });

  it('desinstalación y visita fallida', () => {
    expect(calcularPuntos({ tipoServicio: 'desinstalacion' }).puntos).toBe(0.5);
    expect(calcularPuntos({ tipoServicio: 'instalacion', equipoGps: true, visitaFallida: true }).puntos).toBe(0.6);
  });
});

describe('liquidarTrabajo', () => {
  it('suma base de Odoo + extra por coeficiente + adicional de zona', () => {
    const r = liquidarTrabajo({ tipoServicio: 'instalacion', equipoGps: true, baseOdoo: 10000, zonaIndice: 1 }, params);
    expect(r.extraCoeficiente).toBe(1000);
    expect(r.adicionalZona).toBe(500);
    expect(r.total).toBe(11500);
  });

  it('sin valor del punto o sin base, el total queda en blanco pero los puntos se calculan', () => {
    const sinValor = liquidarTrabajo({ tipoServicio: 'instalacion', equipoGps: true, baseOdoo: 10000 }, { ...params, valorCoeficiente: null });
    expect(sinValor.puntos).toBe(1);
    expect(sinValor.total).toBeNull();
    expect(liquidarTrabajo({ tipoServicio: 'instalacion', equipoGps: true }, params).total).toBeNull();
  });

  it('zona sin adicional definido deja el total en blanco', () => {
    const r = liquidarTrabajo({ tipoServicio: 'instalacion', equipoGps: true, baseOdoo: 1, zonaIndice: 2 }, params);
    expect(r.adicionalZona).toBeNull();
    expect(r.total).toBeNull();
  });
});
