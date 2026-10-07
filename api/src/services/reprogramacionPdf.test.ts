import { describe, expect, it } from 'vitest';
import { buildReprogramacionHtml, type ReprogramacionPdfData } from './reprogramacionPdf.js';

const base: ReprogramacionPdfData = {
  subtareaNombre: 'AB123CD',
  clienteNombre: 'Transportes <Sur>',
  ticketNumero: 4321,
  tecnicoNombre: 'Juan',
  reportadaAt: new Date('2026-10-08T15:00:00Z'),
  nuevaInicio: new Date('2026-10-09T13:00:00Z'),
  nuevaFin: new Date('2026-10-09T14:00:00Z'),
  motivo: 'No puedo volver hoy',
  tipo: 'pre_cancelado',
};

describe('buildReprogramacionHtml', () => {
  it('usa el nombre de la subtarea y escapa el HTML', () => {
    const html = buildReprogramacionHtml(base);
    expect(html).toContain('AB123CD');
    expect(html).toContain('Transportes &lt;Sur&gt;');
    expect(html).not.toContain('<Sur>');
    expect(html).toContain('#4321');
  });

  it('muestra la hora en Argentina (UTC-3)', () => {
    expect(buildReprogramacionHtml(base)).toContain('10:00');
  });

  it('avisa si coordinación cambió el horario propuesto', () => {
    const html = buildReprogramacionHtml({
      ...base,
      propuestaOriginal: { inicio: new Date('2026-10-09T12:00:00Z'), fin: new Date('2026-10-09T13:00:00Z') },
    });
    expect(html).toContain('ajustó el horario');
    expect(buildReprogramacionHtml({ ...base, propuestaOriginal: { inicio: base.nuevaInicio, fin: base.nuevaFin } })).not.toContain('ajustó');
  });

  it('el texto cambia según el tipo', () => {
    expect(buildReprogramacionHtml({ ...base, tipo: 'no_encontrada' })).toContain('la unidad no se encontraba');
  });
});
