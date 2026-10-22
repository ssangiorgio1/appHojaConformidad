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

describe('equipoGps sin IMEI', () => {
  it('cuenta un equipo identificado solo por su N° de equipo', () => {
    expect(trabajoDeHoja({ tipoServicio: 'instalacion', equipo: { modelo: '2408912' } as never }).equipoGps).toBe(true);
  });
  it('un sensor o módulo ("no es un equipo con N° de equipo") no es equipo GPS', () => {
    expect(trabajoDeHoja({ tipoServicio: 'instalacion', equipo: { modelo: 'sensor', equipoInstaladoSinSerie: 'Sí' } as never }).equipoGps).toBe(false);
  });
  it('sin N° de equipo ni IMEI no hay equipo GPS', () => {
    expect(trabajoDeHoja({ tipoServicio: 'instalacion', equipo: {} as never }).equipoGps).toBe(false);
  });
});
