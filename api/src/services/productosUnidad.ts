import { resolverEsperado, type EsperadoUnidad } from '../config/productoMapeo.js';

// Producto de una unidad tal como lo cargó coordinación en Odoo: la línea de la orden de venta
// (`sale_line_id` de la tarea), con su producto y cantidad una vez resueltos (ver aplicarEsperado).
export interface ProductoUnidad {
  // Id de la línea de la orden de venta (sale.order.line).
  id: number;
  label: string;
  // product.product.id de la línea y cantidad vendida; null hasta leer la línea en Odoo (o si no se pudo).
  productId: number | null;
  cantidad: number | null;
}

// Forma mínima de lo que recorre aplicarEsperado: así este archivo no depende de calendarTask.service (ni de Odoo).
export interface UnidadConProductos {
  productos: ProductoUnidad[];
  esperado: EsperadoUnidad | null;
}

export interface TareaConUnidades extends UnidadConProductos {
  subtasks: UnidadConProductos[];
}

export interface DetalleLinea {
  productId: number | null;
  cantidad: number;
}

// Ids de todas las líneas de venta de las tareas y sus unidades (sin repetir), para leerlas en Odoo de una vez.
export function idsDeLineas(tareas: TareaConUnidades[]): number[] {
  const ids = new Set<number>();
  for (const t of tareas) {
    for (const p of t.productos) ids.add(p.id);
    for (const s of t.subtasks) for (const p of s.productos) ids.add(p.id);
  }
  return [...ids];
}

function completar(unidad: UnidadConProductos, detalle: Map<number, DetalleLinea>): void {
  for (const p of unidad.productos) {
    const d = detalle.get(p.id);
    if (d) {
      p.productId = d.productId;
      p.cantidad = d.cantidad;
    }
  }
  unidad.esperado = resolverEsperado(
    unidad.productos.filter((p) => p.productId !== null).map((p) => ({ productId: p.productId as number, cantidad: p.cantidad ?? 1 })),
  );
}

// Completa producto/cantidad de cada línea y calcula `esperado` por unidad (subtarea) y, en tareas sin subtareas,
// por la tarea misma. Una unidad sin ninguna línea queda con `esperado.hayHardware = false`: nada que restringir
// (la PWA avisa que falta cargar el producto, ver docs-mapeo-productos-pwa.md).
export function aplicarEsperado(tareas: TareaConUnidades[], detalle: Map<number, DetalleLinea>): void {
  for (const t of tareas) {
    if (t.subtasks.length > 0) {
      for (const s of t.subtasks) completar(s, detalle);
    } else {
      completar(t, detalle);
    }
  }
}
