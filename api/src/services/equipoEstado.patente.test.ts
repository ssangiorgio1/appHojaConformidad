import { describe, expect, it } from 'vitest';
import { patenteDeTexto, patentesDeTexto } from './equipoEstado.service.js';

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
  // Caso real: la unidad se llama "CASE SR220" y la patente es "EFW 042". Compactar todo el texto armaba "ESR220".
  it('toma la patente aunque el texto traiga un interno con letras y números', () => {
    expect(patenteDeTexto('CASE SR220 (EFW 042)')).toBe('EFW042');
    expect(patenteDeTexto('Case SR 220 (EFW 042)')).toBe('EFW042');
    expect(patenteDeTexto('EFW 042')).toBe('EFW042');
    expect(patenteDeTexto('EFW-042')).toBe('EFW042');
  });
  it('un interno sin patente no se confunde con una', () => {
    expect(patenteDeTexto('CASE SR220')).toBeNull();
    expect(patenteDeTexto('Case SR 220B')).toBeNull();
  });
  it('no parte una palabra para sacar una patente de adentro', () => {
    expect(patenteDeTexto('ABC1234')).toBeNull();
    expect(patenteDeTexto('XABC123')).toBeNull();
  });
});

describe('patentesDeTexto', () => {
  it('devuelve todas las patentes del texto, sin repetir y en orden', () => {
    expect(patentesDeTexto('AB 123 CD / EFW 042')).toEqual(['AB123CD', 'EFW042']);
    expect(patentesDeTexto('EFW 042 - efw042')).toEqual(['EFW042']);
  });
  it('lista vacía si no hay ninguna', () => {
    expect(patentesDeTexto('CASE SR220')).toEqual([]);
  });
});
