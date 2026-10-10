import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  visitasFind: vi.fn(),
  visitasUpdateMany: vi.fn(),
  conformidadDistinct: vi.fn(),
  incidenciaDistinct: vi.fn(),
  retiroDistinct: vi.fn(),
  getAllSubtaskIds: vi.fn(),
}));

vi.mock('../models/VisitaNotificacion.js', () => ({
  VisitaNotificacionModel: { find: () => ({ select: mocks.visitasFind }), updateMany: mocks.visitasUpdateMany },
}));
vi.mock('../models/Conformidad.js', () => ({ ConformidadModel: { find: () => ({ distinct: mocks.conformidadDistinct }) } }));
vi.mock('../models/SubtareaIncidencia.js', () => ({ SubtareaIncidenciaModel: { find: () => ({ distinct: mocks.incidenciaDistinct }) } }));
vi.mock('../models/RetiroEquipo.js', () => ({ RetiroEquipoModel: { find: () => ({ distinct: mocks.retiroDistinct }) } }));
vi.mock('../models/Usuario.js', () => ({ UsuarioModel: {} }));
vi.mock('./calendarTask.service.js', () => ({ getAllSubtaskIds: mocks.getAllSubtaskIds, getOwnSubtaskIds: vi.fn() }));
vi.mock('./telegram.service.js', () => ({ notificarEstadoVisita: vi.fn() }));

import { cerrarVisitasAjenasSiTodoResuelto } from './loteVisita.service.js';

describe('cerrarVisitasAjenasSiTodoResuelto', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((m) => m.mockReset());
    mocks.visitasFind.mockResolvedValue([{ _id: 'v1' }]);
    mocks.visitasUpdateMany.mockResolvedValue({ modifiedCount: 1 });
    mocks.conformidadDistinct.mockResolvedValue([]);
    mocks.incidenciaDistinct.mockResolvedValue([]);
    mocks.retiroDistinct.mockResolvedValue([]);
  });

  it('cierra la visita del otro técnico cuando todas las unidades están resueltas (aunque las hizo uno solo)', async () => {
    mocks.getAllSubtaskIds.mockResolvedValue([1, 2]);
    mocks.conformidadDistinct.mockResolvedValue([1, 2]);
    expect(await cerrarVisitasAjenasSiTodoResuelto(10, 'tecA')).toBe(1);
    expect(mocks.visitasUpdateMany).toHaveBeenCalled();
  });

  it('cuenta las actas de retiro/entrega y las unidades reportadas como resueltas', async () => {
    mocks.getAllSubtaskIds.mockResolvedValue([1, 2]);
    mocks.retiroDistinct.mockResolvedValue([1]);
    mocks.incidenciaDistinct.mockResolvedValue([2]);
    expect(await cerrarVisitasAjenasSiTodoResuelto(10, 'tecA')).toBe(1);
  });

  it('no cierra nada si queda una unidad sin resolver', async () => {
    mocks.getAllSubtaskIds.mockResolvedValue([1, 2]);
    mocks.conformidadDistinct.mockResolvedValue([1]);
    expect(await cerrarVisitasAjenasSiTodoResuelto(10, 'tecA')).toBe(0);
    expect(mocks.visitasUpdateMany).not.toHaveBeenCalled();
  });

  it('en una tarea suelta alcanza con una hoja completa', async () => {
    mocks.getAllSubtaskIds.mockResolvedValue([]);
    mocks.conformidadDistinct.mockResolvedValue(['h1']);
    expect(await cerrarVisitasAjenasSiTodoResuelto(10, 'tecA')).toBe(1);
  });

  it('sin visitas ajenas abiertas no consulta a Odoo', async () => {
    mocks.visitasFind.mockResolvedValue([]);
    expect(await cerrarVisitasAjenasSiTodoResuelto(10, 'tecA')).toBe(0);
    expect(mocks.getAllSubtaskIds).not.toHaveBeenCalled();
  });

  it('si Odoo no encuentra la tarea no cierra nada', async () => {
    mocks.getAllSubtaskIds.mockResolvedValue(null);
    mocks.conformidadDistinct.mockResolvedValue(['h1']);
    expect(await cerrarVisitasAjenasSiTodoResuelto(10, 'tecA')).toBe(0);
    expect(mocks.visitasUpdateMany).not.toHaveBeenCalled();
  });
});
