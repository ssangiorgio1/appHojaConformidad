// Mapeo de productos de Odoo (product.product) a lo que se instala/retira en la PWA (casillas de "Módulos y
// sensores", ver EQUIP_GROUPS en @wara/shared). Es la base de la regla: el técnico solo puede instalar lo que tiene
// cargado en la orden de venta de la unidad; si el cliente quiere algo más, comercial/coordinación suma el producto a
// la orden de venta (y a la unidad) en Odoo y recién ahí se habilita. Ver docs-mapeo-productos-pwa.md.
//
// Se mapea por `odooId` (product.product.id) y no por código: el código INS.051 está duplicado en Odoo (pantalla de
// 7" y soporte de 10"). `codigo`/`nombre` son solo para leer este archivo.
//
// Fuentes: catálogo de Odoo (productos vendibles de "Instalaciones", "Reparaciones y servicios", DES.* y abonos) y
// lista_precios_wara.csv (confirmaciones del 2026-09-23 sobre combos, stock y qué genera visita), al 2026-10-06.
// Los ~30 productos del catálogo sin código (ítems de licitaciones/exportación) no están mapeados.
// `revisar: true` = clasificación probable, a confirmar con quien conoce el producto.

export type TipoProducto =
  | 'instala' // se instala algo (equipo y/o casillas de la PWA)
  | 'retira' // se desinstala algo
  | 'retiro_entrega' // el cliente entrega o deja el equipo (5º tipo de servicio): sin intervención de la unidad
  | 'accesorio' // parte de otro producto: sin casilla propia, no restringe
  | 'servicio' // mano de obra, visitas, reparaciones, entregas, cargos administrativos: no restringe
  | 'sin_casilla' // hardware instalable que la PWA todavía no tiene como casilla (brecha)
  | 'abono'; // abono mensual: no se instala, no restringe

// Claves de casillas de la PWA (EQUIP_GROUPS: antenas, sensores, módulos y elementos adicionales).
export type CasillaInstalable =
  | 'antenaGpsExt'
  | 'sensorTemperatura'
  | 'sensorAperturaPuertas'
  | 'sensorAperturaPSemi'
  | 'sensorGiro'
  | 'canbus'
  | 'medComb'
  | 'desAcopSemi'
  | 'modCMotor'
  | 'modMicrofono'
  | 'modBPanico'
  | 'modBuzzerVelocidad'
  | 'modIdConductor'
  | 'modRFID'
  | 'modPantallaSerie'
  | 'camarasAdas'
  | 'moduloWifi'
  | 'antenaStarlink';

export interface ItemEsperado {
  key: CasillaInstalable;
  // Número fijo (default 1) o 'linea': la cantidad vendida en la línea de la orden (ej. sensor de puerta, por puerta).
  cantidad?: number | 'linea';
}

export interface ProductoMapeo {
  odooId: number;
  codigo: string;
  nombre: string;
  tipo: TipoProducto;
  // Incluye el equipo GPS en sí (modelo/IMEI), no solo casillas.
  equipo?: boolean;
  items?: ItemEsperado[];
  revisar?: boolean;
  nota?: string;
}

