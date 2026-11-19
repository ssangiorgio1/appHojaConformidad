import { describe, expect, it } from 'vitest';
import { condicionesDeBusqueda } from './retiroEquipoBusqueda.js';

const regexDe = (c: Record<string, unknown>) => Object.values(c)[0] as RegExp;

describe('condicionesDeBusqueda (actas de retiro/entrega)', () => {
  it('busca en unidad, cliente, equipo, IMEI y quién entrega, sin importar mayúsculas', () => {
    const condiciones = condicionesDeBusqueda('ab 123');
    const campos = condiciones.flatMap((c) => Object.keys(c));
    expect(campos).toEqual(expect.arrayContaining(['subtareaNombre', 'clienteNombre', 'equipo.numero', 'equipo.imei', 'equiposExtra.numero', 'equipo.imei', 'entrega.nombre']));
    const re = regexDe(condiciones[0]);
    expect(re.test('AB 123 CD')).toBe(true);
    expect(re.test('XY 999 ZZ')).toBe(false);
  });

  it('un número busca además el ticket de Odoo exacto, con o sin "#"', () => {
    expect(condicionesDeBusqueda('41271')).toContainEqual({ ticketOdooId: 41271 });
    expect(condicionesDeBusqueda('#41271')).toContainEqual({ ticketOdooId: 41271 });
  });

  it('un texto que no es número no busca por ticket', () => {
    expect(condicionesDeBusqueda('genco').some((c) => 'ticketOdooId' in c)).toBe(false);
    expect(condicionesDeBusqueda('41271 abc').some((c) => 'ticketOdooId' in c)).toBe(false);
  });

  it('los caracteres especiales se buscan tal cual (no rompen la expresión)', () => {
    const re = regexDe(condicionesDeBusqueda('a.b(c')[0]);
    expect(re.test('xa.b(cx')).toBe(true);
    expect(re.test('axb(c')).toBe(false);
  });
});
