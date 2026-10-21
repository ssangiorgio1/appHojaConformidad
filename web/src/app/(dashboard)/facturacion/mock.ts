// MAQUETA de facturación. Datos de ejemplo: nada de esto sale de la API ni de Odoo, y los precios son inventados.
// Los códigos y nombres de producto sí son los reales del mapeo (api/src/config/productoMapeo.ts, docs-mapeo-productos-pwa.md).
// Cuando exista el backend, el catálogo sale de product.product de Odoo y las líneas de sale.order.line / account.move.

export type TipoProducto = 'instala' | 'retira' | 'servicio' | 'accesorio' | 'abono';

export type ProductoOdoo = { codigo: string; nombre: string; tipo: TipoProducto; precio: number };

export const CATALOGO: ProductoOdoo[] = [
  { codigo: 'INS.001', nombre: 'Instalación GPS (comodato) + BP', tipo: 'instala', precio: 45000 },
  { codigo: 'INS.020', nombre: 'Instalación Corte de Motor', tipo: 'instala', precio: 22000 },
  { codigo: 'INS.027', nombre: 'Instalación de 3 Sensores de temperatura', tipo: 'instala', precio: 38000 },
  { codigo: 'INS.060', nombre: 'Venta + Instalación Cámara ADAS - DMS', tipo: 'instala', precio: 180000 },
  { codigo: 'INS.STR', nombre: 'Instalación antena Starlink', tipo: 'instala', precio: 60000 },
  { codigo: 'DES.001', nombre: 'Desinstalación equipo GPS', tipo: 'retira', precio: 18000 },
  { codigo: 'DES.103', nombre: 'Desinstalación de GPS', tipo: 'retira', precio: 18000 },
  { codigo: 'DES.100', nombre: 'Desinstalación corte de motor', tipo: 'retira', precio: 9000 },
  { codigo: 'CAM.001', nombre: 'Cambio de unidad (baja y alta en 48hs)', tipo: 'servicio', precio: 12000 },
  { codigo: 'CAM.002', nombre: 'Cambio de titularidad', tipo: 'servicio', precio: 8000 },
  { codigo: 'REP.002', nombre: 'Reparación técnica', tipo: 'servicio', precio: 25000 },
  { codigo: 'VIS.001', nombre: 'Visita técnica / revisión técnica', tipo: 'servicio', precio: 20000 },
  { codigo: 'VIS.003', nombre: 'Visita fallida', tipo: 'servicio', precio: 15000 },
  { codigo: 'LOST.001', nombre: 'Equipo perdido / destruido / robado / dañado', tipo: 'servicio', precio: 95000 },
  { codigo: 'INS.901', nombre: 'Cable de conexión (por cámara)', tipo: 'accesorio', precio: 3500 },
];

export const productoPorCodigo = (codigo: string) => CATALOGO.find((p) => p.codigo === codigo);

export type EstadoFactura = 'por_facturar' | 'borrador' | 'facturada';

export type EstadoHoja = 'sin_hoja' | 'en_curso' | 'completa';

// Una línea por unidad: lo que pedía la orden de venta frente a lo que quedó hecho en la hoja de conformidad.
export type LineaUnidad = {
  id: string;
  patente: string;
  pedido: string; // código de producto en la orden de venta
  hecho: string | null; // código de producto que reflejó la hoja (null = todavía no se hizo)
  hoja: EstadoHoja;
  cantidad: number;
  nota?: string;
};

// Cargos que salen de lo ocurrido en campo y que no estaban en la orden de venta.
export type CargoExtra = {
  id: string;
  codigo: string;
  origen: string; // de qué evento sale
  cantidad: number;
  incluir: boolean; // sugerido por defecto
};

export type TicketFacturable = {
  id: number;
  titulo: string;
  cliente: string;
  cuit: string;
  orden: string; // sale.order
  estado: EstadoFactura;
  factura?: { numero: string; fecha: string };
  unidades: LineaUnidad[];
  extras: CargoExtra[];
};

export const FACTURABLES: TicketFacturable[] = [
  {
    id: 39088,
    titulo: 'Cambio de unidad',
    cliente: 'Distribuidora de Electricidad del Este S.A.',
    cuit: '30-12345678-9',
    orden: 'S00412',
    estado: 'por_facturar',
    unidades: [
      { id: 'u1', patente: 'IOS 192', pedido: 'DES.103', hecho: 'DES.103', hoja: 'completa', cantidad: 1, nota: 'Origen: el equipo vuelve al laboratorio' },
      { id: 'u2', patente: 'AF 098 HX', pedido: 'INS.001', hecho: null, hoja: 'sin_hoja', cantidad: 1, nota: 'Destino: agendada para el 16/10' },
      { id: 'u3', patente: 'IOS 192 → AF 098 HX', pedido: 'CAM.001', hecho: 'CAM.001', hoja: 'completa', cantidad: 1, nota: 'Cargo por el cambio de unidad' },
    ],
    extras: [],
  },
  {
    id: 39522,
    titulo: 'Retiro de equipos en base',
    cliente: 'Transportes del Sur S.R.L.',
    cuit: '30-87654321-0',
    orden: 'S00398',
    estado: 'borrador',
    unidades: [
      { id: 'u1', patente: 'AD 880 CC', pedido: 'DES.001', hecho: 'DES.001', hoja: 'completa', cantidad: 1 },
      { id: 'u2', patente: 'AE 410 PL', pedido: 'DES.001', hecho: 'DES.001', hoja: 'completa', cantidad: 1 },
      { id: 'u3', patente: 'AF 233 KN', pedido: 'DES.001', hecho: null, hoja: 'en_curso', cantidad: 1, nota: 'Visita fallida: la unidad no estaba' },
    ],
    extras: [
      { id: 'e1', codigo: 'VIS.003', origen: 'Visita fallida en AF 233 KN (14/10)', cantidad: 1, incluir: true },
      { id: 'e2', codigo: 'LOST.001', origen: 'Equipo AE 410 PL entregado dañado', cantidad: 1, incluir: false },
    ],
  },
  {
    id: 39509,
    titulo: 'Instalación de 2 unidades con cámaras',
    cliente: 'Vial Lavalle S.A.',
    cuit: '30-55512345-6',
    orden: 'S00377',
    estado: 'facturada',
    factura: { numero: 'A 0003-00001284', fecha: '13/10/2026' },
    unidades: [
      { id: 'u1', patente: 'JQE 994', pedido: 'INS.060', hecho: 'INS.060', hoja: 'completa', cantidad: 1 },
      { id: 'u2', patente: 'BGJ 01', pedido: 'INS.060', hecho: 'INS.060', hoja: 'completa', cantidad: 1 },
    ],
    extras: [{ id: 'e1', codigo: 'INS.901', origen: 'Cable por cámara (2 usados de más)', cantidad: 2, incluir: true }],
  },
];
