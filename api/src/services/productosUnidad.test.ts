import { describe, expect, it } from 'vitest';
import { PRODUCTOS_MAPEO } from '../config/productoMapeo.js';
import { aplicarEsperado, idsDeLineas, type DetalleLinea, type TareaConUnidades } from './productosUnidad.js';

const id = (codigo: string) => PRODUCTOS_MAPEO.find((p) => p.codigo === codigo)!.odooId;

function unidad(lineas: number[]) {
  return { productos: lineas.map((l) => ({ id: l, label: `línea ${l}`, productId: null, cantidad: null })), esperado: null };
}

describe('aplicarEsperado', () => {
  it('lote: cada subtarea resuelve lo suyo y la tarea padre no', () => {
    const tarea: TareaConUnidades = { ...unidad([]), subtasks: [unidad([1]), unidad([2, 3])] };
    const detalle = new Map<number, DetalleLinea>([
      [1, { productId: id('INS.001'), cantidad: 1 }],
      [2, { productId: id('INS.026'), cantidad: 1 }],
      [3, { productId: id('INS.030'), cantidad: 2 }],
    ]);
    aplicarEsperado([tarea], detalle);
    expect(tarea.subtasks[0].esperado?.instalar).toEqual({ equipo: true, casillas: { modBPanico: 1 } });
    expect(tarea.subtasks[1].esperado?.instalar.casillas).toEqual({ sensorTemperatura: 2, sensorAperturaPuertas: 2 });
    expect(tarea.esperado).toBeNull();
    expect(tarea.subtasks[1].productos[1]).toMatchObject({ productId: id('INS.030'), cantidad: 2 });
  });

  it('tarea sin subtareas: resuelve por la tarea misma', () => {
    const tarea: TareaConUnidades = { ...unidad([7]), subtasks: [] };
    aplicarEsperado([tarea], new Map([[7, { productId: id('INS.020'), cantidad: 1 }]]));
    expect(tarea.esperado?.instalar.casillas).toEqual({ modCMotor: 1 });
  });

  it('una unidad sin productos no restringe', () => {
    const tarea: TareaConUnidades = { ...unidad([]), subtasks: [unidad([])] };
    aplicarEsperado([tarea], new Map());
    expect(tarea.subtasks[0].esperado?.hayHardware).toBe(false);
  });

  it('una línea que Odoo no devolvió queda sin producto y no cuenta', () => {
    const tarea: TareaConUnidades = { ...unidad([]), subtasks: [unidad([9])] };
    aplicarEsperado([tarea], new Map());
    expect(tarea.subtasks[0].productos[0].productId).toBeNull();
    expect(tarea.subtasks[0].esperado?.hayHardware).toBe(false);
  });
});

describe('idsDeLineas', () => {
  it('junta las líneas de tareas y subtareas sin repetir', () => {
    const t1: TareaConUnidades = { ...unidad([1]), subtasks: [unidad([2, 3])] };
    const t2: TareaConUnidades = { ...unidad([3]), subtasks: [unidad([4])] };
    expect(idsDeLineas([t1, t2]).sort()).toEqual([1, 2, 3, 4]);
  });
});
