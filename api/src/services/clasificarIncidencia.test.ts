import { describe, expect, it } from 'vitest';
import { clasificarLlegada, constanciaYaEnviada, enviaConstanciaAlReportar } from './clasificarIncidencia.js';

// Rango agendado: 12:00 a 13:00 en Argentina (15:00 a 16:00 UTC).
const finDelRango = new Date('2026-10-08T16:00:00Z');

describe('clasificarLlegada (por rango horario)', () => {
  it('llegar en cualquier momento del rango no es demora: visita fallida', () => {
    expect(clasificarLlegada(finDelRango, new Date('2026-10-08T15:00:00Z'))).toBe('no_encontrada'); // 12:00
    expect(clasificarLlegada(finDelRango, new Date('2026-10-08T15:40:00Z'))).toBe('no_encontrada'); // 12:40, entre 12 y 13
  });
  it('llegar antes del rango tampoco', () => {
    expect(clasificarLlegada(finDelRango, new Date('2026-10-08T14:30:00Z'))).toBe('no_encontrada');
  });
  it('llegar justo a la hora de fin todavía está dentro del rango', () => {
    expect(clasificarLlegada(finDelRango, new Date('2026-10-08T16:00:00Z'))).toBe('no_encontrada');
  });
  it('llegar después de que termina el rango: culpa del técnico', () => {
    expect(clasificarLlegada(finDelRango, new Date('2026-10-08T16:01:00Z'))).toBe('llegada_tarde');
    expect(clasificarLlegada(finDelRango, new Date('2026-10-08T17:30:00Z'))).toBe('llegada_tarde');
  });
  it('sin datos no decide', () => {
    expect(clasificarLlegada(null, finDelRango)).toBeNull();
    expect(clasificarLlegada(finDelRango, null)).toBeNull();
    expect(clasificarLlegada(undefined, undefined)).toBeNull();
  });
});

describe('enviaConstanciaAlReportar', () => {
  it('"No está en el lugar" dentro del rango y con ticket: sale al reportar', () => {
    expect(enviaConstanciaAlReportar({ tipo: 'no_encontrada', fueraDeRango: false, ticketOdooId: 4321 })).toBe(true);
  });
  it('si el técnico llegó fuera del rango no sale todavía (va la reprogramación sin cargo al resolver)', () => {
    expect(enviaConstanciaAlReportar({ tipo: 'no_encontrada', fueraDeRango: true, ticketOdooId: 4321 })).toBe(false);
  });
  it('sin ticket no hay dónde adjuntarla', () => {
    expect(enviaConstanciaAlReportar({ tipo: 'no_encontrada', fueraDeRango: false, ticketOdooId: null })).toBe(false);
    expect(enviaConstanciaAlReportar({ tipo: 'no_encontrada', fueraDeRango: false })).toBe(false);
  });
  it('los otros reportes no la mandan al reportar', () => {
    expect(enviaConstanciaAlReportar({ tipo: 'pre_cancelado', fueraDeRango: false, ticketOdooId: 1 })).toBe(false);
    expect(enviaConstanciaAlReportar({ tipo: 'reprogramado_cliente', fueraDeRango: false, ticketOdooId: 1 })).toBe(false);
  });
});

describe('constanciaYaEnviada', () => {
  it('si ya se adjuntó al reportar, al resolver no se repite', () => {
    expect(constanciaYaEnviada({ tipo: 'no_encontrada', pdfReprogramacionAt: new Date() })).toBe(true);
  });
  it('si falló al reportar (sin fecha de envío), al resolver se reintenta', () => {
    expect(constanciaYaEnviada({ tipo: 'no_encontrada', pdfReprogramacionAt: null })).toBe(false);
    expect(constanciaYaEnviada({ tipo: 'no_encontrada' })).toBe(false);
  });
  it('solo aplica a "no está"', () => {
    expect(constanciaYaEnviada({ tipo: 'pre_cancelado', pdfReprogramacionAt: new Date() })).toBe(false);
  });
});
