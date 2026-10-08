import { describe, expect, it } from 'vitest';
import { resolverEsperado } from '../config/productoMapeo.js';
import { sugerirTipoServicio } from './tipoServicioSugerido.js';

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
  it('instala y retira a la vez: cambio de equipo', () => {
    expect(sugerirTipoServicio(resolverEsperado([INS001, DES103]), [])?.tipo).toBe('cambio_equipo');
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
});
