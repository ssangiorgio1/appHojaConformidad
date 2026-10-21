# Inventario: depósito y técnicos (futuro, dentro de BO4)

Fecha: 2026-10-09. Estado: **plan, nada implementado**.

## Qué se quiere

Un árbol de productos con el stock del **depósito** y el **inventario de cada técnico**. Los equipos con número de serie e IMEI se llevan uno por uno. Los sensores, módulos, botones y ramales se llevan por cantidad. Las instalaciones consumen del inventario del técnico, y el técnico se reabastece con transferencias desde el depósito.

## Decisiones (2026-10-09)

1. **BO4 es el dueño del stock.** Odoo solo aporta los productos y la facturación. BO4 no escribe stock en Odoo.
2. **Un solo depósito por ahora**, pero el modelo admite más de uno desde el día uno (las ubicaciones son registros, no una constante).
3. **El técnico solo instala con lo que tiene.** El saldo nunca es negativo, ni del técnico ni del depósito.
4. **Muchos equipos vuelven al stock** después de un retiro o desinstalación.
5. **Ramales por cantidad. Los cables no se modelan** como producto.

## Dos capas

| Capa | Qué es | Ejemplos |
|---|---|---|
| **Comprobante** | El papel, con firma y PDF | Remito depósito→técnico, recibo de devolución, acta de instalación, acta de retiro (`RetiroEquipo`) |
| **Movimiento** | El asiento de stock: origen, destino, cantidad o serie | `INGRESO`, `TRANSFERENCIA`, `CONSUMO`, `DEVOLUCION`, `RETIRO`, `AJUSTE` |

El remito/recibo de BO3 hoy es solo comprobante y no toca ningún stock. En BO4 cada comprobante, al confirmarse, **genera sus movimientos**. El saldo nunca se edita a mano: es el resultado de los movimientos.

| Comprobante | Movimiento | Se confirma cuando |
|---|---|---|
| Remito de proveedor | `INGRESO` → depósito | Depósito lo carga |
| Remito depósito → técnico | `TRANSFERENCIA` | El técnico recibe |
| Recibo de devolución técnico → depósito | `DEVOLUCION` | Depósito recibe (no el técnico, para no inflar su stock) |
| Acta de instalación (conformidad) | `CONSUMO` técnico → vehículo | Se cierra la visita |
| Acta de retiro o entrega (`RetiroEquipo`) | `RETIRO` cliente → técnico | Se guarda el acta |
| Conteo físico | `AJUSTE` | Lo aprueba un administrador |

## Modelo de datos (Mongo/mongoose, como el resto de la API)

- **ProductoStock**: `tipo` (`SERIALIZADO` | `CANTIDAD`), código, nombre, categoría padre (de ahí sale el árbol), `odooProductId` opcional, stock mínimo.
- **UbicacionStock**: `DEPOSITO`, `TECNICO` (con `tecnicoId`) o `CLIENTE` (con `clienteId`; agregado 2026-10-16, ver más abajo).
- **ItemSerie** (solo serializados): producto, `nroSerie`, `imei`, `ubicacionId`, `estado` (`EN_DEPOSITO | EN_TECNICO | INSTALADO | EN_REVISION | RMA | BAJA`), `condicion`, `vehiculoId`/`equipoId` al instalarse. Índice único en serie e IMEI.
- **StockCantidad**: `(productoId, ubicacionId) → cantidad`. Índice único por par.
- **MovimientoStock**: libro inmutable. Tipo, origen, destino, producto, cantidad o `itemSerieId`, usuario, fecha, referencia al comprobante.
- **Transferencia**: cabecera con líneas. `PENDIENTE → EN_TRANSITO → RECIBIDA | CANCELADA`.
- **RecetaProducto**: producto de Odoo → lista de `(productoStock, cantidad)`. Es el matcheo: "Instalar botón de pánico y GPS" = 1 GPS + 1 pánico (+ ramales). Se hace con un mapeo explícito, no interpretando el texto. Ya existe una base en `productoMapeo.ts` y `docs-mapeo-productos-pwa.md`.

## Reglas que salen de las decisiones

