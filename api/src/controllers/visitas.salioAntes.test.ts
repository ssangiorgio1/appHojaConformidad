import { describe, it, expect, vi } from 'vitest';

vi.mock('../models/VisitaNotificacion.js', () => ({ VisitaNotificacionModel: {} }));
vi.mock('../models/Usuario.js', () => ({ UsuarioModel: {} }));
vi.mock('../services/telegram.service.js', async () => {
  const actual = await vi.importActual<typeof import('../services/telegram.service.js')>('../services/telegram.service.js').catch(() => null);
  return { notificarEstadoVisita: vi.fn(), buildOptInLink: vi.fn(), resolverMomento: actual?.resolverMomento ?? ((v?: string) => (v ? new Date(v) : new Date())) };
});
vi.mock('../services/calendarTask.service.js', () => ({ isTaskAssignedToTechnician: vi.fn() }));
vi.mock('../services/loteVisita.service.js', () => ({ cerrarVisitasAjenasSiTodoResuelto: vi.fn() }));

import { salioAntes } from './visitas.controller.js';

const hace = (min: number) => new Date(Date.now() - min * 60_000);

describe('salioAntes', () => {
  it('acepta una salida anterior a la del compañero', () => {
    expect(salioAntes(hace(30).toISOString(), hace(10))).toBe(true);
  });
  it('rechaza una salida posterior', () => {
    expect(salioAntes(hace(5).toISOString(), hace(10))).toBe(false);
  });
  it('sin hora del toque o sin hora del compañero, no hay excepción', () => {
    expect(salioAntes(undefined, hace(10))).toBe(false);
    expect(salioAntes(hace(30).toISOString(), null)).toBe(false);
  });
  it('una hora de hace más de 24 h no vale (el servidor la reemplaza por la suya)', () => {
    expect(salioAntes(hace(60 * 30).toISOString(), hace(10))).toBe(false);
  });
});
