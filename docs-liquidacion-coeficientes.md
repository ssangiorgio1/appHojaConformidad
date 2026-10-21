# Coeficientes de pago por trabajo realizado (técnicos)

Fuente: `Downloads\Coeficientes (2) (1).pdf` (1 página). Título del PDF: "Lista de precios desde. Trabajos realizados desde el 01-12-2024 en adelante", columna **Coeficiente A**. El `(*)` marca sensores y módulos (el PDF no trae la leyenda del asterisco). Cargado el 2026-10-15; el tema de contexto es el 19 de `docs-chimichanga.md`.

| Trabajo | Solo | + Equipo GPS |
|---|---|---|
| Instalación de equipo GPS (incluye pánico) / entrega de equipo backup / entrega de equipo personal | 1,00 | |
| Instalación de equipo GPS (incluye pánico), colocación de caja estanca | 1,00 | |
| Instalación de equipo GPS (incluye pánico) + SIM Vodafone | 1,00 | |
| Instalación GPS (incluye pánico) + sensores | 1,75 | |
| Desinstalación / cambio de unidad | 0,50 | |
| Corte de motor (*) | 0,75 | 1,75 |
| Apertura de puerta de cabina (*) | 0,75 | 1,75 |
| Apertura de puerta de carga (*) | 1,75 | 2,75 |
| Desenganche ficha tráiler (*) | 1,15 | 2,15 |
| Desenganche ficha vulcanizada (*) | 0,90 | 1,90 |
| Buzzer (*) | 1,00 | 1,50 |
| CANBUS | 1,00 | 2,00 |
| Varilla (*) | 3,00 | 4,00 |
| Micrófono (*) | 0,75 | 1,75 |
| Sensor de giro (*) y módulo de giro (*) (mismo trabajo) | 0,90 | 1,90 |
| Módulo RFID (*) | 0,75 | 1,75 |
| Sensor de temperatura (*) | 2,00 | 3,00 |
| Pantalla (*) | 1,15 | 2,15 |
| Pantalla (*) reparación | 0,90 | |
| Reparación técnica (ej. ignición, masa, reubicación de equipo, fusible) | 0,90 | |
| Reparación: cambio de equipo / colocación de tornillos, precintos, pegado | 0,75 | |
| Reparación: cambio de sensor (*) | 0,75 | |
| Revisión técnica | 0,75 | |
| Visita fallida / entrega de tarjetas RFID | 0,60 | |

## Lo que se ve en la tabla
- La columna "+ Equipo GPS" es casi siempre el valor solo **más 1,00** (la instalación del GPS). **Excepción: Buzzer**, que pasa de 1,00 a 1,50 (+0,50).
- El 2,75 que mencionó el usuario es **apertura de puerta de carga + equipo GPS**. El tráiler (ficha) con GPS es 2,15.
- "Instalación GPS + sensores" vale 1,75 en general, sin importar qué sensor ni cuántos.
- Varios ítems de la tabla no tienen suma automática (hay un valor propio para cada combinación), así que hay que cargar la tabla como está y no calcularla.

## Preguntas abiertas
- La columna se llama "Coeficiente A": ¿existe un B (otra zona, categoría de técnico u otra lista de precios)?
- ¿Cuánto vale 1,00 en pesos y cada cuánto se actualiza?
- ¿Qué pasa con combinaciones que no están en la tabla (dos sensores a la vez, cámaras ADAS/DSM, MDVR, Starlink, pantallas más sensores)?
- Visita fallida (0,60): ¿se paga siempre o depende del motivo?

## Decisiones (2026-10-19)
- **Cómo se paga un trabajo:** valor del producto en Odoo + extra (puntos de coeficiente × valor en pesos del punto) + adicional fijo por zona. El adicional de zona es un monto fijo según en qué anillo desde la oficina cae el trabajo (no un porcentaje).
- **Tarea compartida entre dos técnicos:** cada uno cobra el trabajo completo (no se reparte). Anotado; si cambia la regla, tocar `liquidarTrabajo` o el llamador.
- **Todavía sin definir (quedan como `null` en `api/src/config/liquidacion.ts`):** valor en pesos de 1,00 punto (`VALOR_COEFICIENTE`) y adicional de cada zona (`ADICIONAL_ZONA`). Sin esos datos la liquidación devuelve los puntos y deja el total en blanco.

## Implementado (paso 1, 2026-10-19, sin commit)
- `api/src/config/liquidacion.ts`: tabla de coeficientes, correspondencia casilla de la PWA → ítem, zonas y valor del punto.
- `api/src/services/liquidacion.service.ts` (+ test, 10 casos): `calcularPuntos` y `liquidarTrabajo` (función pura; recibe tipo de servicio, equipo GPS, casillas instaladas, base de Odoo y zona).
- **Reglas supuestas (confirmar):**
  - Con equipo GPS, la columna "+ Equipo GPS" se aplica a un solo ítem (el de mayor valor); los demás sensores van "solos". La tabla no dice qué pasa con varios sensores a la vez.
  - Apertura p/semi se toma como "puerta de carga"; el desacople no distingue tráiler de vulcanizada (usa tráiler); la puerta de cabina se multiplica por la cantidad.
  - Sin coeficiente en la tabla (no suman, se informan en `sinCoeficiente`): botón de pánico (va incluido en el GPS), cámaras ADAS, wifi, Starlink, antena GPS externa, identificador de chofer.
  - `reparacion` = reparación técnica (0,90) y `cambio_equipo` = 0,75; no se distingue "cambio de sensor" ni "revisión técnica".
- **Falta:** leer la base de Odoo de cada hoja, calcular la zona de cada trabajo (las tareas no traen coordenadas), endpoint de liquidación por técnico y período con copia del desglose, y la pantalla del panel.

## Endpoint (paso 2, 2026-10-19, sin commit)
- `GET /api/liquidacion?desde=YYYY-MM-DD&hasta=YYYY-MM-DD[&tecnicoId=...]`, solo `admin`/`superadmin`. Devuelve por técnico los puntos y, por trabajo, el desglose. Hojas `completo` con `odooSync.status = SYNCED`, por `fecha` de la hoja y `tecnicoId`.
- Código: `api/src/controllers/liquidacion.controller.ts`, `routes/liquidacion.routes.ts`, `services/liquidacionHoja.ts` (hoja → trabajo, con test). Sin montos todavía.
- **Límites:** no incluye visitas fallidas (viven en las incidencias, no en la hoja), ni la zona, ni la base de Odoo; no guarda copia del desglose; en `cambio_equipo` con `tecnicoIdPost` paga solo a `tecnicoId`; no probado contra la base real.
