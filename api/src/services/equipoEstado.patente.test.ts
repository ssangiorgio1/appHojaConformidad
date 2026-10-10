import { describe, expect, it } from 'vitest';
import { patenteDeTexto } from './equipoEstado.service.js';

describe('patenteDeTexto', () => {
  it('saca la patente de un texto con interno y separadores', () => {
    expect(patenteDeTexto('217 - AB 054 AQ')).toBe('AB054AQ');
    expect(patenteDeTexto('ab054aq')).toBe('AB054AQ');
    expect(patenteDeTexto('AC 278 ZG')).toBe('AC278ZG');
  });
  it('reconoce la patente vieja', () => {
    expect(patenteDeTexto('ABC 123')).toBe('ABC123');
  });
  it('no inventa patentes en un número de equipo o un IMEI', () => {
    expect(patenteDeTexto('868450041104413')).toBeNull();
    expect(patenteDeTexto('t14s398')).toBeNull();
  });
});
