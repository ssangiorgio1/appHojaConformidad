import { describe, expect, it } from 'vitest';
import { companerosDeTarea, companerosPorTecnico, idsCompanerosDeTarea, nombresCompaneros } from './companeros.js';

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
  it('con unidades: solo los que comparten alguna unidad, sin repetir ni incluirse (el padre no cuenta)', () => {
    expect(companerosDeTarea([64, 39], [{ technicianIds: [39, 288] }, { technicianIds: [288, 71] }], 39, nombres)).toEqual([
      'Fernando Correa',
      'Pablo Gonzalez',
    ]);
  });
  it('los dos en la tarea padre pero cada uno con su unidad: no comparten (cada uno hace su viaje)', () => {
    // Caso de prueba del 11/11: jsangiorgio en una unidad, el otro técnico en la otra, los dos en el padre.
    expect(companerosDeTarea([39, 288], [{ technicianIds: [39] }], 39, nombres)).toEqual([]);
    expect(idsCompanerosDeTarea([39, 288], [{ technicianIds: [39] }], 39)).toEqual([]);
  });
  it('tarea sin unidades: cuentan los asignados a la tarea misma', () => {
    expect(companerosDeTarea([39, 288], [], 39, nombres)).toEqual(['Fernando Correa']);
    expect(idsCompanerosDeTarea([39, 288], [], 39)).toEqual([288]);
  });
  it('una unidad sin otro asignado no suma a nadie', () => {
    expect(companerosDeTarea([39], [{ technicianIds: [] }], 39, nombres)).toEqual([]);
  });
});

describe('companerosPorTecnico: con quién viaja cada técnico, según la asignación leída de Odoo', () => {
  it('antes los dos en las 2 unidades; coordinación deja a cada uno en una: ya no comparten', () => {
    const r = companerosPorTecnico([290, 295], [
      { name: '444sss33', technicianIds: [295] },
      { name: 'AB123CD', technicianIds: [290] },
    ]);
    expect(r.get(295)).toEqual([]);
    expect(r.get(290)).toEqual([]);
  });

  it('una unidad en común alcanza para viajar juntos', () => {
    const r = companerosPorTecnico([290, 295], [
      { name: '444sss33', technicianIds: [295, 290] },
      { name: 'AB123CD', technicianIds: [290] },
    ]);
    expect(r.get(295)).toEqual([290]);
    expect(r.get(290)).toEqual([295]);
  });

  it('el que está solo en la tarea padre no comparte con nadie', () => {
    const r = companerosPorTecnico([39, 290], [{ name: '444sss33', technicianIds: [290] }]);
    expect(r.get(39)).toEqual([]);
    expect(r.get(290)).toEqual([]);
  });

  it('dos tareas de Odoo con el mismo nombre son la misma unidad (como en la agenda)', () => {
    const r = companerosPorTecnico([], [
      { name: 'QEW233', technicianIds: [290] },
      { name: 'QEW233', technicianIds: [295] },
    ]);
    expect(r.get(295)).toEqual([290]);
  });

  it('sin subtareas, todos los asignados a la tarea viajan juntos', () => {
    const r = companerosPorTecnico([290, 295, 39], []);
    expect(r.get(290)).toEqual([295, 39]);
  });
});
