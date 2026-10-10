// MAQUETA del módulo de inventario (docs-inventario-tecnico.md). Datos de ejemplo: nada de esto sale de la API.
// Cuando exista el backend, estos tipos se reemplazan por los del modelo real (ProductoStock, ItemSerie, StockCantidad).

export type EstadoSerie = 'disponible' | 'en_revision' | 'rma' | 'en_tecnico';

export type ItemSerie = { serie: string; imei: string; estado: EstadoSerie; nota?: string };

export type Producto = {
  id: string;
  codigo: string;
  nombre: string;
  grupo: string; // nodo de primer nivel del árbol
  categoria: string; // nodo de segundo nivel
  tipo: 'serializado' | 'cantidad';
  minimo: number; // alerta de stock bajo (depósito)
};

export const PRODUCTOS: Producto[] = [
  { id: 'gps-fmb920', codigo: 'GPS.FMB920', nombre: 'GPS Teltonika FMB920', grupo: 'Equipos', categoria: 'GPS', tipo: 'serializado', minimo: 10 },
  { id: 'gps-fmc130', codigo: 'GPS.FMC130', nombre: 'GPS Teltonika FMC130', grupo: 'Equipos', categoria: 'GPS', tipo: 'serializado', minimo: 5 },
  { id: 'gps-2102', codigo: 'GPS.2102', nombre: 'GPS modelo 2102778', grupo: 'Equipos', categoria: 'GPS', tipo: 'serializado', minimo: 5 },
  { id: 'pantalla-a33w', codigo: 'PAN.A33W', nombre: 'Pantalla A33W', grupo: 'Equipos', categoria: 'Pantallas', tipo: 'serializado', minimo: 3 },
  { id: 'mdvr', codigo: 'VID.MDVR', nombre: 'Grabador MDVR', grupo: 'Video', categoria: 'Grabadores', tipo: 'serializado', minimo: 2 },
  { id: 'camara', codigo: 'VID.CAM', nombre: 'Cámara', grupo: 'Video', categoria: 'Cámaras', tipo: 'cantidad', minimo: 10 },
  { id: 'varilla', codigo: 'SEN.VAR', nombre: 'Varilla de combustible', grupo: 'Sensores', categoria: 'Combustible', tipo: 'cantidad', minimo: 6 },
  { id: 'temperatura', codigo: 'SEN.TEMP', nombre: 'Sensor de temperatura', grupo: 'Sensores', categoria: 'Ambiente', tipo: 'cantidad', minimo: 6 },
  { id: 'puerta', codigo: 'SEN.PUE', nombre: 'Sensor de apertura de puertas', grupo: 'Sensores', categoria: 'Ambiente', tipo: 'cantidad', minimo: 6 },
  { id: 'boton-panico', codigo: 'MOD.PAN', nombre: 'Botón de pánico', grupo: 'Módulos', categoria: 'Seguridad', tipo: 'cantidad', minimo: 8 },
  { id: 'corte-motor', codigo: 'MOD.COR', nombre: 'Corte de motor', grupo: 'Módulos', categoria: 'Seguridad', tipo: 'cantidad', minimo: 8 },
  { id: 'rfid', codigo: 'MOD.RFID', nombre: 'Lector RFID', grupo: 'Módulos', categoria: 'Identificación', tipo: 'cantidad', minimo: 4 },
  { id: 'canbus', codigo: 'MOD.CAN', nombre: 'Módulo CANbus', grupo: 'Módulos', categoria: 'Identificación', tipo: 'cantidad', minimo: 4 },
  { id: 'ramal', codigo: 'ACC.RAM', nombre: 'Ramal', grupo: 'Accesorios', categoria: 'Ramales', tipo: 'cantidad', minimo: 20 },
];

// ---- Generación determinística de series (para que la maqueta sea estable entre renders) ----
function imei(base: number): string {
  return String(868450041000000 + base * 7919).padStart(15, '0');
}

function series(prefix: string, desde: number, n: number, overrides: Record<number, Partial<ItemSerie>> = {}): ItemSerie[] {
  return Array.from({ length: n }, (_, i) => ({
    serie: `${prefix}${String(desde + i).padStart(5, '0')}`,
    imei: imei(desde + i),
    estado: 'disponible' as EstadoSerie,
    ...overrides[i],
  }));
}

export type StockDeposito = { productoId: string; cantidad?: number; series?: ItemSerie[] };

export const STOCK_DEPOSITO: StockDeposito[] = [
  {
    productoId: 'gps-fmb920',
    series: series('FMB', 1200, 14, {
      11: { estado: 'en_revision', nota: 'Devuelto de AD 880 CC' },
      12: { estado: 'en_revision', nota: 'Devuelto de AC 278 ZG' },
      13: { estado: 'rma', nota: 'No enciende' },
    }),
  },
  { productoId: 'gps-fmc130', series: series('FMC', 340, 4, { 3: { estado: 'en_revision', nota: 'Carcasa dañada' } }) },
  { productoId: 'gps-2102', series: series('G21', 780, 9) },
  { productoId: 'pantalla-a33w', series: series('A33', 90, 2) },
  { productoId: 'mdvr', series: series('MDV', 15, 5) },
  { productoId: 'camara', cantidad: 22 },
  { productoId: 'varilla', cantidad: 9 },
  { productoId: 'temperatura', cantidad: 3 },
  { productoId: 'puerta', cantidad: 14 },
  { productoId: 'boton-panico', cantidad: 31 },
  { productoId: 'corte-motor', cantidad: 12 },
  { productoId: 'rfid', cantidad: 2 },
  { productoId: 'canbus', cantidad: 7 },
  { productoId: 'ramal', cantidad: 64 },
];

