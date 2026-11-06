import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

// El caso: dos técnicos con la misma tarea (cada uno con su unidad) y un solo viaje. El titular sale y llega; el otro no
// toca nada y, sin embargo, tiene que ver el banner de "trabajo en progreso" y la tarjeta "En curso". Eso lo resuelve
// adoptarViajeDeCompanero: se le registra una visita propia en sitio. Estos tests fijan cuándo lo hace y cuándo no.

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  findOne: vi.fn(),
  exists: vi.fn(),
  create: vi.fn(),
  findUsuario: vi.fn(),
  tareaAsignada: vi.fn(),
}));

vi.mock('../models/VisitaNotificacion.js', () => ({
  VisitaNotificacionModel: {
    find: (...a: unknown[]) => mocks.find(...a),
    findOne: (...a: unknown[]) => mocks.findOne(...a),
    exists: (...a: unknown[]) => mocks.exists(...a),
    create: (...a: unknown[]) => mocks.create(...a),
  },
}));
vi.mock('../models/Usuario.js', () => ({ UsuarioModel: { findById: (...a: unknown[]) => ({ select: () => mocks.findUsuario(...a) }) } }));
vi.mock('../services/telegram.service.js', () => ({ notificarEstadoVisita: vi.fn(), buildOptInLink: vi.fn(), resolverMomento: vi.fn() }));
vi.mock('../services/calendarTask.service.js', () => ({ isTaskAssignedToTechnician: (...a: unknown[]) => mocks.tareaAsignada(...a) }));
vi.mock('../services/loteVisita.service.js', () => ({ cerrarVisitasAjenasSiTodoResuelto: vi.fn() }));

import { adoptarViajeDeCompanero, getVisitaActiva } from './visitas.controller.js';

const hoy = '2026-11-05';
const titularEnSitio = (extra: Record<string, unknown> = {}) => ({
  tareaOdooId: 23293,
  fecha: hoy,
  tecnicoId: 'titular',
  estado: 'en_sitio',
  abierta: true,
  enSitioAt: new Date('2026-11-05T15:00:00Z'),
  ...extra,
});

// Un id de tarea distinto por test: la API recuerda 5 minutos si una tarea estaba asignada a un técnico.
let tarea = 1000;

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  tarea += 1;
  mocks.findUsuario.mockResolvedValue({ odooUserId: 77 });
  mocks.exists.mockResolvedValue(null);
  mocks.tareaAsignada.mockResolvedValue(true);
  mocks.create.mockImplementation(async (doc: Record<string, unknown>) => ({ ...doc, _id: 'nueva' }));
  mocks.find.mockReturnValue({ sort: () => ({ limit: () => Promise.resolve([titularEnSitio({ tareaOdooId: tarea })]) }) });
});

