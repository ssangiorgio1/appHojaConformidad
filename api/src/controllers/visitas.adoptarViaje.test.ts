import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

// El caso: dos técnicos que comparten unidades de una misma tarea y viajan juntos. El titular sale y llega; el otro no toca
// nada y, sin embargo, tiene que ver el banner (en camino y en el lugar) y la tarjeta "En curso". Quién viaja con quién sale
// de lo que la API guardó al servirle la agenda (comparten al menos una unidad en Odoo), nunca de Odoo en cada consulta.

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  findOne: vi.fn(),
  exists: vi.fn(),
  create: vi.fn(),
  findUsuario: vi.fn(),
  findUsuarios: vi.fn(),
  compartidas: vi.fn(),
  odoo: vi.fn(),
  guardado: vi.fn(),
}));

vi.mock('../models/VisitaNotificacion.js', () => ({
  VisitaNotificacionModel: {
    find: (...a: unknown[]) => mocks.find(...a),
    findOne: (...a: unknown[]) => mocks.findOne(...a),
    exists: (...a: unknown[]) => mocks.exists(...a),
    create: (...a: unknown[]) => mocks.create(...a),
  },
}));
vi.mock('../models/Usuario.js', () => ({
  UsuarioModel: {
    findById: (...a: unknown[]) => ({ select: () => mocks.findUsuario(...a) }),
    find: (...a: unknown[]) => ({ select: () => mocks.findUsuarios(...a) }),
  },
}));
vi.mock('../services/telegram.service.js', () => ({ notificarEstadoVisita: vi.fn(), buildOptInLink: vi.fn(), resolverMomento: vi.fn() }));
vi.mock('../services/calendarTask.service.js', () => ({ isTaskAssignedToTechnician: vi.fn() }));
vi.mock('../services/agendaCompartida.service.js', () => ({
  tareasCompartidasDe: (...a: unknown[]) => mocks.compartidas(...a),
  compartenViaje: (...a: unknown[]) => mocks.guardado(...a),
  // Lo único que consulta Odoo (al salir hacia destino).
  refrescarCompartidaDeTarea: (...a: unknown[]) => mocks.odoo(...a),
}));
vi.mock('../services/loteVisita.service.js', () => ({ cerrarVisitasAjenasSiTodoResuelto: vi.fn() }));

import { adoptarViajeDeCompanero, getVisitaActiva, setEstadoVisita } from './visitas.controller.js';

const hoy = '2026-11-05';
const TAREA = 23293;
const titularEnSitio = (extra: Record<string, unknown> = {}) => ({
  tareaOdooId: TAREA,
  fecha: hoy,
  tecnicoId: 'titular',
  estado: 'en_sitio',
  abierta: true,
  enSitioAt: new Date('2026-11-05T15:00:00Z'),
  ...extra,
});
const titularEnCamino = () => ({ tareaOdooId: TAREA, fecha: hoy, tecnicoId: 'titular', estado: 'en_camino', abierta: true, enCaminoAt: new Date('2026-11-05T14:30:00Z') });

// La base devuelve, según el estado pedido, estas visitas de otros técnicos (y nada para las suspendidas).
function visitasDeOtros(porEstado: Record<string, unknown[]>) {
  mocks.find.mockImplementation((filtro: { estado?: string }) => ({
    sort: () => ({ limit: () => Promise.resolve(porEstado[filtro.estado ?? ''] ?? []), select: () => Promise.resolve([]) }),
  }));
}

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  // El titular es el usuario de Odoo 290; en mi agenda de esa tarea+fecha comparto unidad con él.
  mocks.compartidas.mockResolvedValue([{ tareaOdooId: TAREA, fecha: hoy, companerosOdooIds: [290] }]);
  mocks.findUsuarios.mockResolvedValue([{ _id: 'titular', odooUserId: 290 }]);
  mocks.findUsuario.mockResolvedValue({ nombre: 'Pablo Vega' });
  mocks.exists.mockResolvedValue(null);
  mocks.create.mockImplementation(async (doc: Record<string, unknown>) => ({ ...doc, _id: 'nueva' }));
  visitasDeOtros({ en_sitio: [titularEnSitio()] });
});