export const PRODUCTOS_MAPEO: ProductoMapeo[] = [
  { odooId: 477, codigo: 'AVL001', nombre: 'Equipo AVL - GPS (venta) GS-12', tipo: 'instala', equipo: true, revisar: true, nota: 'Venta del equipo: confirmar si siempre se instala' },
  { odooId: 599, codigo: 'AVL002', nombre: 'Equipo GPS (venta)', tipo: 'instala', equipo: true, revisar: true, nota: 'Venta del equipo: confirmar si siempre se instala' },
  { odooId: 615, codigo: 'CM.001', nombre: 'Instalación GPS + BP + CAN BUS', tipo: 'instala', equipo: true, items: [{ key: 'modBPanico' }, { key: 'canbus' }], nota: 'GPS + BP + CAN BUS' },
  { odooId: 616, codigo: 'CM.002', nombre: 'Instalación GPS + BP + CAB BUS (más de 1.000 un.)', tipo: 'instala', equipo: true, items: [{ key: 'modBPanico' }, { key: 'canbus' }], nota: 'Igual que CM.001 (más de 1.000 un.)' },
  { odooId: 503, codigo: 'INS.001', nombre: 'Instalación GPS (comodato) + BP', tipo: 'instala', equipo: true, items: [{ key: 'modBPanico' }], nota: 'Combo confirmado 2026-09-23: siempre 1 equipo + 1 botón de pánico' },
  { odooId: 56, codigo: 'INS.005', nombre: 'Varilla de combustible + Instalación', tipo: 'instala', items: [{ key: 'medComb' }], nota: 'Varilla de combustible + instalación' },
  { odooId: 86, codigo: 'INS.010', nombre: 'Instalación modulo lector CANBUS + GPS', tipo: 'instala', equipo: true, items: [{ key: 'canbus' }], revisar: true, nota: 'Confirmado en parte 2026-09-23: es una variante de equipo "full" que ya soporta CANBUS (solo se conecta un cable, no hay un módulo de hardware aparte); pendiente aclarar cómo se relaciona con la familia de INS.001' },
  { odooId: 88, codigo: 'INS.015', nombre: 'Identificador de chofer con 3 llaveros (RFID)', tipo: 'instala', items: [{ key: 'modRFID' }], nota: 'Combo (módulo lector RFID + 3 llaveros/tarjetas, confirmado 2026-09-23). Confirmado 2026-10-06: tilda "RFID"' },
  { odooId: 16, codigo: 'INS.020', nombre: 'Instalación Corte de Motor', tipo: 'instala', items: [{ key: 'modCMotor' }] },
  { odooId: 90, codigo: 'INS.025', nombre: 'Instalación de Sensor de temperatura', tipo: 'instala', items: [{ key: 'sensorTemperatura' }] },
  { odooId: 505, codigo: 'INS.026', nombre: 'Instalación de 2 Sensores de temperatura', tipo: 'instala', items: [{ key: 'sensorTemperatura', cantidad: 2 }] },
  { odooId: 93, codigo: 'INS.027', nombre: 'Instalación de 3 Sensores de temperatura', tipo: 'instala', items: [{ key: 'sensorTemperatura', cantidad: 3 }] },
  { odooId: 507, codigo: 'INS.030', nombre: 'Instalación de Sensor de puerta de cabina (por puerta)', tipo: 'instala', items: [{ key: 'sensorAperturaPuertas', cantidad: 'linea' }], nota: 'Se vende por puerta: la cantidad es la de la línea' },
  { odooId: 95, codigo: 'INS.031', nombre: 'Instalación Apertura de Puertas ACOPLADO', tipo: 'instala', items: [{ key: 'sensorAperturaPSemi', cantidad: 'linea' }], nota: 'Apertura de puertas de acoplado; confirmado 2026-10-06: corresponde a "Apertura p/semi"' },
  { odooId: 96, codigo: 'INS.040', nombre: 'Instalación de Micrófono en cabina', tipo: 'instala', items: [{ key: 'modMicrofono' }] },
  { odooId: 506, codigo: 'INS.045', nombre: 'Instalación de Sensor de Giro para Mixer', tipo: 'instala', items: [{ key: 'sensorGiro' }], nota: 'Combo (sensor de giro + módulo lector, confirmado 2026-09-23). Confirmado 2026-10-06: por ahora tilda solo "Sensor de giro"; el módulo lector no tiene casilla propia' },
  { odooId: 567, codigo: 'INS.051', nombre: 'Venta + Instalación Pantallas Multimedia 7" WARA 2025', tipo: 'instala', items: [{ key: 'modPantallaSerie' }], nota: 'Pantalla multimedia 7" (el código INS.051 está duplicado en Odoo: por eso se mapea por id)' },
  { odooId: 446, codigo: 'INS.060', nombre: 'Venta + Instalación Cámara ADAS - DMS', tipo: 'instala', items: [{ key: 'camarasAdas' }], nota: 'Cámara ADAS - DMS' },
  { odooId: 100, codigo: 'INS.065', nombre: 'Instalación Buzzer Exceso de velocidad', tipo: 'instala', items: [{ key: 'modBuzzerVelocidad' }] },
  { odooId: 24, codigo: 'INS.075', nombre: 'Instalación Desenganche de Acoplado (Ficha Triler)', tipo: 'instala', items: [{ key: 'desAcopSemi' }], nota: 'Desenganche de acoplado (ficha Triler)' },
  { odooId: 504, codigo: 'INS.080', nombre: 'Instalación Desenganche de acoplado (ficha vulcanizada)', tipo: 'instala', items: [{ key: 'desAcopSemi' }], nota: 'Desenganche de acoplado (ficha vulcanizada)' },
  { odooId: 58, codigo: 'INS.125', nombre: 'Venta + Instalación Pantallas Multimedia 10" WARA 2025', tipo: 'instala', items: [{ key: 'modPantallaSerie' }], nota: 'Pantalla multimedia 10"' },
  { odooId: 193, codigo: 'INS.401', nombre: 'Instalación de sensor de pánico', tipo: 'instala', items: [{ key: 'modBPanico' }], nota: 'Sensor de pánico: es un agregado de intervención, no una instalación nueva' },
  { odooId: 299, codigo: 'INS.407', nombre: 'Equipo GPS imantado (en comodato)', tipo: 'instala', equipo: true, nota: 'Equipo GPS imantado (comodato)' },
  { odooId: 177, codigo: 'INS.503', nombre: 'Instalación Anillo RFID para control de combustible', tipo: 'instala', items: [{ key: 'modRFID' }], revisar: true, nota: 'Anillo RFID para control de combustible; confirmar casilla' },
  { odooId: 307, codigo: 'INS.ANT', nombre: 'Instalación de extensión Antena GPS', tipo: 'instala', items: [{ key: 'antenaGpsExt' }], revisar: true, nota: 'Extensión de antena GPS ≈ "Antena GPS (Ext)"; confirmar' },
  { odooId: 475, codigo: 'INS.STR', nombre: 'Instalación antena Starlink', tipo: 'instala', items: [{ key: 'antenaStarlink' }] },
  { odooId: 580, codigo: 'MOD.001', nombre: 'Venta / Instalación módulo WI FI', tipo: 'instala', items: [{ key: 'moduloWifi' }] },
  { odooId: 126, codigo: 'DES.001', nombre: 'Desinstalación equipo GPS', tipo: 'retira', equipo: true, nota: 'Desinstalación equipo GPS' },
  { odooId: 295, codigo: 'DES.005', nombre: 'Desinstalación varilla de combustible', tipo: 'retira', items: [{ key: 'medComb' }] },
  { odooId: 542, codigo: 'DES.025', nombre: 'Desinstalación sensores de temperatura', tipo: 'retira', items: [{ key: 'sensorTemperatura', cantidad: 'linea' }], nota: 'Sensores de temperatura' },
  { odooId: 550, codigo: 'DES.045', nombre: 'Desinstalación  sensor de giro Mixer', tipo: 'retira', items: [{ key: 'sensorGiro' }], nota: 'Sensor de giro Mixer' },
  { odooId: 638, codigo: 'DES.050', nombre: 'Desinstalación  sensor apertura de puerta', tipo: 'retira', items: [{ key: 'sensorAperturaPuertas', cantidad: 'linea' }], nota: 'Sensor de apertura de puerta' },
  { odooId: 548, codigo: 'DES.060', nombre: 'Desinstalación Cámara detección fatiga ADAS y DMS', tipo: 'retira', items: [{ key: 'camarasAdas' }] },
  { odooId: 547, codigo: 'DES.065', nombre: 'Desinstalación Buzzer de velocidad', tipo: 'retira', items: [{ key: 'modBuzzerVelocidad' }] },
  { odooId: 541, codigo: 'DES.100', nombre: 'Desinstalación corte de motor', tipo: 'retira', items: [{ key: 'modCMotor' }] },
  { odooId: 543, codigo: 'DES.102', nombre: 'Desinstalación botón de pánico', tipo: 'retira', items: [{ key: 'modBPanico' }] },
  { odooId: 544, codigo: 'DES.103', nombre: 'Desinstalación de GPS', tipo: 'retira', equipo: true, nota: 'Desinstalación de GPS' },
  { odooId: 546, codigo: 'DES.105', nombre: 'Desinstalación micrófono en cabina', tipo: 'retira', items: [{ key: 'modMicrofono' }] },
  { odooId: 549, codigo: 'DES.108', nombre: 'Desinstalación Identificación de chofer RFID', tipo: 'retira', items: [{ key: 'modRFID' }], revisar: true, nota: 'Identificación de chofer RFID: por coherencia con INS.015 (que tilda "RFID") se mapea a "RFID"; confirmar' },
  { odooId: 551, codigo: 'DES.110', nombre: 'Desinstalación CANBUS', tipo: 'retira', items: [{ key: 'canbus' }] },
  { odooId: 545, codigo: 'DES.125', nombre: 'Desinstalación Pantalla Multimedia', tipo: 'retira', items: [{ key: 'modPantallaSerie' }] },
  { odooId: 620, codigo: 'INS.051', nombre: 'Soporte de pantalla 10"', tipo: 'accesorio', nota: 'Soporte de pantalla 10" (comparte el código INS.051 con la pantalla de 7")' },
  { odooId: 60, codigo: 'INS.600', nombre: 'Tapones de Varilla', tipo: 'accesorio', nota: 'Tapones de varilla: acompañan a la varilla' },
  { odooId: 651, codigo: 'INS.901', nombre: 'Cable de conexión (por cámara)', tipo: 'accesorio', nota: 'Cable de conexión por cámara' },
  { odooId: 242, codigo: 'Precio en USD oficiales', nombre: 'Placa para anuncio de paradas', tipo: 'accesorio', nota: 'Placa para anuncio de paradas (en Odoo tiene cargado como código el texto "Precio en USD oficiales")' },
  { odooId: 296, codigo: 'RFID.001', nombre: 'Tarjetas de RFID c/u (adicional)', tipo: 'accesorio', nota: 'Tarjetas RFID adicionales: acompañan al identificador' },
  { odooId: 669, codigo: 'SOP.STK', nombre: 'Soporte magnético antena Starlink', tipo: 'accesorio', nota: 'Soporte de antena Starlink' },
  { odooId: 672, codigo: 'SOP2.STK', nombre: 'Soporte simple antena Starlink', tipo: 'accesorio', nota: 'Soporte de antena Starlink' },
  { odooId: 181, codigo: 'CAM.001', nombre: 'Cambio de unidad (baja y alta en 48hs)', tipo: 'servicio', nota: 'Cambio de unidad (baja y alta)' },
  { odooId: 457, codigo: 'CAM.002', nombre: 'Cambio de titularidad', tipo: 'servicio', nota: 'Cambio de titularidad: administrativo, sin técnico' },
  { odooId: 572, codigo: 'CAM.003', nombre: 'Cambio de Pantalla Multimedia', tipo: 'servicio', nota: 'Cambio de pantalla multimedia' },
  { odooId: 678, codigo: 'CAM.004', nombre: 'Cambio de matrícula / grupo / interno', tipo: 'servicio', nota: 'Cambio de matrícula / grupo / interno' },
  { odooId: 508, codigo: 'GPS.001', nombre: 'Envío y entrega Equipo GPS (En comodato - instala el cliente)', tipo: 'servicio', nota: 'Envío del equipo en comodato: lo instala el cliente, no genera visita de técnico ni paso en la PWA' },
  { odooId: 64, codigo: 'GPS.002', nombre: 'Equipo GPS personal / imantado (envío al cliente) (comodato)', tipo: 'servicio', nota: 'Equipo personal/imantado (GS20/GS60) enviado al cliente: familia de equipo distinta a INS.001; no genera visita' },
  { odooId: 179, codigo: 'INS.400', nombre: 'Adicional por Instalación de equipo en caja estanca', tipo: 'servicio', nota: 'Adicional por equipo en caja estanca' },
  { odooId: 677, codigo: 'INS.504', nombre: 'Entrega Anillo RFID para control de combustible', tipo: 'servicio', nota: 'Entrega del anillo RFID (no se instala)' },
  { odooId: 194, codigo: 'INS.505', nombre: 'Instalación Eléctrica y adaptaciones', tipo: 'servicio', nota: 'Instalación eléctrica y adaptaciones (mano de obra)' },
  { odooId: 566, codigo: 'INS.601', nombre: 'Actualización de equipo GPS', tipo: 'servicio', nota: 'Actualización de equipo GPS' },
  { odooId: 128, codigo: 'LOST.001', nombre: 'Equipo perdido / destruído / robado / dañado', tipo: 'servicio', nota: 'Equipo perdido/destruido/robado/dañado: cargo administrativo, la baja de stock depende de la reparabilidad' },
  { odooId: 189, codigo: 'PER.002', nombre: 'Equipo Portátil Perdido', tipo: 'servicio', nota: 'Equipo perdido' },
  { odooId: 199, codigo: 'REP.001', nombre: 'Reparación de pantalla en Laboratorio', tipo: 'servicio', nota: 'Reparación de pantalla en laboratorio: mano de obra, no consume stock' },
  { odooId: 107, codigo: 'REP.002', nombre: 'Reparación técnica', tipo: 'servicio', revisar: true, nota: 'Reparación técnica; si el técnico necesita una pieza o sensor, se suma como producto a la orden de venta (decisión 2026-10-06; antes se pensaba un subflujo de excepción, §15.1)' },
  { odooId: 523, codigo: 'REP.003', nombre: 'Retiro para Reparación Pantalla 7"', tipo: 'servicio', nota: 'Retiro para reparación pantalla 7"' },
  { odooId: 524, codigo: 'REP.004', nombre: 'Retiro para Reparación Pantalla 10"', tipo: 'servicio', nota: 'Retiro para reparación pantalla 10"' },
  { odooId: 525, codigo: 'REP.005', nombre: 'Revisión Pantalla 10"', tipo: 'servicio', nota: 'Revisión pantalla 10"' },
  { odooId: 526, codigo: 'REP.006', nombre: 'Revisión Pantalla 7"', tipo: 'servicio', nota: 'Revisión pantalla 7"' },
  { odooId: 570, codigo: 'REP.007', nombre: 'Reparación de Sensores', tipo: 'servicio', revisar: true, nota: 'Reparación de sensores; si el técnico necesita una pieza o sensor, se suma como producto a la orden de venta (decisión 2026-10-06; antes se pensaba un subflujo de excepción, §15.1)' },
  { odooId: 684, codigo: 'REP.008', nombre: 'Reparación de surtidor de combustible', tipo: 'servicio', nota: 'Reparación de surtidor' },
  { odooId: 555, codigo: 'REV.060', nombre: 'Revisiones Técnicas de Cámaras ADAS', tipo: 'servicio', nota: 'Revisión técnica de cámaras ADAS' },
  { odooId: 3, codigo: 'VIS.001', nombre: 'Visita técnica / revisión técnica / visita para relevamiento técnico', tipo: 'servicio', nota: 'Visita técnica / relevamiento' },
  { odooId: 297, codigo: 'VIS.002', nombre: 'Calibración de Varilla', tipo: 'servicio', nota: 'Calibración de varilla' },
  { odooId: 578, codigo: 'VIS.003', nombre: 'Visita fallida', tipo: 'servicio', nota: 'Visita fallida' },
  { odooId: 690, codigo: 'CAM.005', nombre: 'Cámara contadora de pasajeros + IA', tipo: 'sin_casilla', nota: 'Cámara contadora de pasajeros + IA: la PWA no tiene casilla para esto' },
  { odooId: 568, codigo: 'DES.403', nombre: 'Desinstalación SIM GLOBAL', tipo: 'sin_casilla', nota: 'Desinstalación SIM GLOBAL: la PWA no tiene casilla' },
  { odooId: 185, codigo: 'INS.403', nombre: 'Instalación SIM GLOBAL', tipo: 'sin_casilla', nota: 'SIM GLOBAL (se trackea individualmente por equipo, con su propio ICCID): la PWA no tiene casilla para esto' },
  { odooId: 298, codigo: 'INS.406', nombre: 'Identificación de acoplado (por acoplado)', tipo: 'sin_casilla', nota: 'Identificación de acoplado: la PWA no tiene casilla para esto' },
  { odooId: 246, codigo: 'INS.500', nombre: 'Instalación + Venta CAPTURADOR', tipo: 'sin_casilla', nota: 'Capturador: la PWA no tiene casilla para esto' },
  { odooId: 302, codigo: 'INS.502', nombre: 'STEP UP (elevador de tensión)', tipo: 'sin_casilla', nota: 'STEP UP (elevador de tensión): la PWA no tiene casilla para esto' },
  { odooId: 183, codigo: 'INS.506', nombre: 'Instalación central de Predio, contiene Lector RFID para identificar operador', tipo: 'sin_casilla', nota: 'Central de predio con lector RFID: la PWA no tiene casilla para esto' },
  { odooId: 528, codigo: 'INS.510', nombre: 'Venta + Instalación Contador de Pasajeros', tipo: 'sin_casilla', nota: 'Contador de pasajeros: la PWA no tiene casilla para esto' },
  { odooId: 648, codigo: 'INS.700', nombre: 'Instalación Identificador implemento agrícola', tipo: 'sin_casilla', nota: 'Identificador de implemento agrícola: la PWA no tiene casilla para esto' },
  { odooId: 619, codigo: 'INS.701', nombre: 'Sistema Anuncio Paradas', tipo: 'sin_casilla', nota: 'Sistema de anuncio de paradas: la PWA no tiene casilla para esto' },
  { odooId: 196, codigo: 'INS.900', nombre: 'Lector de pulsos para lectura de caudal, por surtidor', tipo: 'sin_casilla', nota: 'Lector de pulsos de caudal (surtidor): la PWA no tiene casilla para esto' },
  { odooId: 650, codigo: 'INS.902', nombre: 'Cámara interior 1080P', tipo: 'sin_casilla', nota: 'Cámara interior 1080P: la PWA no tiene casilla para esto' },
  { odooId: 652, codigo: 'INS.903', nombre: 'Instalación y configuración MDVR + Cámaras', tipo: 'sin_casilla', nota: 'Instalación y configuración MDVR + cámaras: la PWA no tiene casilla para esto' },
  { odooId: 655, codigo: 'INS.904', nombre: 'Cámara exterior 1080P IP67', tipo: 'sin_casilla', nota: 'Cámara exterior 1080P IP67: la PWA no tiene casilla para esto' },
  { odooId: 656, codigo: 'INS.905', nombre: 'Cámara BSD (blind spot detection)', tipo: 'sin_casilla', nota: 'Cámara BSD: la PWA no tiene casilla para esto' },
  { odooId: 647, codigo: 'INS.906', nombre: 'Disco Rígido SSD 1TB', tipo: 'sin_casilla', nota: 'Disco rígido SSD 1TB: la PWA no tiene casilla para esto' },
  { odooId: 649, codigo: 'INS.908', nombre: 'MDVR 4 CANALES (1080P/720P, H.265)', tipo: 'sin_casilla', nota: 'MDVR 4 canales: la PWA no tiene casilla para esto' },
  { odooId: 657, codigo: 'INS.909', nombre: 'MDVR 8 CANALES (1080P/720P, H.265)', tipo: 'sin_casilla', nota: 'MDVR 8 canales: la PWA no tiene casilla para esto' },
  { odooId: 617, codigo: 'RFID.02', nombre: 'Parche RFID para control de neumático', tipo: 'sin_casilla', nota: 'Parche RFID para control de neumático: la PWA no tiene casilla para esto' },
  { odooId: 178, codigo: 'ABN', nombre: 'API Paradas y Horarios', tipo: 'abono' },
  { odooId: 521, codigo: 'ABN', nombre: 'Abono modulo de fin de carrera', tipo: 'abono' },
  { odooId: 203, codigo: 'ABN', nombre: 'Servicio de control georeferenciado de localización de vehículos - convenio marco n"80.235, presentación: unidad', tipo: 'abono' },
  { odooId: 455, codigo: 'ABN', nombre: 'Servicio de implementación y mantenimiento del Sistema de Monitoreo de localización y seguimiento vehicular satelital de Unidades de Taxis y Remises de la Ciudad de Neuquén', tipo: 'abono' },
  { odooId: 643, codigo: 'ABN', nombre: '1) Abono Mensual SIMS Instalados', tipo: 'abono' },
  { odooId: 641, codigo: 'ABN', nombre: '1) Abono Mensual SIMS Instalados (BAJA)', tipo: 'abono' },
  { odooId: 642, codigo: 'ABN', nombre: '2) Servicio de Instalación y configuración SIMS y Botón de Pánico', tipo: 'abono' },
  { odooId: 618, codigo: 'ABN', nombre: 'Abono SIGERE (Aysam)', tipo: 'abono' },
  { odooId: 445, codigo: 'ABN', nombre: 'Abono transmisión satelital', tipo: 'abono' },
  { odooId: 610, codigo: 'ABN', nombre: 'Baja administrativa - devolución de equipos', tipo: 'abono' },
  { odooId: 639, codigo: 'ABN', nombre: 'Contratación del servicio de gestión central BEN', tipo: 'abono' },
  { odooId: 443, codigo: 'ABN', nombre: 'Integración por API', tipo: 'abono' },
  { odooId: 520, codigo: 'ABN', nombre: 'RR.HH - APP Seguimiento movilidad', tipo: 'abono' },
  { odooId: 68, codigo: 'ABN', nombre: 'SIM Global', tipo: 'abono' },
  { odooId: 69, codigo: 'ABN', nombre: 'SIM Movistar', tipo: 'abono' },
  { odooId: 686, codigo: 'ABN', nombre: '[AJU.002] Ajuste extraordinario', tipo: 'abono' },
  { odooId: 14, codigo: 'ABN.001', nombre: 'Abono mensual - Rastreo satelital', tipo: 'abono' },
  { odooId: 439, codigo: 'ABN.002', nombre: 'Abono Seguimiento Satelital c/ Instalación bonificada', tipo: 'abono' },
  { odooId: 452, codigo: 'ABN.003', nombre: 'Abono Mensual Pantalla 7"', tipo: 'abono' },
  { odooId: 57, codigo: 'ABN.005', nombre: 'Abono mensual - Varilla combustible', tipo: 'abono' },
  { odooId: 87, codigo: 'ABN.010', nombre: 'Abono mensual - Lector CANBUS (adicional por unidad)', tipo: 'abono' },
  { odooId: 89, codigo: 'ABN.015', nombre: 'Abono mensual - Identificador de chofer (RFID)', tipo: 'abono' },
  { odooId: 646, codigo: 'ABN.016', nombre: 'Abono mensual - Módulo RFID lector de tarjeta estudiantil', tipo: 'abono' },
  { odooId: 20, codigo: 'ABN.020', nombre: 'Abono mensual - Corte de Motor', tipo: 'abono' },
  { odooId: 91, codigo: 'ABN.025', nombre: 'Abono mensual - Sensor de temperatura', tipo: 'abono' },
  { odooId: 124, codigo: 'ABN.026', nombre: 'Abono mensual - 2 Sensor de temperatura', tipo: 'abono' },
  { odooId: 125, codigo: 'ABN.027', nombre: 'Abono mensual - 3 Sensor de temperatura', tipo: 'abono' },
  { odooId: 97, codigo: 'ABN.040', nombre: 'Abono mensual - Micrófono en cabina', tipo: 'abono' },
  { odooId: 294, codigo: 'ABN.045', nombre: 'Abono mensual - sensor de giro mixer', tipo: 'abono' },
  { odooId: 241, codigo: 'ABN.051', nombre: 'Abono mensual anuncio de paradas', tipo: 'abono' },
  { odooId: 447, codigo: 'ABN.060', nombre: 'Abono cámara detección fatiga ADAS y DMS', tipo: 'abono' },
  { odooId: 101, codigo: 'ABN.065', nombre: 'Abono mensual - Buzzer', tipo: 'abono' },
  { odooId: 127, codigo: 'ABN.100', nombre: 'Abono mensual - pantalla multimedia', tipo: 'abono' },
  { odooId: 250, codigo: 'ABN.101', nombre: 'Abono mensual - App Toma y Deje', tipo: 'abono' },
  { odooId: 449, codigo: 'ABN.125', nombre: 'Abono mensual Pantallas 10"', tipo: 'abono' },
  { odooId: 453, codigo: 'ABN.126', nombre: 'Abono módulo RPM', tipo: 'abono' },
  { odooId: 249, codigo: 'ABN.200', nombre: 'Abono mensual Capturador', tipo: 'abono' },
  { odooId: 176, codigo: 'ABN.201', nombre: 'Abono mensual SIM GLOBAL', tipo: 'abono' },
  { odooId: 282, codigo: 'ABN.300', nombre: 'Abono Módulo de Mantenimiento (1 a 50 Unidades)', tipo: 'abono' },
  { odooId: 300, codigo: 'ABN.301', nombre: 'Módulo Mantenimiento de 31 a 100 Unidades', tipo: 'abono' },
  { odooId: 301, codigo: 'ABN.302', nombre: 'Módulo Mantenimiento de 101 a 200 Unidades', tipo: 'abono' },
  { odooId: 174, codigo: 'ABN.303', nombre: 'Abono SIGERE (AYSAM)', tipo: 'abono' },
  { odooId: 173, codigo: 'ABN.304', nombre: 'Abono Roaming Internacional', tipo: 'abono' },
  { odooId: 169, codigo: 'ABN.305', nombre: 'Abono módulo control de SURTIDORES', tipo: 'abono' },
  { odooId: 170, codigo: 'ABN.308', nombre: 'Abono módulo de neumáticos ', tipo: 'abono' },
  { odooId: 168, codigo: 'ABN.309', nombre: 'Abono módulo control de combustible CISTERNA', tipo: 'abono' },
  { odooId: 255, codigo: 'ABN.310', nombre: 'Abono Lector Tag RFID', tipo: 'abono' },
  { odooId: 167, codigo: 'ABN.311', nombre: 'Abono módulo CANBUS + BUZZER', tipo: 'abono' },
  { odooId: 172, codigo: 'ABN.402', nombre: 'Abono retransmisión de tramas', tipo: 'abono' },
  { odooId: 182, codigo: 'ABN.501', nombre: 'Central de monitoreo - punto a punto (por unidad, por mes)', tipo: 'abono' },
  { odooId: 529, codigo: 'ABN.510', nombre: 'Abono mensual - Contador de Pasajeros', tipo: 'abono' },
  { odooId: 693, codigo: 'ABN.600', nombre: 'Abono Seguimiento Activo', tipo: 'abono' },
  { odooId: 653, codigo: 'ABN.903', nombre: 'Abono MDVR', tipo: 'abono' },
  { odooId: 303, codigo: 'ABN.APP', nombre: 'Abono mensual App para Pasajeros del Transporte Público', tipo: 'abono' },
  { odooId: 202, codigo: 'ABN.BLOQUE', nombre: 'Servicio de Bloque Informático para monitoreo y control de unidades de Transporte de Pasajeros', tipo: 'abono' },
  { odooId: 175, codigo: 'ABN.COLE', nombre: 'Abono mensual App para Usuarios del Transporte Público (COLE)', tipo: 'abono' },
  { odooId: 454, codigo: 'ABN.EDASA', nombre: 'Abono Turnero Web', tipo: 'abono' },
  { odooId: 658, codigo: 'ABN.MOD001', nombre: 'Abono módulo Wi Fi', tipo: 'abono' },
  { odooId: 306, codigo: 'ABN.PUB', nombre: 'Abono mensual - Transporte Público', tipo: 'abono' },
  { odooId: 670, codigo: 'ABN.REDTULUM', nombre: 'Abono Mensual App RedTulum', tipo: 'abono' },
  { odooId: 469, codigo: 'ABN.RES', nombre: 'Abono mensual App para Recolección de Residuos', tipo: 'abono' },
  { odooId: 476, codigo: 'ABN.STR', nombre: 'Abono mensual Starlink', tipo: 'abono' },
  { odooId: 448, codigo: 'ABN.TAXI', nombre: 'Abono mensual Taxi - Uso de App', tipo: 'abono' },
  { odooId: 609, codigo: 'AJU.001', nombre: 'Ajuste por redondeo', tipo: 'abono' },
  { odooId: 519, codigo: 'API.001', nombre: 'API de mantenimiento', tipo: 'abono' },
  { odooId: 522, codigo: 'AUDIT', nombre: 'Auditoría interna', tipo: 'abono' },
  { odooId: 561, codigo: 'Aplica a clientes c/etiqueta "servicios adicionales"', nombre: 'ABONO servicios adicionales', tipo: 'abono' },
  { odooId: 190, codigo: 'HOR', nombre: 'Horas de Desarrollo a Medida', tipo: 'abono' },
  { odooId: 2, codigo: 'HOR.2', nombre: 'Servicio en parte de horas', tipo: 'abono' },
  { odooId: 201, codigo: 'HOR.3', nombre: 'Servicio y Mantenimiento mensual Software Tótems', tipo: 'abono' },
  { odooId: 571, codigo: 'PREMIX', nombre: 'Abono seguimiento satelital + Sensor de giro', tipo: 'abono' },
  { odooId: 197, codigo: 'Precio en USD oficiales', nombre: 'Mantenimiento servidor "Vamos"', tipo: 'abono' },
  { odooId: 212, codigo: 'REC', nombre: 'Recargo por mora en su pago', tipo: 'abono' },
  { odooId: 204, codigo: 'SIT', nombre: 'Servicio de monitoreo de colectivos - Sistema Inteligente de Transporte (SIT)', tipo: 'abono', nota: 'Servicio de monitoreo de colectivos' },
  { odooId: 603, codigo: 'Vialidad  San Juan', nombre: 'Alquiler mensual equipo de seguimiento satelital +  Abono Módulo de combustible', tipo: 'abono' },
];

