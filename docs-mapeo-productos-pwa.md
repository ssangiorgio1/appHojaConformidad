# Mapeo de productos de Odoo con lo que se instala en la PWA

Fecha: 2026-10-06. Estado: **borrador para revisar**. Código: `api/src/config/productoMapeo.ts` (con test que valida cada casilla contra `EQUIP_GROUPS`).

## Para qué sirve

Regla acordada para el paso "Módulos y sensores" (intermedio de la hoja):

1. **Todas las unidades tienen que tener su producto cargado** en la orden de venta de Odoo.
2. El técnico **solo puede instalar lo que dice el producto de la unidad**. Las casillas esperadas aparecen tildadas y no se puede tildar otra.
3. Si el cliente quiere instalar algo más, **comercial, coordinación o un jefe** suma el producto a la **orden de venta** en Odoo (hay que cotizarlo sí o sí) y lo asocia a la unidad. Hoy se hace a mano. Recién ahí la PWA lo habilita.
4. Antes de avanzar al POST, cada producto esperado tiene que estar instalado o marcado "no instalado" con motivo (el recordatorio contra los olvidos).

El mapeo se hace por **id de Odoo** (no por código): el código `INS.051` está duplicado (pantalla 7" y soporte de 10").

## Resumen

| Tipo | Cantidad | Qué es |
|---|---|---|
| Instala | 28 | Se instala algo: equipo GPS y/o casillas de la PWA |
| Retira | 14 | Desinstalaciones (`DES.*`): van a "elementos retirados" |
| Accesorio | 7 | Parte de otro producto; no tiene casilla ni restringe |
| Servicio | 24 | Mano de obra, visitas, reparaciones, envíos y cargos administrativos; no restringen |
| **Sin casilla en la PWA** | 19 | **Hardware que se vende pero la PWA no tiene dónde tildar (brecha)** |
| Abono | 75 | Abonos mensuales; no se instalan |

Marcados para revisar: **8**. Productos del catálogo sin código (ítems de licitaciones y exportación): 30, no mapeados.

Fuentes: catálogo de Odoo (productos vendibles de Instalaciones, Reparaciones y servicios, `DES.*` y abonos) y `lista_precios_wara.csv` (confirmaciones del 2026-09-23 sobre combos y stock).

## Lo que más hay que mirar

- **Brecha de la PWA:** 19 productos de hardware no tienen casilla (cámaras, MDVR, disco, contador de pasajeros, STEP UP, SIM GLOBAL, capturador, etc.). Hay que **agregar casillas en la PWA** o decidir cómo se registran. Hasta entonces no se restringe ni se exige nada sobre ellos, pero se avisa.
- **Combos** (confirmados 2026-09-23): `INS.001` = 1 equipo + 1 botón de pánico; `INS.026`/`INS.027` = 2/3 sensores de temperatura; `INS.045` = sensor de giro + módulo lector (por ahora tilda solo "Sensor de giro"; el lector no tiene casilla); `INS.015` = módulo lector RFID + 3 llaveros (tilda "RFID", confirmado 2026-10-06).
- **Reparaciones (`REP.002`):** no define qué se instala. Con la regla nueva, si el técnico necesita una pieza o un sensor, se suma como producto a la orden de venta. Antes se pensaba un subflujo de excepción (§15.1: producto no cotizado a mitad de trabajo); la regla de hoy lo reemplaza.
- **Envíos** (`GPS.001`, `GPS.002`): el cliente instala o es un equipo portátil; **no generan visita** ni paso en la PWA.
- **Sin mapear:** un producto nuevo en Odoo no restringe nada hasta que se agregue a este archivo (el resolutor lo informa como "sin mapear").

### Se instalan (28)

