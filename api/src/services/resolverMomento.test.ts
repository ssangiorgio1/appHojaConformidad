import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/env.js', () => ({ env: {} }));
vi.mock('../models/VisitaNotificacion.js', () => ({ VisitaNotificacionModel: {} }));

const { resolverMomento } = await import('./telegram.service.js');

const AHORA = new Date('2026-10-05T12:00:00.000Z');
const hace = (min: number) => new Date(AHORA.getTime() - min * 60_000);

describe('resolverMomento (hora real de acciones encoladas sin señal)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
  });
  afterEach(() => vi.useRealTimers());

  it('sin ocurrioAt usa la hora del servidor', () => {
    expect(resolverMomento(undefined, null)).toEqual(AHORA);
  });

  it('acepta la hora real de un toque reciente (viaje de 20 min sin señal)', () => {
    expect(resolverMomento(hace(20).toISOString(), null)).toEqual(hace(20));
  });

  it('acepta hasta 24 h atrás', () => {
    expect(resolverMomento(hace(23 * 60).toISOString(), null)).toEqual(hace(23 * 60));
  });

  it('rechaza más de 24 h atrás (reloj del teléfono mal, cola vieja)', () => {
    expect(resolverMomento(hace(25 * 60).toISOString(), null)).toEqual(AHORA);
  });

  it('rechaza horas en el futuro (más allá de 1 min de tolerancia)', () => {
    expect(resolverMomento(new Date(AHORA.getTime() + 10 * 60_000).toISOString(), null)).toEqual(AHORA);
  });

  it('tolera hasta 1 min de desfase de reloj hacia adelante', () => {
    const t = new Date(AHORA.getTime() + 30_000);
    expect(resolverMomento(t.toISOString(), null)).toEqual(t);
  });

  it('rechaza fechas inválidas', () => {
    expect(resolverMomento('no-es-fecha', null)).toEqual(AHORA);
  });

  it('no permite retroceder más allá de la transición anterior (Llegué antes de Salí)', () => {
    expect(resolverMomento(hace(60).toISOString(), hace(30))).toEqual(AHORA);
  });

  it('acepta una hora posterior a la transición anterior', () => {
    expect(resolverMomento(hace(10).toISOString(), hace(30))).toEqual(hace(10));
  });
});
