import { describe, expect, it } from 'vitest';
import { IMEI_RE, parseNumeroEquipo } from './stockEquipo.service.js';

describe('parseNumeroEquipo', () => {
  it('acepta sólo un número de equipo', () => {
    expect(parseNumeroEquipo('2408912')).toBe('2408912');
    expect(parseNumeroEquipo(' 2601993\n')).toBe('2601993');
  });

  it('descarta "no encontrado" y los formatos de stock viejo', () => {
    expect(parseNumeroEquipo('No est� en la base de datos')).toBeNull();
    expect(parseNumeroEquipo('Stock 396 (Tanda 23)')).toBeNull();
    expect(parseNumeroEquipo('')).toBeNull();
  });
});

describe('IMEI_RE', () => {
  it('exige 15 dígitos', () => {
    expect(IMEI_RE.test('869131070316214')).toBe(true);
    expect(IMEI_RE.test('86913107031621')).toBe(false);
    expect(IMEI_RE.test('abc')).toBe(false);
  });
});
