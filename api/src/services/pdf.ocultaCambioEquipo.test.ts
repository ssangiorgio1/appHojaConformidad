import { describe, expect, it } from 'vitest';
import { EQUIP_ITEM_PHOTO_LABEL, buildPrintHtml, newRecord, ocultaCambioEquipoEnPdf, type PrintableConformidad } from '@wara/shared';

// Intervención con cambio de equipo (3G → 4G) y, además, instalación de un sensor o módulo.
const SENSOR = Object.keys(EQUIP_ITEM_PHOTO_LABEL)[0];
const FOTO = (id: string, slotKey: string) => ({ id, slotKey, url: `https://r2.test/${id}.jpg` });

function hoja(over: Partial<PrintableConformidad> = {}): PrintableConformidad {
  const r = newRecord('x', new Date('2026-11-12T10:00:00Z'));
  return {
    ...r,
    tipoServicio: 'reparacion',
    motivoIntervencion: 'cambio_equipo',
    cambioEquipoRazon: 'orden_interna',
    instalaSensorModulo: true,
    numero: 'N-1',
    cliente: 'Cliente SA',
    matricula: 'AB 123 CD',
    equipo: { ...r.equipo, modelo: 'EQ-VIEJO-3G', imei: '111111111111111', modeloInstalado: 'EQ-NUEVO-4G', imeiInstalado: '222222222222222', [SENSOR]: 'SI' },
    post: {
      ...r.post,
      fotos: [
        FOTO('f1', 'equipo_a_retirar'),
        FOTO('f2', 'equipo_serie'),
        FOTO('f3', 'precintos'),
        FOTO('f4', 'ubicacion_equipo'),
        FOTO('f5', 'lugar_vacio'),
        FOTO('f6', 'torpedo'),
        FOTO('f7', 'odometro'),
        FOTO('f8', SENSOR),
      ],
    },
    ...over,
  } as PrintableConformidad;
}

describe('ocultaCambioEquipoEnPdf', () => {
  it('solo cuando es orden interna y además se instala un sensor o módulo', () => {
    expect(ocultaCambioEquipoEnPdf(hoja())).toBe(true);
  });
  it('la actualización a 4G, que el cliente ya conoce, no se oculta', () => {
    expect(ocultaCambioEquipoEnPdf(hoja({ cambioEquipoRazon: 'actualizacion_4g' }))).toBe(false);
  });
  it('sin sensor, el cambio por orden interna se imprime como siempre', () => {
    expect(ocultaCambioEquipoEnPdf(hoja({ instalaSensorModulo: false }))).toBe(false);
  });
  it('otras razones o motivos no se ocultan', () => {
    expect(ocultaCambioEquipoEnPdf(hoja({ cambioEquipoRazon: 'equipo_danado' }))).toBe(false);
    expect(ocultaCambioEquipoEnPdf(hoja({ motivoIntervencion: 'reinicio_manual' }))).toBe(false);
    expect(ocultaCambioEquipoEnPdf(hoja({ tipoServicio: 'instalacion' }))).toBe(false);
  });
});

describe('PDF del cliente: cambio de equipo por orden interna + sensor', () => {
  it('habla solo de la instalación del sensor y no menciona el cambio', async () => {
    const html = await buildPrintHtml(hoja());
    expect(html).toContain('Instalación de sensor o módulo');
    expect(html).not.toContain('Cambio de equipo');
    expect(html).not.toContain('(equipo retirado)');
  });

  it('imprime el equipo instalado como datos del equipo y nunca el retirado', async () => {
    const html = await buildPrintHtml(hoja());
    expect(html).toContain('EQ-NUEVO-4G');
    expect(html).not.toContain('EQ-VIEJO-3G');
    expect(html).not.toContain('111111111111111');
  });

  it('deja las fotos del sensor y las generales; saca las del cambio de equipo', async () => {
    const html = await buildPrintHtml(hoja());
    for (const id of ['f6', 'f7', 'f8']) expect(html).toContain(`${id}.jpg`);
    for (const id of ['f1', 'f2', 'f3', 'f4', 'f5']) expect(html).not.toContain(`${id}.jpg`);
  });

  it('no toca el record original (el panel sigue viendo todo)', async () => {
    const original = hoja();
    await buildPrintHtml(original);
    expect(original.motivoIntervencion).toBe('cambio_equipo');
    expect(original.cambioEquipoRazon).toBe('orden_interna');
    expect(original.equipo.modelo).toBe('EQ-VIEJO-3G');
    expect(original.post.fotos).toHaveLength(8);
  });
});

describe('PDF del cliente: los demás casos quedan como hoy', () => {
  it('actualización 3G a 4G con sensor: el cambio de equipo SÍ figura, con el equipo retirado y todas las fotos', async () => {
    const html = await buildPrintHtml(hoja({ cambioEquipoRazon: 'actualizacion_4g' }));
    expect(html).toContain('Cambio de equipo');
    expect(html).toContain('Instalación de sensor o módulo');
    expect(html).toContain('EQ-VIEJO-3G');
    expect(html).toContain('EQ-NUEVO-4G');
    for (const id of ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8']) expect(html).toContain(`${id}.jpg`);
  });

  it('orden interna sin sensor: se imprime el cambio de equipo completo', async () => {
    const html = await buildPrintHtml(hoja({ instalaSensorModulo: false }));
    expect(html).toContain('Cambio de equipo');
    expect(html).not.toContain('Instalación de sensor o módulo');
    expect(html).toContain('EQ-VIEJO-3G');
  });

  it('una intervención sin cambio de equipo que instala un sensor muestra la pastilla del sensor', async () => {
    const html = await buildPrintHtml(hoja({ motivoIntervencion: 'otro', cambioEquipoRazon: null }));
    expect(html).toContain('Instalación de sensor o módulo');
    expect(html).not.toContain('Cambio de equipo');
  });
});
