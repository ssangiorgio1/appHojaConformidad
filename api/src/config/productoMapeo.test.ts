import { describe, expect, it } from 'vitest';
import { EQUIP_GROUPS } from '@wara/shared';
import { PRODUCTOS_MAPEO, resolverEsperado } from './productoMapeo.js';

interface Campo {
  key: string;
  checkbox?: boolean;
  cantidad?: boolean;
  dependsOn?: string;
}
// EQUIP_GROUPS es una unión de tuplas literales: se tipa de forma plana para poder recorrerla.
const GRUPOS = EQUIP_GROUPS as unknown as ReadonlyArray<{ title: string; fields: ReadonlyArray<Campo> }>;

// Casillas instalables de la PWA (antenas, sensores, módulos y elementos adicionales; no "Control" ni "Entradas / Salidas").
const CASILLAS = new Set<string>(
  GRUPOS.filter((g) => g.title !== 'Control de instalación' && g.title !== 'Entradas / Salidas').flatMap((g) =>
    g.fields.filter((f) => f.checkbox === true).map((f) => f.key),
  ),
);
const TIENEN_CANTIDAD = new Set<string>(
  GRUPOS.flatMap((g) => g.fields)
    .filter((f) => f.cantidad === true && f.dependsOn)
    .map((f) => f.dependsOn as string),
);

describe('productoMapeo', () => {
  it('toda casilla mapeada existe en la PWA', () => {
    for (const p of PRODUCTOS_MAPEO) for (const it of p.items ?? []) expect(CASILLAS.has(it.key), `${p.codigo}: ${it.key}`).toBe(true);
  });

  it('solo se pide más de 1 (o "linea") en casillas que admiten cantidad al instalar', () => {
    for (const p of PRODUCTOS_MAPEO.filter((x) => x.tipo === 'instala'))
      for (const it of p.items ?? []) {
        if (it.cantidad !== undefined && it.cantidad !== 1) expect(TIENEN_CANTIDAD.has(it.key), `${p.codigo}: ${it.key}`).toBe(true);
      }
  });

  it('los ids de Odoo no se repiten', () => {
    const ids = PRODUCTOS_MAPEO.map((p) => p.odooId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('solo instala/retira llevan casillas o equipo', () => {
    for (const p of PRODUCTOS_MAPEO.filter((x) => !['instala', 'retira'].includes(x.tipo))) {
      expect(p.equipo, p.codigo).toBeFalsy();
      expect(p.items ?? [], p.codigo).toHaveLength(0);
    }
  });
});

describe('resolverEsperado', () => {
  const id = (codigo: string) => PRODUCTOS_MAPEO.find((p) => p.codigo === codigo)!.odooId;

  it('suma equipo y casillas de varias líneas', () => {
    const e = resolverEsperado([
      { productId: id('INS.001'), cantidad: 1 },
      { productId: id('INS.026'), cantidad: 1 },
    ]);
    expect(e.instalar.equipo).toBe(true);
    expect(e.instalar.casillas).toEqual({ modBPanico: 1, sensorTemperatura: 2 });
    expect(e.hayHardware).toBe(true);
  });

  it('usa la cantidad de la línea cuando el producto se vende por unidad (puertas)', () => {
    expect(resolverEsperado([{ productId: id('INS.030'), cantidad: 3 }]).instalar.casillas).toEqual({ sensorAperturaPuertas: 3 });
  });

  it('las desinstalaciones van a retirar', () => {
    const e = resolverEsperado([{ productId: id('DES.100'), cantidad: 1 }]);
    expect(e.retirar.casillas).toEqual({ modCMotor: 1 });
    expect(e.instalar.casillas).toEqual({});
  });

  it('servicios, accesorios y abonos no cuentan como hardware', () => {
    const e = resolverEsperado([
      { productId: id('REP.002'), cantidad: 1 },
      { productId: id('INS.600'), cantidad: 2 },
      { productId: id('ABN.001'), cantidad: 1 },
    ]);
    expect(e.hayHardware).toBe(false);
    expect(e.sinMapear).toEqual([]);
  });

  it('un producto desconocido queda en sinMapear y no restringe', () => {
    const e = resolverEsperado([{ productId: 999999, cantidad: 1 }]);
    expect(e.sinMapear).toEqual([999999]);
    expect(e.hayHardware).toBe(false);
  });

  it('el hardware sin casilla en la PWA se informa aparte', () => {
    const e = resolverEsperado([{ productId: id('INS.906'), cantidad: 1 }]);
    expect(e.sinCasilla.map((p) => p.codigo)).toEqual(['INS.906']);
    expect(e.hayHardware).toBe(true);
  });
});
