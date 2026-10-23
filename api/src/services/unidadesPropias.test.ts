import { describe, expect, it } from 'vitest';
import { unidadesAsignadas, unidadesPropias } from './unidadesPropias.js';

const YO = 288;
const OTRO = 39;

describe('unidadesPropias (qué unidades cuentan para cerrar la visita)', () => {
  it('cuenta las asignadas al técnico', () => {
    expect(unidadesPropias([{ id: 1, name: 'AA', user_ids: [YO] }], YO)).toEqual([1]);
  });

  it('cuenta también las que no tienen técnico asignado: en la pantalla le aparecen y le quedan por hacer', () => {
    expect(unidadesPropias([{ id: 1, name: 'AA', user_ids: [YO] }, { id: 2, name: 'BB', user_ids: [] }, { id: 3, name: 'CC' }], YO)).toEqual([1, 2, 3]);
  });

  it('no cuenta las asignadas solo a otro técnico', () => {
    expect(unidadesPropias([{ id: 1, name: 'AA', user_ids: [YO] }, { id: 2, name: 'BB', user_ids: [OTRO] }], YO)).toEqual([1]);
  });

  it('una unidad compartida con otro técnico, si él está asignado, cuenta', () => {
    expect(unidadesPropias([{ id: 1, name: 'AA', user_ids: [OTRO, YO] }], YO)).toEqual([1]);
  });

  it('una misma unidad cargada como 2 tareas con el mismo nombre cuenta una sola vez, con el id menor', () => {
    expect(
      unidadesPropias(
        [
          { id: 9, name: 'QEW233', user_ids: [YO] },
          { id: 5, name: 'QEW233', user_ids: [] },
        ],
        YO,
      ),
    ).toEqual([5]);
  });

  it('si una de las tareas del grupo es de otro y la otra no tiene a nadie, el grupo es de otro (igual que en la pantalla)', () => {
    expect(
      unidadesPropias(
        [
          { id: 5, name: 'ZZ', user_ids: [OTRO] },
          { id: 6, name: 'ZZ', user_ids: [] },
        ],
        YO,
      ),
    ).toEqual([]);
  });

  it('un lote sin unidades no tiene propias', () => {
    expect(unidadesPropias([], YO)).toEqual([]);
  });

  it('lo que sumó coordinación sin asignar mientras trabajaba mantiene la visita abierta', () => {
    const resueltas = new Set([1, 2]);
    const unidades = [
      { id: 1, name: 'AA', user_ids: [YO] },
      { id: 2, name: 'BB', user_ids: [YO] },
      { id: 3, name: 'CC', user_ids: [] },
    ];
    const propias = unidadesPropias(unidades, YO);
    expect(propias.every((id) => resueltas.has(id))).toBe(false);
  });
});

describe('unidadesAsignadas (condición para el cierre automático)', () => {
  it('cuenta solo las asignadas explícitamente al técnico', () => {
    const unidades = [
      { id: 1, name: 'AA', user_ids: [YO] },
      { id: 2, name: 'BB', user_ids: [] },
      { id: 3, name: 'CC', user_ids: [OTRO] },
    ];
    expect(unidadesAsignadas(unidades, YO)).toEqual([1]);
    expect(unidadesPropias(unidades, YO)).toEqual([1, 2]);
  });

  it('un lote donde todas las unidades están sin asignar no tiene "asignadas": el cierre sigue siendo manual', () => {
    const unidades = [{ id: 1, name: 'AA' }, { id: 2, name: 'BB', user_ids: [] }];
    expect(unidadesAsignadas(unidades, YO)).toEqual([]);
    expect(unidadesPropias(unidades, YO)).toEqual([1, 2]);
  });
});