- **Sin negativos, de forma atómica.** El descuento se hace con una actualización condicional (`cantidad >= n` y `$inc`) y, si no se cumple, falla. Para los serializados, el ítem tiene que estar `EN_TECNICO` en la ubicación de ese técnico.
- **Al asignar la visita:** BO4 calcula el consumo previsto con la receta y compara con el inventario del técnico. Si falta algo, avisa "faltante: 1 GPS" y sugiere la transferencia. No bloquea la asignación, porque el técnico puede recibir el stock antes de la visita.
- **Al cerrar la visita:** se descuenta. Si algo falta, el cierre queda bloqueado con el motivo. Una visita fallida o cancelada no descuenta nada.
- **Qué serie usa el técnico:** la elige en la PWA, escaneando el QR (ya existe el escáner por IMEI). Solo aparecen las que tiene en su inventario.
- **Equipos que vuelven:** el acta de retiro lo deja `EN_TECNICO` con condición "a revisar". Al llegar al depósito pasa a `EN_REVISION`, y después de una revisión pasa a `EN_DEPOSITO` (disponible), `RMA` o `BAJA`. Los equipos "a revisar" no se pueden instalar.
- **Stock mínimo:** alerta por producto y por ubicación.

## Fases

| Fase | Contenido |
|---|---|
| **0** | Cargar el catálogo desde Odoo (solo lectura), armar las categorías y mapear los tipos de BO3 (A33W, VAR, CAM, MDVR, PRE) a productos. Conteo físico inicial. |
| **1. Núcleo** | Modelos, movimientos y ubicaciones. Ingreso al depósito, con carga por lote de series/IMEI desde CSV. |
| **2. Panel** | Árbol del depósito (categoría → producto → series), inventario por técnico, historial de movimientos. |
| **3. Transferencias** | Depósito → técnico con confirmación de recepción. Devoluciones y circuito de revisión. |
| **4. Recetas + Odoo** | Pantalla de mapeo producto ↔ receta. Consumo previsto en la visita y alerta de faltante. |
| **5. PWA** | "Mi inventario", elegir serie al instalar, confirmar transferencias recibidas. |
| **6. Control** | Ajustes y conteos, stock mínimo, reportes (consumo por técnico, series sin ubicación), auditoría. |

## Migración desde BO3

Los remitos de BO3 no calculan saldos porque nunca tocaron stock. Los saldos iniciales se cargan con un **conteo físico** (depósito y cada técnico) como `AJUSTE` de apertura. Los comprobantes nuevos generan movimientos desde una **fecha de corte**. Lo anterior queda como historial consultable.

## Stock en poder de clientes (agregado 2026-10-16)

A veces **se envía stock directamente a los clientes** (equipos, accesorios o repuestos que quedan en su poder), así que el panel no puede tener solo depósito y técnicos: el cliente es una tercera ubicación.

- **Ubicación `CLIENTE`:** una por cliente, con el mismo modelo (`StockCantidad` y `ItemSerie` por ubicación). El equipo serializado enviado a un cliente pasa a `EN_CLIENTE`, distinto de `INSTALADO` (que es colocado en un vehículo).
- **Movimientos:** depósito → cliente (envío, con remito), técnico → cliente (el técnico lo deja en el lugar), cliente → depósito o técnico (devolución o retiro). El mismo circuito de `Transferencia` (`PENDIENTE → EN_TRANSITO → RECIBIDA`), porque el cliente confirma la recepción.
- **Vista en el panel:** en la ficha del cliente, "Stock en su poder" con series y cantidades, quién lo envió y cuándo; además un total por producto para saber cuánto hay "en la calle".
- **Relación con otros temas:** la entrega de equipo backup o de equipo personal (el acta de retiro/entrega en `docs-retiro-entrega-equipo.md`) hoy no mueve stock. Al instalarse un equipo que el cliente ya tenía en su poder, el consumo sale de ahí y no del técnico.
- **Reglas a definir:** si el cliente puede quedar con saldo permanente (consignación) o solo en tránsito, si el stock en poder del cliente se factura o es comodato, y qué pasa si el cliente no devuelve algo (¿pasa a `BAJA`, a cobro?).

## Pendiente de definir

- Cómo es el remito/recibo de BO3 (campos, quién lo usa, si incluye accesorios por cantidad). Falta una captura o el endpoint.
- Quién aprueba los ajustes y las altas de series.
- Quién hace la revisión de equipos devueltos (depósito o soporte) y qué chequea.
- Si hay una carga inicial de los equipos ya instalados en campo (relacionado con `Equipo` en `ALCANCE_BACKOFFICE.md` §8, que hay que revisar para no duplicar `MovimientoStock`).
- Si algún día se crea un segundo depósito: si las transferencias entre depósitos pasan por el mismo circuito (sí, es una `TRANSFERENCIA` más).
- Si Odoo necesita enterarse de los consumos (hoy no: la facturación sale de la orden de venta).
- Cliente como ubicación de stock: ¿consignación, comodato o venta? ¿quién confirma que el cliente recibió? ¿cómo se concilia con el remito de BO3?
