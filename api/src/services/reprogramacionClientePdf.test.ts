import { describe, expect, it } from 'vitest';
import { buildReprogramacionClienteHtml } from './reprogramacionClientePdf.js';

const data = {
  subtareaNombre: 'AB123CD',
  clienteNombre: 'Transportes <Sur>',
  ticketNumero: 4321,
  tecnicoNombre: 'Juan',
  horaAgendada: new Date('2026-10-08T17:30:00Z'),
  llegadaAt: new Date('2026-10-08T17:25:00Z'),
  reportadaAt: new Date('2026-10-08T17:40:00Z'),
  motivo: 'El cliente pidió pasar la visita',
  nuevaInicio: new Date('2026-10-12T13:00:00Z'),
  nuevaFin: new Date('2026-10-12T14:00:00Z'),
};

describe('buildReprogramacionClienteHtml', () => {
  it('lleva la fecha que eligió el cliente y la prueba de presencia', () => {
    const html = buildReprogramacionClienteHtml({ ...data, firma: { src: 'data:image/png;base64,AAAA', nombre: 'Ana', dni: '30111222' } });
    expect(html).toContain('Constancia de reprogramación a pedido del cliente');
    expect(html).toContain('Fecha elegida por el cliente');
    expect(html).toContain('10:00');
    expect(html).toContain('Llegada del técnico');
    expect(html).toContain('Transportes &lt;Sur&gt;');
  });

  it('con firma muestra la imagen, el nombre y el DNI', () => {
    const html = buildReprogramacionClienteHtml({ ...data, firma: { src: 'data:image/png;base64,AAAA', nombre: 'Ana', dni: '30111222' } });
    expect(html).toContain('data:image/png;base64,AAAA');
    expect(html).toContain('Ana · DNI 30111222');
    expect(html).not.toContain('No había persona para firmar');
  });

  it('sin firma deja la leyenda y el motivo', () => {
    const html = buildReprogramacionClienteHtml({ ...data, motivoSinFirma: 'Se fue el encargado' });
    expect(html).toContain('No había persona para firmar');
    expect(html).toContain('Se fue el encargado');
    expect(html).not.toContain('Firma del cliente');
  });
});

describe('buildReprogramacionClienteHtml (rango horario)', () => {
  const conRango = { ...data, horaAgendada: new Date('2026-10-08T15:00:00Z'), horaFinAgendada: new Date('2026-10-08T16:00:00Z') };

  it('llegó dentro del rango: sin leyenda de sin cargo', () => {
    const html = buildReprogramacionClienteHtml({ ...conRango, fueraDeRango: false });
    expect(html).toContain('dentro del rango horario agendado (12:00 a 13:00)');
    expect(html).not.toContain('sin cargo');
  });

  it('llegó después de que terminó el rango: sin cargo para el cliente', () => {
    const html = buildReprogramacionClienteHtml({ ...conRango, fueraDeRango: true });
    expect(html).toContain('fuera del rango horario agendado (12:00 a 13:00)');
    expect(html).toContain('sin cargo para el cliente');
  });
});
