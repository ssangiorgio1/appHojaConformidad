import { describe, expect, it } from 'vitest';
import { unirUsuarios } from './calendarTask.service.js';

describe('unirUsuarios', () => {
  it('junta las listas sin repetir ids y ordena por nombre', () => {
    const r = unirUsuarios([{ id: 2, name: 'Zoe' }, { id: 1, name: 'Alex Lima' }], [{ id: 2, name: 'Zoe (otro)' }, { id: 3, name: 'Mario' }]);
    expect(r).toEqual([{ id: 1, name: 'Alex Lima' }, { id: 3, name: 'Mario' }, { id: 2, name: 'Zoe' }]);
  });
  it('sin listas devuelve vacío', () => {
    expect(unirUsuarios()).toEqual([]);
    expect(unirUsuarios([], [])).toEqual([]);
  });
});
