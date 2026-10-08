import { describe, expect, it } from 'vitest';
import { buildRetiroEquipoHtml, type RetiroEquipoPdfData } from './retiroEquipoPdf.js';

const base: RetiroEquipoPdfData = {
  subtareaNombre: 'AD880CC',
  clienteNombre: 'Millan <S.A.>',
  ticketNumero: 39522,
  tecnicoNombre: 'Renzo',
  modalidad: 'entrega',
  fechaHora: new Date('2026-10-07T20:35:00Z'),
  equipo: { numero: '2006670', imei: '868817044905212', estado: 'completo' },
  adicionales: [
    { nombre: 'BP', recibido: true },
    { nombre: 'RFID', recibido: false },
  ],
  entrega: { nombre: 'Juan', telefono: '261 6595787' },
};

describe('buildRetiroEquipoHtml', () => {
  it('lleva la patente, el ticket y escapa el HTML', () => {
    const html = buildRetiroEquipoHtml(base);
    expect(html).toContain('AD880CC');
    expect(html).toContain('#39522');
    expect(html).toContain('Millan &lt;S.A.&gt;');
    expect(html).not.toContain('<S.A.>');
  });
  it('separa adicionales recibidos y faltantes', () => {
    const html = buildRetiroEquipoHtml(base);
    expect(html).toContain('Recibidos');
    expect(html).toContain('Faltantes');
    expect(html).toContain('RFID');
  });
  it('el texto cambia según la modalidad', () => {
    expect(buildRetiroEquipoHtml(base)).toContain('en mano');
    expect(buildRetiroEquipoHtml({ ...base, modalidad: 'deja_para_retirar', entrega: { lugar: 'Portería' } })).toContain('para su retiro');
  });
  it('sin firma muestra el motivo', () => {
    const html = buildRetiroEquipoHtml({ ...base, firma: { motivo: 'No había nadie' } });
    expect(html).toContain('Sin persona para firmar');
    expect(html).toContain('No había nadie');
  });
  it('con firma muestra la imagen', () => {
    expect(buildRetiroEquipoHtml({ ...base, firma: { url: 'https://r2.test/f.png', nombreFirmante: 'Juan' } })).toContain('class="firma"');
  });
});
