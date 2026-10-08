import { describe, expect, it } from 'vitest';
import { buildConstanciaVisitaFallidaHtml } from './constanciaVisitaFallidaPdf.js';

const data = {
  subtareaNombre: 'AB123CD',
  clienteNombre: 'Transportes <Sur>',
  ticketNumero: 4321,
  tecnicoNombre: 'Juan',
  horaAgendada: new Date('2026-10-08T17:30:00Z'),
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
