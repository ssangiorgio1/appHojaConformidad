import { describe, expect, it } from 'vitest';
import { buildConstanciaVisitaFallidaHtml } from './constanciaVisitaFallidaPdf.js';

const data = {
  subtareaNombre: 'AB123CD',
  clienteNombre: 'Transportes <Sur>',
  ticketNumero: 4321,
  tecnicoNombre: 'Juan',
  horaAgendada: new Date('2026-10-08T17:00:00Z'),
  horaFinAgendada: new Date('2026-10-08T18:00:00Z'),
  llegadaAt: new Date('2026-10-08T17:25:00Z'),
  reportadaAt: new Date('2026-10-08T17:40:00Z'),
  motivo: 'La unidad no estaba',
};

describe('buildConstanciaVisitaFallidaHtml', () => {
  it('lleva la prueba de presencia y es facturable', () => {
    const html = buildConstanciaVisitaFallidaHtml(data);
    expect(html).toContain('Constancia de visita fallida');
    expect(html).toContain('Llegada del técnico');
    expect(html).toContain('14:25');
    expect(html).toContain('facturable');
    expect(html).toContain('Transportes &lt;Sur&gt;');
  });
  it('muestra la nueva fecha solo si ya se reprogramó', () => {
    expect(buildConstanciaVisitaFallidaHtml(data)).not.toContain('se reprograma para');
    expect(buildConstanciaVisitaFallidaHtml({ ...data, nuevaInicio: new Date('2026-10-09T13:00:00Z') })).toContain('se reprograma para');
  });
});

describe('buildConstanciaVisitaFallidaHtml (rango horario)', () => {
  it('dice que llegó dentro del rango agendado, no "a la hora"', () => {
    const html = buildConstanciaVisitaFallidaHtml(data);
    expect(html).toContain('dentro del rango horario agendado (14:00 a 15:00)');
    expect(html).toContain('Rango agendado');
    expect(html).not.toContain('demora');
  });
  it('para un PRE cancelado cuenta que se reprograma, no que la unidad no estaba', () => {
    const html = buildConstanciaVisitaFallidaHtml({ ...data, tipo: 'pre_cancelado' });
    expect(html).toContain('la visita no pudo completarse, por lo que se reprograma');
    expect(html).not.toContain('la unidad no se encontraba');
  });
});
