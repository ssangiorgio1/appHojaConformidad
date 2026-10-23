import { describe, expect, it } from 'vitest';
import { companerosDeTarea, nombresCompaneros } from './companeros.js';

const nombres = new Map<number, string>([
  [39, 'Renzo Gonzalez'],
  [288, 'Fernando Correa'],
  [71, 'Pablo Gonzalez'],
  [64, 'Equipo Técnico Gustavo'],
]);

describe('nombresCompaneros', () => {
  it('saca al propio técnico y deja a los demás', () => {
    expect(nombresCompaneros([288, 39], 39, nombres)).toEqual(['Fernando Correa']);
  });
  it('si está solo no tiene compañeros', () => {
    expect(nombresCompaneros([39], 39, nombres)).toEqual([]);
    expect(nombresCompaneros([], 39, nombres)).toEqual([]);
    expect(nombresCompaneros(undefined, 39, nombres)).toEqual([]);
  });
  it('no repite nombres y respeta el orden de asignación', () => {
    expect(nombresCompaneros([71, 288, 71], 39, nombres)).toEqual(['Pablo Gonzalez', 'Fernando Correa']);
  });
  it('un id sin nombre conocido se omite', () => {
    expect(nombresCompaneros([288, 9999], 39, nombres)).toEqual(['Fernando Correa']);
  });
});

describe('companerosDeTarea', () => {
  it('junta los del padre y los de las unidades, sin repetir ni incluirse', () => {
    expect(companerosDeTarea([64, 39], [{ technicianIds: [39, 288] }, { technicianIds: [288, 71] }], 39, nombres)).toEqual([
      'Equipo Técnico Gustavo',
      'Fernando Correa',
      'Pablo Gonzalez',
    ]);
  });
  it('una unidad sin asignar no suma a nadie', () => {
    expect(companerosDeTarea([39], [{ technicianIds: [] }], 39, nombres)).toEqual([]);
  });
});
