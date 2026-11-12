import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ asignacion: vi.fn(), usuarios: vi.fn(), guardadas: vi.fn(), bulkWrite: vi.fn() }));
vi.mock('./calendarTask.service.js', () => ({ asignacionDeTareaEnOdoo: (...a: unknown[]) => mocks.asignacion(...a) }));
vi.mock('../models/Usuario.js', () => ({ UsuarioModel: { find: (...a: unknown[]) => ({ select: () => mocks.usuarios(...a) }) } }));
vi.mock('../models/AgendaCompartida.js', () => ({
  AgendaCompartidaModel: {
    find: (...a: unknown[]) => ({ lean: () => mocks.guardadas(...a), limit: () => ({ lean: () => Promise.resolve([]) }) }),
    bulkWrite: (...a: unknown[]) => mocks.bulkWrite(...a),
  },
}));

import { fechaArDeOdoo, refrescarCompartidaDeTarea } from './agendaCompartida.service.js';

describe('fechaArDeOdoo: la fecha de la tarea en hora de Argentina (la misma que usa la PWA para el viaje)', () => {
  it('una tarea a las 13:00 UTC es del mismo día en Argentina', () => {
    expect(fechaArDeOdoo('2026-11-11 13:00:00')).toBe('2026-11-11');
  });
  it('una tarea a las 01:30 UTC todavía es del día anterior en Argentina', () => {
    expect(fechaArDeOdoo('2026-11-12 01:30:00')).toBe('2026-11-11');
  });
  it('un valor que no es fecha no se guarda', () => {
    expect(fechaArDeOdoo('basura')).toBeNull();
  });
});

describe('refrescarCompartidaDeTarea: al salir hacia destino se rehace lo guardado de todos los técnicos de la tarea', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((m) => m.mockReset());
    // Hoy en Odoo cada uno tiene su unidad; ayer los dos estaban en las dos.
    mocks.asignacion.mockResolvedValue({
      asignadosDelPadre: [290, 295],
      unidades: [
        { name: '444sss33', technicianIds: [295] },
        { name: 'AB123CD', technicianIds: [290] },
      ],
    });
    mocks.usuarios.mockResolvedValue([
      { _id: 'atilio', odooUserId: 290 },
      { _id: 'joaquin', odooUserId: 295 },
    ]);
    mocks.guardadas.mockResolvedValue([{ usuarioId: 'atilio' }, { usuarioId: 'joaquin' }, { usuarioId: 'sacado' }]);
  });

  it('el que no actualizó su agenda deja de figurar como compañero de viaje', async () => {
    await refrescarCompartidaDeTarea(20404, '2026-11-11');
    const ops = mocks.bulkWrite.mock.calls[0][0] as Array<{ updateOne: { filter: { usuarioId: string }; update: { $set: { companerosOdooIds: number[] } } } }>;
    const por = Object.fromEntries(ops.map((o) => [o.updateOne.filter.usuarioId, o.updateOne.update.$set.companerosOdooIds]));
    expect(por).toEqual({ atilio: [], joaquin: [], sacado: [] });
  });

  it('si comparten una unidad, queda guardado para los dos', async () => {
    mocks.asignacion.mockResolvedValue({ asignadosDelPadre: [290, 295], unidades: [{ name: '444sss33', technicianIds: [295, 290] }] });
    const mapa = await refrescarCompartidaDeTarea(20404, '2026-11-11');
    expect(mapa?.get(295)).toEqual([290]);
    const ops = mocks.bulkWrite.mock.calls[0][0] as Array<{ updateOne: { filter: { usuarioId: string }; update: { $set: { companerosOdooIds: number[] } } } }>;
    expect(ops.find((o) => o.updateOne.filter.usuarioId === 'joaquin')?.updateOne.update.$set.companerosOdooIds).toEqual([290]);
  });

  it('si falla Mongo, igual devuelve la asignación de Odoo para decidir el viaje', async () => {
    mocks.bulkWrite.mockRejectedValue(new Error('Mongo caído'));
    const mapa = await refrescarCompartidaDeTarea(20404, '2026-11-11');
    expect(mapa?.get(290)).toEqual([]);
  });
});
