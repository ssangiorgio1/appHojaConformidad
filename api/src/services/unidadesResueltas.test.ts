import { describe, expect, it } from 'vitest';
import { estadosPorUnidad, type HojaDeUnidad } from './unidadesResueltas.service.js';

// Dos técnicos en la misma tarea (los dos asignados a todas las unidades): cada uno tiene que ver cuál hizo él, cuál hizo
// su compañero y cuál está haciendo el compañero, para no hacerlas dos veces.
const nombres = new Map([
  ['yo', 'Fernando Correa'],
  ['pablo', 'Pablo Vega'],
]);
const hoja = (sub: number, tecnicoId: string, status: string, extra: Partial<HojaDeUnidad> = {}): HojaDeUnidad => ({
  subtareaOdoo: { id: sub },
  tecnicoId,
  status,
  updatedAt: new Date('2026-11-10T15:00:00Z'),
  ...extra,
});

describe('estadosPorUnidad', () => {
  it('dice quién hizo cada unidad y si fue uno mismo', () => {
    const r = estadosPorUnidad([hoja(1, 'yo', 'completo'), hoja(2, 'pablo', 'completo')], nombres, 'yo');
    expect(r).toEqual([
      { subtareaOdooId: 1, estado: 'completo', nombre: 'Fernando Correa', esUnoMismo: true },
      { subtareaOdooId: 2, estado: 'completo', nombre: 'Pablo Vega', esUnoMismo: false },
    ]);
  });

  it('una unidad con PRE o POST empezado figura en curso, con quién la está haciendo', () => {
    expect(estadosPorUnidad([hoja(3, 'pablo', 'borrador_pre'), hoja(4, 'pablo', 'pendiente_post')], nombres, 'yo')).toEqual([
      { subtareaOdooId: 3, estado: 'en_curso', nombre: 'Pablo Vega', esUnoMismo: false },
      { subtareaOdooId: 4, estado: 'en_curso', nombre: 'Pablo Vega', esUnoMismo: false },
    ]);
  });

  it('una hoja completa manda sobre otra en curso de la misma unidad, aunque la en curso sea más nueva', () => {
    const r = estadosPorUnidad(
      [hoja(5, 'pablo', 'completo'), hoja(5, 'yo', 'borrador_pre', { updatedAt: new Date('2026-11-10T16:00:00Z') })],
      nombres,
      'yo',
    );
    expect(r).toEqual([{ subtareaOdooId: 5, estado: 'completo', nombre: 'Pablo Vega', esUnoMismo: false }]);
  });

  it('si el POST lo cerró otro técnico, cuenta el que lo cerró', () => {
    const r = estadosPorUnidad([hoja(6, 'pablo', 'completo', { tecnicoIdPost: 'yo' })], nombres, 'yo');
    expect(r[0]).toMatchObject({ nombre: 'Fernando Correa', esUnoMismo: true });
  });

  it('sin nombre conocido o sin unidad, no se inventa nada', () => {
    expect(estadosPorUnidad([hoja(7, 'desconocido', 'completo'), { status: 'completo', tecnicoId: 'yo' }], nombres, 'yo')).toEqual([]);
  });
});