| Código | Producto de Odoo | Id | En la PWA | ¿Confirmado? | Nota |
|---|---|---|---|---|---|
| `AVL001` | Equipo AVL - GPS (venta) GS-12 | 477 | **Equipo GPS** (modelo/IMEI) | ⚠️ revisar | Venta del equipo: confirmar si siempre se instala |
| `AVL002` | Equipo GPS (venta) | 599 | **Equipo GPS** (modelo/IMEI) | ⚠️ revisar | Venta del equipo: confirmar si siempre se instala |
| `CM.001` | Instalación GPS + BP + CAN BUS | 615 | **Equipo GPS** (modelo/IMEI) + Botón de pánico + CANBUS | ✅ | GPS + BP + CAN BUS |
| `CM.002` | Instalación GPS + BP + CAB BUS (más de 1.000 un.) | 616 | **Equipo GPS** (modelo/IMEI) + Botón de pánico + CANBUS | ✅ | Igual que CM.001 (más de 1.000 un.) |
| `INS.001` | Instalación GPS (comodato) + BP | 503 | **Equipo GPS** (modelo/IMEI) + Botón de pánico | ✅ | Combo confirmado 2026-09-23: siempre 1 equipo + 1 botón de pánico |
| `INS.005` | Varilla de combustible + Instalación | 56 | Varilla de combustible | ✅ | Varilla de combustible + instalación |
| `INS.010` | Instalación modulo lector CANBUS + GPS | 86 | **Equipo GPS** (modelo/IMEI) + CANBUS | ⚠️ revisar | Confirmado en parte 2026-09-23: es una variante de equipo "full" que ya soporta CANBUS (solo se conecta un cable, no hay un módulo de hardware aparte); pendiente aclarar cómo se relaciona con la familia de INS.001 |
| `INS.015` | Identificador de chofer con 3 llaveros (RFID) | 88 | RFID | ✅ | Combo (módulo lector RFID + 3 llaveros/tarjetas, confirmado 2026-09-23). Confirmado 2026-10-06: tilda "RFID" |
| `INS.020` | Instalación Corte de Motor | 16 | Corte de motor | ✅ |  |
| `INS.025` | Instalación de Sensor de temperatura | 90 | Sensor de temperatura | ✅ |  |
| `INS.026` | Instalación de 2 Sensores de temperatura | 505 | Sensor de temperatura ×2 | ✅ |  |
| `INS.027` | Instalación de 3 Sensores de temperatura | 93 | Sensor de temperatura ×3 | ✅ |  |
| `INS.030` | Instalación de Sensor de puerta de cabina (por puerta) | 507 | Sensor apertura de puertas (cantidad = la de la línea) | ✅ | Se vende por puerta: la cantidad es la de la línea |
| `INS.031` | Instalación Apertura de Puertas ACOPLADO | 95 | Sensor apertura p/semi (cantidad = la de la línea) | ✅ | Apertura de puertas de acoplado; confirmado 2026-10-06: corresponde a "Apertura p/semi" |
| `INS.040` | Instalación de Micrófono en cabina | 96 | Micrófono | ✅ |  |
| `INS.045` | Instalación de Sensor de Giro para Mixer | 506 | Sensor de giro | ✅ | Combo (sensor de giro + módulo lector, confirmado 2026-09-23). Confirmado 2026-10-06: por ahora tilda solo "Sensor de giro"; el módulo lector no tiene casilla propia |
| `INS.051` | Venta + Instalación Pantallas Multimedia 7" WARA 2025 | 567 | Pantalla | ✅ | Pantalla multimedia 7" (el código INS.051 está duplicado en Odoo: por eso se mapea por id) |
| `INS.060` | Venta + Instalación Cámara ADAS - DMS | 446 | Cámaras ADAS | ✅ | Cámara ADAS - DMS |
| `INS.065` | Instalación Buzzer Exceso de velocidad | 100 | Buzzer velocidad | ✅ |  |
| `INS.075` | Instalación Desenganche de Acoplado (Ficha Triler) | 24 | Desacople / semi | ✅ | Desenganche de acoplado (ficha Triler) |
| `INS.080` | Instalación Desenganche de acoplado (ficha vulcanizada) | 504 | Desacople / semi | ✅ | Desenganche de acoplado (ficha vulcanizada) |
| `INS.125` | Venta + Instalación Pantallas Multimedia 10" WARA 2025 | 58 | Pantalla | ✅ | Pantalla multimedia 10" |
| `INS.401` | Instalación de sensor de pánico | 193 | Botón de pánico | ✅ | Sensor de pánico: es un agregado de intervención, no una instalación nueva |
| `INS.407` | Equipo GPS imantado (en comodato) | 299 | **Equipo GPS** (modelo/IMEI) | ✅ | Equipo GPS imantado (comodato) |
| `INS.503` | Instalación Anillo RFID para control de combustible | 177 | RFID | ⚠️ revisar | Anillo RFID para control de combustible; confirmar casilla |
| `INS.ANT` | Instalación de extensión Antena GPS | 307 | Antena GPS (Ext) | ⚠️ revisar | Extensión de antena GPS ≈ "Antena GPS (Ext)"; confirmar |
| `INS.STR` | Instalación antena Starlink | 475 | Antena Starlink | ✅ |  |
| `MOD.001` | Venta / Instalación módulo WI FI | 580 | Módulo wifi | ✅ |  |

