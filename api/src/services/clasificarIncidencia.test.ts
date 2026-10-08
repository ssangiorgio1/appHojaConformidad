import { describe, expect, it } from 'vitest';
import { clasificarLlegada } from './clasificarIncidencia.js';

const agendada = new Date('2026-10-08T17:30:00Z'); // 14:30 en Argentina

describe('clasificarLlegada', () => {
  it('llegó a horario: visita fallida', () => {
    expect(clasificarLlegada(agendada, new Date('2026-10-08T17:25:00Z'))).toBe('no_encontrada');
  });
  it('llegó justo en la tolerancia: visita fallida', () => {
    expect(clasificarLlegada(agendada, new Date('2026-10-08T17:45:00Z'))).toBe('no_encontrada');
  });
  it('llegó pasada la tolerancia: llegada tarde', () => {
    expect(clasificarLlegada(agendada, new Date('2026-10-08T18:00:00Z'))).toBe('llegada_tarde');
    expect(clasificarLlegada(agendada, new Date('2026-10-08T17:46:00Z'))).toBe('llegada_tarde');
  });
  it('sin datos no decide', () => {
    expect(clasificarLlegada(null, agendada)).toBeNull();
    expect(clasificarLlegada(agendada, null)).toBeNull();
  });
});
