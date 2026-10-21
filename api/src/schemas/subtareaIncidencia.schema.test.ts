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

const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const cliente = { ...base, tipo: 'reprogramado_cliente' as const, propuestaInicio: '2026-10-09T13:00:00.000Z', propuestaFin: '2026-10-09T14:00:00.000Z' };

describe('reprogramado_cliente', () => {
  it('acepta con firma (nombre y DNI) o con "no hay quien firme" y motivo', () => {
    expect(createSubtareaIncidenciaSchema.safeParse({ ...cliente, firma: { png: PNG_1PX, nombre: 'Ana Pérez', dni: '30111222' } }).success).toBe(true);
    expect(createSubtareaIncidenciaSchema.safeParse({ ...cliente, sinFirma: { motivo: 'Se fue el encargado' } }).success).toBe(true);
  });

  it('exige una de las dos, no ambas, y la fecha elegida', () => {
    expect(createSubtareaIncidenciaSchema.safeParse(cliente).success).toBe(false);
    expect(
      createSubtareaIncidenciaSchema.safeParse({ ...cliente, firma: { png: PNG_1PX, nombre: 'Ana' }, sinFirma: { motivo: 'x' } }).success,
    ).toBe(false);
    expect(createSubtareaIncidenciaSchema.safeParse({ ...base, tipo: 'reprogramado_cliente', sinFirma: { motivo: 'x' } }).success).toBe(false);
  });

  it('rechaza una firma que no es un PNG', () => {
    const falso = 'data:image/png;base64,' + Buffer.from('no soy un png').toString('base64');
    expect(createSubtareaIncidenciaSchema.safeParse({ ...cliente, firma: { png: falso, nombre: 'Ana' } }).success).toBe(false);
  });

  it('la firma también se acepta en los otros tipos (no está / reprogramar), pero no firma y ausente a la vez', () => {
    expect(createSubtareaIncidenciaSchema.safeParse({ ...base, firma: { png: PNG_1PX, nombre: 'Ana' } }).success).toBe(true);
    expect(createSubtareaIncidenciaSchema.safeParse({ ...base, sinFirma: { motivo: 'Cliente ausente' } }).success).toBe(true);
    expect(
      createSubtareaIncidenciaSchema.safeParse({ ...base, firma: { png: PNG_1PX, nombre: 'Ana' }, sinFirma: { motivo: 'x' } }).success,
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