### Se retiran (desinstalaciones) (14)

| Código | Producto de Odoo | Id | En la PWA | ¿Confirmado? | Nota |
|---|---|---|---|---|---|
| `DES.001` | Desinstalación equipo GPS | 126 | **Equipo GPS** (modelo/IMEI) | ✅ | Desinstalación equipo GPS |
| `DES.005` | Desinstalación varilla de combustible | 295 | Varilla de combustible | ✅ |  |
| `DES.025` | Desinstalación sensores de temperatura | 542 | Sensor de temperatura (cantidad = la de la línea) | ✅ | Sensores de temperatura |
| `DES.045` | Desinstalación  sensor de giro Mixer | 550 | Sensor de giro | ✅ | Sensor de giro Mixer |
| `DES.050` | Desinstalación  sensor apertura de puerta | 638 | Sensor apertura de puertas (cantidad = la de la línea) | ✅ | Sensor de apertura de puerta |
| `DES.060` | Desinstalación Cámara detección fatiga ADAS y DMS | 548 | Cámaras ADAS | ✅ |  |
| `DES.065` | Desinstalación Buzzer de velocidad | 547 | Buzzer velocidad | ✅ |  |
| `DES.100` | Desinstalación corte de motor | 541 | Corte de motor | ✅ |  |
| `DES.102` | Desinstalación botón de pánico | 543 | Botón de pánico | ✅ |  |
| `DES.103` | Desinstalación de GPS | 544 | **Equipo GPS** (modelo/IMEI) | ✅ | Desinstalación de GPS |
| `DES.105` | Desinstalación micrófono en cabina | 546 | Micrófono | ✅ |  |
| `DES.108` | Desinstalación Identificación de chofer RFID | 549 | RFID | ⚠️ revisar | Identificación de chofer RFID: por coherencia con INS.015 (que tilda "RFID") se mapea a "RFID"; confirmar |
| `DES.110` | Desinstalación CANBUS | 551 | CANBUS | ✅ |  |
| `DES.125` | Desinstalación Pantalla Multimedia | 545 | Pantalla | ✅ |  |

### Hardware SIN casilla en la PWA (brecha) (19)