describe('adoptarViajeDeCompanero: el que no inició el viaje', () => {
  it('cuando el compañero de viaje ya está en el lugar, se le registra una visita propia en sitio, sin viaje ni chat', async () => {
    const v = await adoptarViajeDeCompanero('otro');
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(v).toMatchObject({ tareaOdooId: TAREA, fecha: hoy, tecnicoId: 'otro', estado: 'en_sitio', abierta: true });
    const creada = mocks.create.mock.calls[0][0];
    expect(creada.enCaminoAt).toBeUndefined(); // no cuenta en los promedios de traslado
    expect(creada.chatId).toBeUndefined(); // no manda otro aviso al cliente
  });

  it('solo busca en las tareas que comparte y mira visitas abiertas, en sitio, no suspendidas, recientes y de otro técnico', async () => {
    await adoptarViajeDeCompanero('otro');
    const filtro = mocks.find.mock.calls[0][0];
    expect(filtro).toMatchObject({
      $or: [{ tareaOdooId: TAREA, fecha: hoy }],
      tecnicoId: { $ne: 'otro' },
      abierta: true,
      suspendida: { $ne: true },
      estado: 'en_sitio',
    });
    expect(filtro.updatedAt.$gte).toBeInstanceOf(Date);
  });

  it('los dos en la tarea padre pero cada uno con su unidad: no se adopta (cada uno hace su viaje)', async () => {
    // Caso de prueba del 11/11: en mi agenda esa tarea no tiene compañeros de viaje.
    mocks.compartidas.mockResolvedValue([]);
    expect(await adoptarViajeDeCompanero('otro')).toBeNull();
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('la visita en sitio es de otro técnico de la tarea con quien no comparto unidad: no se adopta', async () => {
    mocks.findUsuarios.mockResolvedValue([{ _id: 'titular', odooUserId: 999 }]);
    expect(await adoptarViajeDeCompanero('otro')).toBeNull();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('nunca consulta Odoo', async () => {
    await adoptarViajeDeCompanero('otro');
    expect(mocks.odoo).not.toHaveBeenCalled();
  });

  it('si ya tiene una visita propia que manda (abierta, terminada o cerrada después de la llegada del titular), no se le inventa otra', async () => {
    mocks.exists.mockResolvedValue({ _id: 'propia' });
    expect(await adoptarViajeDeCompanero('otro')).toBeNull();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('un viaje propio cancelado ANTES de que llegara el titular no impide la adopción (caso de prueba local del 11/11)', async () => {
    await adoptarViajeDeCompanero('otro');
    const filtro = mocks.exists.mock.calls[0][0];
    expect(filtro.$or).toEqual([{ abierta: true }, { estado: 'completo' }, { updatedAt: { $gte: new Date('2026-11-05T15:00:00Z') } }]);
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  it('dos consultas a la vez del mismo técnico terminan en una sola visita (carrera por clave duplicada)', async () => {
    mocks.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));
    const existente = { _id: 'ya', estado: 'en_sitio' };
    mocks.findOne.mockResolvedValue(existente);
    expect(await adoptarViajeDeCompanero('otro')).toBe(existente);
  });

  it('si falla la base, no tira: simplemente no se adopta', async () => {
    mocks.compartidas.mockRejectedValue(new Error('Mongo caído'));
    await expect(adoptarViajeDeCompanero('otro')).resolves.toBeNull();
  });
});

// La consulta que repite la PWA cada 60 s para el banner.
describe('getVisitaActiva: el banner del que no inició el viaje', () => {
  // asyncHandler no devuelve la promesa: se espera a que el controlador responda.
  function pedir() {
    const req = { user: { role: 'tecnico', usuarioId: 'otro' }, query: {} } as unknown as Request;
    return new Promise<{ visita: { tareaOdooId: number; estado: string } | null; viajeCompanero?: Record<string, unknown> | null }>((resolve, reject) => {
      const res = { json: (b: unknown) => resolve(b as never) } as unknown as Response;
      getVisitaActiva(req, res, (err?: unknown) => reject(err));
    });
  }

  beforeEach(() => {
    // Sin visita propia abierta.
    mocks.findOne.mockReturnValue({ sort: () => Promise.resolve(null) });
  });

  it('con el compañero en el lugar, devuelve la visita adoptada: aparece el banner "Trabajo en progreso"', async () => {
    const r = await pedir();
    expect(r.visita).toMatchObject({ tareaOdooId: TAREA, estado: 'en_sitio' });
  });

  it('con el compañero en camino, no hay visita propia pero se avisa con la franja informativa', async () => {
    visitasDeOtros({ en_camino: [titularEnCamino()] });
    const r = await pedir();
    expect(r.visita).toBeNull();
    expect(r.viajeCompanero).toMatchObject({ tareaOdooId: TAREA, fecha: hoy, estado: 'en_camino', nombre: 'Pablo Vega' });
    expect(mocks.create).not.toHaveBeenCalled(); // solo se avisa, no se le inventa una visita
    expect(mocks.odoo).not.toHaveBeenCalled();
  });

  it('el que salió está en la misma tarea padre pero no comparte unidad conmigo: no hay franja', async () => {
    visitasDeOtros({ en_camino: [titularEnCamino()] });
    mocks.compartidas.mockResolvedValue([]);
    const r = await pedir();
    expect(r.visita).toBeNull();
    expect(r.viajeCompanero).toBeNull();
  });

  it('si el técnico ya tenía su propia visita abierta, se devuelve esa y no se adopta otra', async () => {
    mocks.findOne.mockReturnValue({ sort: () => Promise.resolve({ tareaOdooId: 555, fecha: hoy, estado: 'en_camino', enCaminoAt: new Date() }) });
    const r = await pedir();
    expect(r.visita).toMatchObject({ tareaOdooId: 555, estado: 'en_camino' });
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

// "Salir hacia destino" con otro técnico ya en viaje en la misma tarea: solo se frena si comparten unidad, según la
// asignación que se relee de Odoo en ese momento (no la que quedó guardada de una agenda vieja).
describe('setEstadoVisita en_camino: ¿viajan juntos?', () => {
  // Yo soy el usuario de Odoo 295; el que ya salió es el 290.
  const yaSalio = { tareaOdooId: TAREA, fecha: hoy, estado: 'en_camino', enCaminoAt: new Date('2026-11-05T14:30:00Z'), tecnicoId: { nombre: 'Atilio', odooUserId: 290 } };

  function salir() {
    const req = { user: { role: 'tecnico', usuarioId: 'otro' }, params: { tareaOdooId: TAREA }, body: { estado: 'en_camino', fecha: hoy } } as unknown as Request;
    return new Promise<unknown>((resolve, reject) => {
      const res = { json: (b: unknown) => resolve(b) } as unknown as Response;
      setEstadoVisita(req, res, (err?: unknown) => (err ? reject(err) : resolve(undefined)));
    });
  }

  beforeEach(() => {
    // 1º exists: ya tuve viaje en esta tarea (no se vuelve a chequear la asignación); después, ninguna visita propia abierta.
    mocks.exists.mockResolvedValueOnce({ _id: 'vieja' }).mockResolvedValue(null);
    mocks.find.mockReturnValue({ sort: () => ({ limit: () => ({ populate: () => Promise.resolve([yaSalio]) }) }) });
    mocks.findOne.mockReturnValue({ sort: () => Promise.resolve(null) });
    mocks.findUsuario.mockResolvedValue({ odooUserId: 295 });
  });

  it('coordinación nos sacó de la unidad compartida: sale cada uno con su viaje aunque lo guardado diga que compartíamos', async () => {
    mocks.odoo.mockResolvedValue(new Map([[295, []], [290, []]]));
    mocks.guardado.mockResolvedValue(true);
    await expect(salir()).resolves.toBeUndefined();
    expect(mocks.odoo).toHaveBeenCalledWith(TAREA, hoy);
    expect(mocks.guardado).not.toHaveBeenCalled();
  });

  it('compartimos una unidad en Odoo: no abro un viaje propio (el viaje lo lleva el que salió primero)', async () => {
    mocks.odoo.mockResolvedValue(new Map([[295, [290]], [290, [295]]]));
    await expect(salir()).rejects.toMatchObject({ status: 409 });
  });

  it('si Odoo no responde, decide lo guardado de la agenda', async () => {
    mocks.odoo.mockRejectedValue(new Error('Odoo caído'));
    mocks.guardado.mockResolvedValue(true);
    await expect(salir()).rejects.toMatchObject({ status: 409 });
    expect(mocks.guardado).toHaveBeenCalledWith('otro', TAREA, hoy, 290);
  });
});