describe('adoptarViajeDeCompanero: el que no inició el viaje', () => {
  it('cuando el titular ya está en el lugar, se le registra una visita propia en sitio, sin viaje ni chat', async () => {
    const v = await adoptarViajeDeCompanero('otro');
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(v).toMatchObject({ tareaOdooId: tarea, fecha: hoy, tecnicoId: 'otro', estado: 'en_sitio', abierta: true });
    const creada = mocks.create.mock.calls[0][0];
    expect(creada.enCaminoAt).toBeUndefined(); // no cuenta en los promedios de traslado
    expect(creada.chatId).toBeUndefined(); // no manda otro aviso al cliente
  });

  it('solo mira visitas del titular que están abiertas, en sitio, no suspendidas y recientes, y de otro técnico', async () => {
    await adoptarViajeDeCompanero('otro');
    const filtro = mocks.find.mock.calls[0][0];
    expect(filtro).toMatchObject({ tecnicoId: { $ne: 'otro' }, abierta: true, suspendida: { $ne: true }, estado: 'en_sitio' });
    expect(filtro.updatedAt.$gte).toBeInstanceOf(Date);
  });

  it('si el titular recién salió (en camino) todavía no hay nada que adoptar', async () => {
    // El filtro de la consulta deja afuera a los que no están en sitio: la base no devuelve candidatas.
    mocks.find.mockReturnValue({ sort: () => ({ limit: () => Promise.resolve([]) }) });
    expect(await adoptarViajeDeCompanero('otro')).toBeNull();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('si el técnico no tiene la cuenta de Odoo vinculada, no se le adopta nada (queda sin banner)', async () => {
    mocks.findUsuario.mockResolvedValue({ odooUserId: null });
    expect(await adoptarViajeDeCompanero('otro')).toBeNull();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('si la tarea no le está asignada en Odoo (ni a una de sus unidades), no se le adopta', async () => {
    mocks.tareaAsignada.mockResolvedValue(false);
    expect(await adoptarViajeDeCompanero('otro')).toBeNull();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('si ya tiene una visita propia para esa tarea y día (abierta, cerrada o cancelada), no se le inventa otra', async () => {
    mocks.exists.mockResolvedValue({ _id: 'propia' });
    expect(await adoptarViajeDeCompanero('otro')).toBeNull();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('si Odoo falla al preguntar la asignación, no tira: simplemente no se adopta y el banner no aparece', async () => {
    mocks.tareaAsignada.mockRejectedValue(new Error('Odoo caído'));
    await expect(adoptarViajeDeCompanero('otro')).resolves.toBeNull();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('dos consultas a la vez del mismo técnico terminan en una sola visita (carrera por clave duplicada)', async () => {
    mocks.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));
    const existente = { _id: 'ya', estado: 'en_sitio' };
    mocks.findOne.mockResolvedValue(existente);
    expect(await adoptarViajeDeCompanero('otro')).toBe(existente);
  });

  it('recuerda 5 minutos que la tarea NO estaba asignada: si se la asignan justo después, hasta entonces no hay banner', async () => {
    mocks.tareaAsignada.mockResolvedValueOnce(false).mockResolvedValue(true);
    expect(await adoptarViajeDeCompanero('otro')).toBeNull();
    expect(await adoptarViajeDeCompanero('otro')).toBeNull(); // la segunda consulta ni vuelve a preguntar a Odoo
    expect(mocks.tareaAsignada).toHaveBeenCalledTimes(1);
  });
});

// La consulta que repite la PWA cada 60 s para el banner verde.
describe('getVisitaActiva: el banner del que no inició el viaje', () => {
  // asyncHandler no devuelve la promesa: se espera a que el controlador responda.
  function pedir() {
    const req = { user: { role: 'tecnico', usuarioId: 'otro' } } as unknown as Request;
    return new Promise<{ visita: { tareaOdooId: number; estado: string } | null }>((resolve, reject) => {
      const res = { json: (b: unknown) => resolve(b as never) } as unknown as Response;
      getVisitaActiva(req, res, (err?: unknown) => reject(err));
    });
  }

  beforeEach(() => {
    // Sin visita propia abierta; la de las suspendidas (`find().sort().select()`) viene vacía.
    mocks.findOne.mockReturnValue({ sort: () => Promise.resolve(null) });
    mocks.find.mockImplementation(() => ({
      sort: () => ({ limit: () => Promise.resolve([titularEnSitio({ tareaOdooId: tarea })]), select: () => Promise.resolve([]) }),
    }));
  });

  it('con el titular en el lugar, devuelve la visita adoptada: aparece el banner "Trabajo en progreso"', async () => {
    const r = await pedir();
    expect(r.visita).toMatchObject({ tareaOdooId: tarea, estado: 'en_sitio' });
  });

  it('con el titular todavía en camino, no hay banner', async () => {
    mocks.find.mockImplementation(() => ({ sort: () => ({ limit: () => Promise.resolve([]), select: () => Promise.resolve([]) }) }));
    expect((await pedir()).visita).toBeNull();
  });

  it('si el técnico ya tenía su propia visita abierta, se devuelve esa y no se adopta otra', async () => {
    mocks.findOne.mockReturnValue({ sort: () => Promise.resolve({ tareaOdooId: 555, fecha: hoy, estado: 'en_camino', enCaminoAt: new Date() }) });
    const r = await pedir();
    expect(r.visita).toMatchObject({ tareaOdooId: 555, estado: 'en_camino' });
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

