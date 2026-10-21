import { describe, expect, it } from 'vitest';
import { trabajoDeHoja } from './liquidacionHoja.js';

describe('trabajoDeHoja', () => {
  it('instalación con IMEI y casillas con cantidad', () => {
    const t = trabajoDeHoja({
      tipoServicio: 'instalacion',
      equipo: { imei: '123', sensorTemperatura: 'SI', sensorTemperaturaCantidad: '2', modCMotor: 'SI', canbus: 'NO' } as never,
    });
    expect(t.equipoGps).toBe(true);
    expect(t.casillas).toEqual({ sensorTemperatura: 2, modCMotor: 1 });
  });
  it('desinstalación no suma casillas ni equipo', () => {
    const t = trabajoDeHoja({ tipoServicio: 'desinstalacion', equipo: { imei: '1', modCMotor: 'SI' } as never });
    expect(t.equipoGps).toBe(false);
    expect(t.casillas).toEqual({});
  });
});