| Código | Producto de Odoo | Id | Nota |
|---|---|---|---|
| `CAM.005` | Cámara contadora de pasajeros + IA | 690 | Cámara contadora de pasajeros + IA: la PWA no tiene casilla para esto |
| `DES.403` | Desinstalación SIM GLOBAL | 568 | Desinstalación SIM GLOBAL: la PWA no tiene casilla |
| `INS.403` | Instalación SIM GLOBAL | 185 | SIM GLOBAL (se trackea individualmente por equipo, con su propio ICCID): la PWA no tiene casilla para esto |
| `INS.406` | Identificación de acoplado (por acoplado) | 298 | Identificación de acoplado: la PWA no tiene casilla para esto |
| `INS.500` | Instalación + Venta CAPTURADOR | 246 | Capturador: la PWA no tiene casilla para esto |
| `INS.502` | STEP UP (elevador de tensión) | 302 | STEP UP (elevador de tensión): la PWA no tiene casilla para esto |
| `INS.506` | Instalación central de Predio, contiene Lector RFID para identificar operador | 183 | Central de predio con lector RFID: la PWA no tiene casilla para esto |
| `INS.510` | Venta + Instalación Contador de Pasajeros | 528 | Contador de pasajeros: la PWA no tiene casilla para esto |
| `INS.700` | Instalación Identificador implemento agrícola | 648 | Identificador de implemento agrícola: la PWA no tiene casilla para esto |
| `INS.701` | Sistema Anuncio Paradas | 619 | Sistema de anuncio de paradas: la PWA no tiene casilla para esto |
| `INS.900` | Lector de pulsos para lectura de caudal, por surtidor | 196 | Lector de pulsos de caudal (surtidor): la PWA no tiene casilla para esto |
| `INS.902` | Cámara interior 1080P | 650 | Cámara interior 1080P: la PWA no tiene casilla para esto |
| `INS.903` | Instalación y configuración MDVR + Cámaras | 652 | Instalación y configuración MDVR + cámaras: la PWA no tiene casilla para esto |
| `INS.904` | Cámara exterior 1080P IP67 | 655 | Cámara exterior 1080P IP67: la PWA no tiene casilla para esto |
| `INS.905` | Cámara BSD (blind spot detection) | 656 | Cámara BSD: la PWA no tiene casilla para esto |
| `INS.906` | Disco Rígido SSD 1TB | 647 | Disco rígido SSD 1TB: la PWA no tiene casilla para esto |
| `INS.908` | MDVR 4 CANALES (1080P/720P, H.265) | 649 | MDVR 4 canales: la PWA no tiene casilla para esto |
| `INS.909` | MDVR 8 CANALES (1080P/720P, H.265) | 657 | MDVR 8 canales: la PWA no tiene casilla para esto |
| `RFID.02` | Parche RFID para control de neumático | 617 | Parche RFID para control de neumático: la PWA no tiene casilla para esto |

### Accesorios (7)

