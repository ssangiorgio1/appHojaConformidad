import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sort: vi.fn(),
  exists: vi.fn(),
  updateMany: vi.fn(),
  findOneAndUpdate: vi.fn(),
  find: vi.fn(),
}));

vi.mock('../config/env.js', () => ({ env: {} }));
vi.mock('../models/VisitaNotificacion.js', () => ({
  VisitaNotificacionModel: {
    find: (...args: unknown[]) => {
      mocks.find(...args);
      return { sort: mocks.sort };
    },
    exists: mocks.exists,
    updateMany: mocks.updateMany,
    findOneAndUpdate: mocks.findOneAndUpdate,
  },
}));

import { cerrarVisitasAbiertasDeDiasAnteriores } from './telegram.service.js';

const visita = (id: string, fecha: string) => ({ _id: id, fecha });

describe('cerrarVisitasAbiertasDeDiasAnteriores', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((m) => m.mockReset());
    mocks.sort.mockResolvedValue([]);
    mocks.exists.mockResolvedValue(null);
    mocks.updateMany.mockResolvedValue({ modifiedCount: 1 });
    mocks.findOneAndUpdate.mockImplementation(async (filter: { _id: string }) => ({ _id: filter._id, cerrada: true }));
  });

  it('solo mira las fechas ANTERIORES del mismo técnico y tarea (las posteriores no se tocan)', async () => {
    await cerrarVisitasAbiertasDeDiasAnteriores(23335, 'tec1', '2026-11-16');
    expect(mocks.find).toHaveBeenCalledWith({ tareaOdooId: 23335, tecnicoId: 'tec1', abierta: true, fecha: { $lt: '2026-11-16' } });
  });

  it('sin visitas abiertas de días anteriores no hace nada', async () => {
    expect(await cerrarVisitasAbiertasDeDiasAnteriores(23335, 'tec1', '2026-11-16')).toBeNull();
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
  });

  // El caso real: la visita de hace 4 días siguió abierta, se trabajó hoy sin volver a "Llegué" y al terminar quedaba pegado el banner.
  it('si hoy no hay visita abierta, la de un día anterior es la que se cierra y se devuelve', async () => {
    mocks.sort.mockResolvedValue([visita('v12', '2026-11-12')]);
    const r = await cerrarVisitasAbiertasDeDiasAnteriores(23335, 'tec1', '2026-11-16');
    expect(r).toMatchObject({ _id: 'v12', cerrada: true });
    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith({ _id: 'v12', abierta: true }, { $set: { estado: 'completo', abierta: false } }, { new: true });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it('con varias abiertas de días anteriores, la más reciente se completa y las otras se cierran', async () => {
    mocks.sort.mockResolvedValue([visita('v14', '2026-11-14'), visita('v12', '2026-11-12')]);
    const r = await cerrarVisitasAbiertasDeDiasAnteriores(23335, 'tec1', '2026-11-16');
    expect(r).toMatchObject({ _id: 'v14' });
    expect(mocks.updateMany).toHaveBeenCalledTimes(1);
    expect(mocks.updateMany.mock.calls[0][0]).toMatchObject({ _id: { $in: ['v12'] } });
    expect(mocks.updateMany.mock.calls[0][1].$set).toMatchObject({ estado: 'completo', abierta: false });
  });

  it('si hoy ya hay una abierta, sigue su curso normal y las anteriores se cierran', async () => {
    mocks.exists.mockResolvedValue({ _id: 'hoy' });
    mocks.sort.mockResolvedValue([visita('v12', '2026-11-12')]);
    expect(await cerrarVisitasAbiertasDeDiasAnteriores(23335, 'tec1', '2026-11-16')).toBeNull();
    expect(mocks.updateMany.mock.calls[0][0]).toMatchObject({ _id: { $in: ['v12'] } });
    expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('nunca tira: ante un error de la base se sigue con el cierre de siempre', async () => {
    mocks.sort.mockRejectedValue(new Error('mongo caído'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await cerrarVisitasAbiertasDeDiasAnteriores(23335, 'tec1', '2026-11-16')).toBeNull();
    log.mockRestore();
  });
});
