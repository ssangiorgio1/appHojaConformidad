import { describe, expect, it } from 'vitest';
import { resolverEsperado } from '../config/productoMapeo.js';
import { sugerirTipoServicio, marcarCambioUnidad, fijarTipoOdoo, tipoServicioDeOdoo, type SugerenciaTipoServicio } from './tipoServicioSugerido.js';

// Ids reales del catálogo (ver productoMapeo.ts): 503 = INS.001 (instala), 544 = DES.103 (retira).
const INS001 = { productId: 503, cantidad: 1 };
const DES103 = { productId: 544, cantidad: 1 };

describe('sugerirTipoServicio', () => {
  it('por producto: instalación', () => {
    expect(sugerirTipoServicio(resolverEsperado([INS001]), [])).toEqual({ tipo: 'instalacion', fuente: 'producto' });
  });
  it('por producto: desinstalación', () => {
    expect(sugerirTipoServicio(resolverEsperado([DES103]), [])).toEqual({ tipo: 'desinstalacion', fuente: 'producto' });
  });
  it('instala y retira en la misma unidad: intervención', () => {
    expect(sugerirTipoServicio(resolverEsperado([INS001, DES103]), [])?.tipo).toBe('reparacion');
  });
  it('sin productos: usa la etiqueta', () => {
    expect(sugerirTipoServicio(null, [125])).toEqual({ tipo: 'desinstalacion', fuente: 'etiqueta' });
    expect(sugerirTipoServicio(resolverEsperado([]), [56])).toEqual({ tipo: 'instalacion', fuente: 'etiqueta' });
  });
  it('el producto manda sobre la etiqueta', () => {
    expect(sugerirTipoServicio(resolverEsperado([INS001]), [125])?.tipo).toBe('instalacion');
  });
  it('un producto de retiro/entrega gana sobre todo', () => {
    const esperado = resolverEsperado([]);
    esperado.recepcionEquipo = true;
    expect(sugerirTipoServicio(esperado, [56])).toEqual({ tipo: 'retiro_entrega', fuente: 'producto' });
  });
  it('sin datos no sugiere nada', () => {
    expect(sugerirTipoServicio(null, [])).toBeNull();
    expect(sugerirTipoServicio(resolverEsperado([]), [9999])).toBeNull();
  });

  describe('marcarCambioUnidad', () => {
    const u = (tipo: 'instalacion' | 'desinstalacion', fuente: 'producto' | 'etiqueta' = 'producto') => ({
      tipoServicioSugerido: { tipo, fuente } as SugerenciaTipoServicio | null,
    });

    it('una subtarea que desinstala y otra que instala: las marca como origen y destino', () => {
      const unidades = [u('desinstalacion'), u('instalacion')];
      marcarCambioUnidad(unidades);
      expect(unidades[0].tipoServicioSugerido).toMatchObject({ tipo: 'cambio_unidad', rolCambioUnidad: 'origen' });
      expect(unidades[1].tipoServicioSugerido).toMatchObject({ tipo: 'cambio_unidad', rolCambioUnidad: 'destino' });
    });
    it('con varias instalaciones (un lote) no marca nada', () => {
      const unidades = [u('desinstalacion'), u('instalacion'), u('instalacion')];
      marcarCambioUnidad(unidades);
      expect(unidades.map((x) => x.tipoServicioSugerido?.tipo)).toEqual(['desinstalacion', 'instalacion', 'instalacion']);
    });
    it('si el tipo sale de la etiqueta y no del producto, no marca nada', () => {
      const unidades = [u('desinstalacion', 'etiqueta'), u('instalacion')];
      marcarCambioUnidad(unidades);
      expect(unidades[0].tipoServicioSugerido?.tipo).toBe('desinstalacion');
    });
    it('sin una de las dos patas no marca nada', () => {
      const unidades = [u('desinstalacion')];
      marcarCambioUnidad(unidades);
      expect(unidades[0].tipoServicioSugerido?.tipo).toBe('desinstalacion');
    });
  });
});

describe('tipo de servicio de Odoo', () => {
  it('mapea los cuatro valores del campo, incluido "Desintalación" con el error de tipeo', () => {
    expect(tipoServicioDeOdoo('Instalación')).toBe('instalacion');
    expect(tipoServicioDeOdoo('Desintalación')).toBe('desinstalacion');
    expect(tipoServicioDeOdoo('Intervención')).toBe('reparacion');
    expect(tipoServicioDeOdoo('Cambio de Unidad')).toBe('cambio_unidad');
  });
  it('acepta la ortografía corregida y mayúsculas', () => {
    expect(tipoServicioDeOdoo('Desinstalación')).toBe('desinstalacion');
    expect(tipoServicioDeOdoo('INTERVENCION')).toBe('reparacion');
  });
  it('vacío o desconocido no fija nada', () => {
    expect(tipoServicioDeOdoo(false)).toBeNull();
    expect(tipoServicioDeOdoo(null)).toBeNull();
    expect(tipoServicioDeOdoo('')).toBeNull();
    expect(tipoServicioDeOdoo('constructor')).toBeNull();
    expect(tipoServicioDeOdoo('Otra cosa')).toBeNull();
  });
  it('manda sobre el producto y la etiqueta', () => {
    expect(fijarTipoOdoo({ tipo: 'instalacion', fuente: 'producto' }, 'reparacion')).toEqual({ tipo: 'reparacion', fuente: 'odoo' });
    expect(fijarTipoOdoo({ tipo: 'desinstalacion', fuente: 'etiqueta' }, 'instalacion')).toEqual({ tipo: 'instalacion', fuente: 'odoo' });
    expect(fijarTipoOdoo(null, 'desinstalacion')).toEqual({ tipo: 'desinstalacion', fuente: 'odoo' });
  });
  it('sin valor en Odoo deja la sugerencia como estaba', () => {
    const s: SugerenciaTipoServicio = { tipo: 'instalacion', fuente: 'producto' };
    expect(fijarTipoOdoo(s, null)).toBe(s);
    expect(fijarTipoOdoo(null, null)).toBeNull();
  });
  it('el retiro/entrega por producto no se pisa (no es un PRE)', () => {
    const s: SugerenciaTipoServicio = { tipo: 'retiro_entrega', fuente: 'producto' };
    expect(fijarTipoOdoo(s, 'instalacion')).toBe(s);
  });
  it('cambio de unidad conserva origen/destino deducido por producto; si no, queda sin pata', () => {
    expect(fijarTipoOdoo({ tipo: 'cambio_unidad', fuente: 'producto', rolCambioUnidad: 'origen' }, 'cambio_unidad')).toEqual({
      tipo: 'cambio_unidad',
      fuente: 'odoo',
      rolCambioUnidad: 'origen',
    });
    expect(fijarTipoOdoo({ tipo: 'instalacion', fuente: 'producto' }, 'cambio_unidad')).toEqual({ tipo: 'cambio_unidad', fuente: 'odoo' });
  });
  it('si Odoo dice otro tipo, la pata de cambio de unidad deducida por producto se descarta', () => {
    expect(fijarTipoOdoo({ tipo: 'cambio_unidad', fuente: 'producto', rolCambioUnidad: 'destino' }, 'instalacion')).toEqual({ tipo: 'instalacion', fuente: 'odoo' });
  });
});