export type Tecnico = { id: string; nombre: string; zona: string };

export const TECNICOS: Tecnico[] = [
  { id: 't1', nombre: 'Carlos Méndez', zona: 'Zona Norte' },
  { id: 't2', nombre: 'Lucía Fernández', zona: 'CABA' },
  { id: 't3', nombre: 'Martín Ríos', zona: 'Zona Sur' },
  { id: 't4', nombre: 'Sofía Paredes', zona: 'Zona Oeste' },
];

export type StockTecnico = { tecnicoId: string; productoId: string; cantidad?: number; series?: ItemSerie[] };

const enTecnico = (prefix: string, desde: number, n: number): ItemSerie[] =>
  series(prefix, desde, n).map((s) => ({ ...s, estado: 'en_tecnico' as EstadoSerie }));

export const STOCK_TECNICOS: StockTecnico[] = [
  { tecnicoId: 't1', productoId: 'gps-fmb920', series: enTecnico('FMB', 1100, 3) },
  { tecnicoId: 't1', productoId: 'boton-panico', cantidad: 4 },
  { tecnicoId: 't1', productoId: 'corte-motor', cantidad: 2 },
  { tecnicoId: 't1', productoId: 'ramal', cantidad: 8 },
  { tecnicoId: 't1', productoId: 'puerta', cantidad: 1 },
  { tecnicoId: 't2', productoId: 'gps-fmb920', series: enTecnico('FMB', 1150, 2) },
  { tecnicoId: 't2', productoId: 'gps-2102', series: enTecnico('G21', 700, 1) },
  { tecnicoId: 't2', productoId: 'boton-panico', cantidad: 2 },
  { tecnicoId: 't2', productoId: 'ramal', cantidad: 5 },
  { tecnicoId: 't2', productoId: 'camara', cantidad: 3 },
  { tecnicoId: 't2', productoId: 'mdvr', series: enTecnico('MDV', 8, 1) },
  { tecnicoId: 't3', productoId: 'gps-fmb920', series: enTecnico('FMB', 1180, 1) },
  { tecnicoId: 't3', productoId: 'boton-panico', cantidad: 0 },
  { tecnicoId: 't3', productoId: 'varilla', cantidad: 2 },
  { tecnicoId: 't3', productoId: 'ramal', cantidad: 2 },
  { tecnicoId: 't4', productoId: 'gps-fmc130', series: enTecnico('FMC', 330, 2) },
  { tecnicoId: 't4', productoId: 'boton-panico', cantidad: 5 },
  { tecnicoId: 't4', productoId: 'corte-motor', cantidad: 3 },
  { tecnicoId: 't4', productoId: 'rfid', cantidad: 1 },
  { tecnicoId: 't4', productoId: 'ramal', cantidad: 10 },
];

// Lo que las visitas de los próximos días van a consumir según la receta (para mostrar el faltante).
export const CONSUMO_PREVISTO: { tecnicoId: string; productoId: string; cantidad: number; detalle: string }[] = [
  { tecnicoId: 't3', productoId: 'boton-panico', cantidad: 2, detalle: '2 visitas: "Instalar botón de pánico y GPS"' },
  { tecnicoId: 't3', productoId: 'gps-fmb920', cantidad: 3, detalle: '3 instalaciones esta semana' },
  { tecnicoId: 't1', productoId: 'puerta', cantidad: 2, detalle: 'Visita en Pilar (apertura de puertas)' },
];

export type TransferenciaMock = {
  id: string;
  fecha: string;
  tecnicoId: string;
  estado: 'pendiente' | 'en_transito' | 'recibida';
  lineas: { productoId: string; cantidad: number }[];
};

export const TRANSFERENCIAS: TransferenciaMock[] = [
  { id: 'T-0042', fecha: '2026-10-09', tecnicoId: 't3', estado: 'pendiente', lineas: [{ productoId: 'boton-panico', cantidad: 4 }, { productoId: 'gps-fmb920', cantidad: 3 }] },
  { id: 'T-0041', fecha: '2026-10-08', tecnicoId: 't1', estado: 'en_transito', lineas: [{ productoId: 'puerta', cantidad: 4 }, { productoId: 'ramal', cantidad: 10 }] },
  { id: 'T-0040', fecha: '2026-10-06', tecnicoId: 't2', estado: 'recibida', lineas: [{ productoId: 'camara', cantidad: 3 }, { productoId: 'mdvr', cantidad: 1 }] },
];

export const productoPorId = (id: string): Producto => PRODUCTOS.find((p) => p.id === id)!;

export function cantidadDe(item: { cantidad?: number; series?: ItemSerie[] } | undefined): number {
  if (!item) return 0;
  return item.series ? item.series.length : (item.cantidad ?? 0);
}
