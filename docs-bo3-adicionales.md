# BO3 — adicionales instalados (`tipo`)

Endpoint: `GET https://ssl.visionblo.com/bo3/adicional/instalados` (cookie `VISIONBLO_SESSION_COOKIE` en `api/.env`).
Devuelve HTML con `var instalados = [...]` (se parsea como el resto de pantallas bo3; ver `api/src/config/visionblo.ts`).

Campos: `movil_id, adicional_id, cliente_id, serie, tipo, cliente, unidad, unidad_baja, cliente_baja`.

## Valores de `tipo` (relevado 2026-10-03, 1431 filas / 1130 unidades)
| tipo | filas | nota |
|---|---|---|
| A33W | 937 | **pantalla con nº de serie** (confirmado por el usuario); casi todas las unidades |
| CAM | 199 | **cámara** (confirmado por el usuario); siempre con MDVR, 2 a 4 por unidad |
| VAR | 172 | **varilla de combustible** (confirmado por el usuario); 1 a 3 por unidad |
| PRE | 68 | **¿CANbus?** (el usuario no está seguro, "creo"); series 0181xxx |
| MDVR | 55 | **grabador de video** (confirmado por el usuario); 1 por unidad con CAM |

Confirmados: A33W, VAR, CAM, MDVR. PRE = probable CANbus, **sin confirmar**.

## Diccionario de tipos
| tipo | significado | categoría | estado |
|---|---|---|---|
| A33W | Pantalla (con nº de serie) | equipo | confirmado |
| VAR | Varilla de combustible | sensor | confirmado |
| CAM | Cámara | periférico de video | confirmado |
| MDVR | Grabador de video | equipo | confirmado |
| PRE | CANbus (probable) | módulo | sin confirmar |

## Varios por unidad
- 854 unidades: un solo A33W. 27 unidades tienen 2 A33W (25 solo contando activas); 2 activas tienen 2 A33W + 4 CAM + 1 MDVR (ej. M100-021).
- VAR: 36 unidades con 2, 6 con 3. Combinaciones: A33W+CAM+MDVR, A33W+PRE, CAM+MDVR.
- Hay filas con `unidad_baja`/`cliente_baja` (A33W 110, CAM 171, VAR 59, PRE 42, MDVR 48).
- No se puede distinguir "segundo equipo real" de uno viejo no desinstalado, ni equipo vs módulo/sensor, sin la lista.

## Plan
1. Diccionario `tipo → {código, nombre, categoría: equipo|módulo|sensor}` en la API.
2. Agrupar por unidad: `equipos[]` y `adicionales[]` por separado.
3. Decidir si una unidad con 2 A33W se muestra como 2 equipos.
