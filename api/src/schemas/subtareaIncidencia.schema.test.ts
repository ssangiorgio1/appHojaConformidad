import { describe, expect, it } from 'vitest';
import { createSubtareaIncidenciaSchema, resolveSubtareaIncidenciaSchema } from './subtareaIncidencia.schema.js';

const base = { tareaOdooId: 1, subtareaOdooId: 2, fecha: '2026-10-08', motivo: 'No puedo volver' };

describe('createSubtareaIncidenciaSchema', () => {
  it('sin propuesta sigue siendo no_encontrada', () => {
    const r = createSubtareaIncidenciaSchema.parse(base);
    expect(r.tipo).toBe('no_encontrada');
  });

  it('acepta PRE cancelado con propuesta', () => {
    const r = createSubtareaIncidenciaSchema.safeParse({
      ...base,
      tipo: 'pre_cancelado',
      propuestaInicio: '2026-10-09T13:00:00.000Z',
      propuestaFin: '2026-10-09T14:00:00.000Z',
    });
    expect(r.success).toBe(true);
  });

  it('rechaza propuesta incompleta o con fin anterior al inicio', () => {
    expect(createSubtareaIncidenciaSchema.safeParse({ ...base, propuestaInicio: '2026-10-09T13:00:00.000Z' }).success).toBe(false);
    expect(
      createSubtareaIncidenciaSchema.safeParse({
        ...base,
        propuestaInicio: '2026-10-09T14:00:00.000Z',
        propuestaFin: '2026-10-09T13:00:00.000Z',
      }).success,
    ).toBe(false);
  });
});

describe('resolveSubtareaIncidenciaSchema', () => {
  it('aceptar sin hora es válido (usa la propuesta)', () => {
    expect(resolveSubtareaIncidenciaSchema.safeParse({ estado: 'reprogramada' }).success).toBe(true);
  });

  it('rechazar exige motivo y no lleva fecha', () => {
    expect(resolveSubtareaIncidenciaSchema.safeParse({ estado: 'rechazada' }).success).toBe(false);
    expect(resolveSubtareaIncidenciaSchema.safeParse({ estado: 'rechazada', motivoRechazo: 'Ese día no hay técnicos' }).success).toBe(true);
    expect(
      resolveSubtareaIncidenciaSchema.safeParse({
        estado: 'rechazada',
        motivoRechazo: 'x',
        start: '2026-10-09 13:00:00',
        end: '2026-10-09 14:00:00',
      }).success,
    ).toBe(false);
  });
});