| Código | Producto de Odoo | Id | Nota |
|---|---|---|---|
| `INS.051` | Soporte de pantalla 10" | 620 | Soporte de pantalla 10" (comparte el código INS.051 con la pantalla de 7") |
| `INS.600` | Tapones de Varilla | 60 | Tapones de varilla: acompañan a la varilla |
| `INS.901` | Cable de conexión (por cámara) | 651 | Cable de conexión por cámara |
| `Precio en USD oficiales` | Placa para anuncio de paradas | 242 | Placa para anuncio de paradas (en Odoo tiene cargado como código el texto "Precio en USD oficiales") |
| `RFID.001` | Tarjetas de RFID c/u (adicional) | 296 | Tarjetas RFID adicionales: acompañan al identificador |
| `SOP.STK` | Soporte magnético antena Starlink | 669 | Soporte de antena Starlink |
| `SOP2.STK` | Soporte simple antena Starlink | 672 | Soporte de antena Starlink |

### Servicios (24)

| Código | Producto de Odoo | Id | Nota |
|---|---|---|---|
| `CAM.001` | Cambio de unidad (baja y alta en 48hs) | 181 | Cambio de unidad (baja y alta) |
| `CAM.002` | Cambio de titularidad | 457 | Cambio de titularidad: administrativo, sin técnico |
| `CAM.003` | Cambio de Pantalla Multimedia | 572 | Cambio de pantalla multimedia |
| `CAM.004` | Cambio de matrícula / grupo / interno | 678 | Cambio de matrícula / grupo / interno |
| `GPS.001` | Envío y entrega Equipo GPS (En comodato - instala el cliente) | 508 | Envío del equipo en comodato: lo instala el cliente, no genera visita de técnico ni paso en la PWA |
| `GPS.002` | Equipo GPS personal / imantado (envío al cliente) (comodato) | 64 | Equipo personal/imantado (GS20/GS60) enviado al cliente: familia de equipo distinta a INS.001; no genera visita |
| `INS.400` | Adicional por Instalación de equipo en caja estanca | 179 | Adicional por equipo en caja estanca |
| `INS.504` | Entrega Anillo RFID para control de combustible | 677 | Entrega del anillo RFID (no se instala) |
| `INS.505` | Instalación Eléctrica y adaptaciones | 194 | Instalación eléctrica y adaptaciones (mano de obra) |
| `INS.601` | Actualización de equipo GPS | 566 | Actualización de equipo GPS |
| `LOST.001` | Equipo perdido / destruído / robado / dañado | 128 | Equipo perdido/destruido/robado/dañado: cargo administrativo, la baja de stock depende de la reparabilidad |
| `PER.002` | Equipo Portátil Perdido | 189 | Equipo perdido |
| `REP.001` | Reparación de pantalla en Laboratorio | 199 | Reparación de pantalla en laboratorio: mano de obra, no consume stock |
| `REP.002` | Reparación técnica | 107 | Reparación técnica; si el técnico necesita una pieza o sensor, se suma como producto a la orden de venta (decisión 2026-10-06; antes se pensaba un subflujo de excepción, §15.1) |
| `REP.003` | Retiro para Reparación Pantalla 7" | 523 | Retiro para reparación pantalla 7" |
| `REP.004` | Retiro para Reparación Pantalla 10" | 524 | Retiro para reparación pantalla 10" |
| `REP.005` | Revisión Pantalla 10" | 525 | Revisión pantalla 10" |
| `REP.006` | Revisión Pantalla 7" | 526 | Revisión pantalla 7" |
| `REP.007` | Reparación de Sensores | 570 | Reparación de sensores; si el técnico necesita una pieza o sensor, se suma como producto a la orden de venta (decisión 2026-10-06; antes se pensaba un subflujo de excepción, §15.1) |
| `REP.008` | Reparación de surtidor de combustible | 684 | Reparación de surtidor |
| `REV.060` | Revisiones Técnicas de Cámaras ADAS | 555 | Revisión técnica de cámaras ADAS |
| `VIS.001` | Visita técnica / revisión técnica / visita para relevamiento técnico | 3 | Visita técnica / relevamiento |
| `VIS.002` | Calibración de Varilla | 297 | Calibración de varilla |
| `VIS.003` | Visita fallida | 578 | Visita fallida |

### Abonos (75)

No se instalan ni restringen. Están en el archivo de mapeo para que no se confundan con productos sin mapear.

## Preguntas abiertas

Resueltas el 2026-10-06: `INS.015` tilda **RFID**; `INS.045` tilda solo **Sensor de giro** (por ahora); `INS.031` corresponde a **Apertura p/semi**.

1. ¿`INS.ANT` (extensión de antena GPS) corresponde a **Antena GPS (Ext)**?
2. ¿`INS.503` (anillo RFID de combustible) tilda **RFID**?
3. ¿`DES.108` (desinstalación de identificación de chofer RFID) tilda **RFID**, igual que `INS.015`? (se mapeó así por coherencia)
4. ¿`AVL001`/`AVL002` (venta de equipo) siempre se instalan?
5. ¿`INS.010` y la familia de equipo de `INS.001`: se relacionan como variantes del mismo equipo?
6. ¿Qué casillas nuevas agregamos en la PWA para los 19 productos de hardware sin casilla?