const POR_ID = new Map(PRODUCTOS_MAPEO.map((p) => [p.odooId, p]));

export interface LineaVenta {
  productId: number;
  cantidad: number;
}

type Casillas = Partial<Record<CasillaInstalable, number>>;

export interface EsperadoUnidad {
  instalar: { equipo: boolean; casillas: Casillas };
  retirar: { equipo: boolean; casillas: Casillas };
  // Hardware vendido que la PWA no tiene como casilla: avisar en vez de bloquear.
  sinCasilla: ProductoMapeo[];
  // Productos de la unidad que no están en el mapeo (producto nuevo en Odoo): no restringen, hay que mapearlos.
  sinMapear: number[];
  // La unidad tiene un producto de retiro/entrega de equipo: no se interviene la unidad (ver tipoServicioSugerido.ts).
  recepcionEquipo: boolean;
  // La unidad tiene al menos un producto de hardware (instala/retira/sin_casilla): ahí aplica la restricción.
  hayHardware: boolean;
}

// Qué se espera instalar/retirar en una unidad a partir de las líneas de su orden de venta.
export function resolverEsperado(lineas: LineaVenta[]): EsperadoUnidad {
  const res: EsperadoUnidad = {
    instalar: { equipo: false, casillas: {} },
    retirar: { equipo: false, casillas: {} },
    sinCasilla: [],
    sinMapear: [],
    recepcionEquipo: false,
    hayHardware: false,
  };
  for (const l of lineas) {
    const p = POR_ID.get(l.productId);
    if (!p) {
      res.sinMapear.push(l.productId);
      continue;
    }
    if (p.tipo === 'sin_casilla') {
      res.hayHardware = true;
      res.sinCasilla.push(p);
      continue;
    }
    if (p.tipo === 'retiro_entrega') {
      res.recepcionEquipo = true;
      continue;
    }
    if (p.tipo !== 'instala' && p.tipo !== 'retira') continue;
    res.hayHardware = true;
    const destino = p.tipo === 'instala' ? res.instalar : res.retirar;
    if (p.equipo) destino.equipo = true;
    for (const it of p.items ?? []) {
      const cant = it.cantidad === 'linea' ? l.cantidad : (it.cantidad ?? 1);
      destino.casillas[it.key] = (destino.casillas[it.key] ?? 0) + cant;
    }
  }
  return res;
}
