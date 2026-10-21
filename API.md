# API de preinstalación: guía para la app de técnicos

Oct 15, 2026 · @Matías

## Qué hace el servicio

Este backend permite que un técnico pruebe un equipo antes de instalarlo en un cliente. Puede configurar el corte de motor y el protocolo CAN bus, y verificar que el equipo reporte. Para eso, el servicio crea solo un móvil temporal y lo borra solo después de 30 minutos sin uso.

| Concepto | Qué es |
| --- | --- |
| Equipo | El dispositivo físico. Se identifica con `equipo_id`, un número que se obtiene con `get_equipo_id`. |
| Móvil de preinstalación | Móvil temporal que el servicio crea en un grupo reservado para esta herramienta. La app nunca lo crea ni lo borra directamente. |
| Opciones pendientes | Configuraciones guardadas que el equipo todavía no aplicó. |
| Equipo instalado en un cliente | Un equipo que ya tiene un móvil fuera del grupo de preinstalación. Se puede consultar, pero no configurar desde esta API. |

## Cómo hacer un request

Cada método se llama con un `POST` a `/<método>`, con un token Bearer y un body JSON.

| Elemento | Valor |
| --- | --- |
| URL | `http://apps4.visionblo.com:8001/<método>`, sin query string (`?x=...` hace fallar la llamada) |
| Método HTTP | Siempre `POST` |
| Autenticación | Header `Authorization: Bearer <token>` |
| Body | Un objeto JSON, aunque el método no tenga parámetros (`{}`) |
| Tamaño máximo del body | 64 KB |
| Respuesta | JSON, con `Content-Type: application/json; charset=utf-8` |

Cada token tiene una lista de métodos permitidos, configurada por un administrador del servidor. Si la app necesita un método nuevo, hay que pedir que lo agreguen al token.

`equipo_id` siempre se envía como número JSON (`1234`), nunca como string (`"1234"`). Se valida en todos los métodos.

```
curl -X POST http://apps4.visionblo.com:8001/ultimo_reporte \
  -H 'Authorization: Bearer <token>' \
  -d '{"equipo_id": 1234}'
```

Los tokens se piden a Matías Moreno (mmoreno@waragps.com).

## Respuestas y errores

El servidor siempre responde HTTP 200, así que la app debe mirar el body. Si hay éxito, viene `"ok": true`. Si hay error, viene solo `error`.

```json
{ "ok": true, "equipo_id": 1234 }
```

```json
{ "error": "Requiere equipo_id" }
```

Los mensajes de error están en español y se pueden mostrar tal cual al técnico. Estos son los que puede devolver cualquier método. Los propios de cada uno están en la referencia de métodos.

| Mensaje | Causa | Qué hacer |
| --- | --- | --- |
| `Método no permitido` | El request no es `POST` | Corregir la app |
| `Token inválido` | Falta el header `Authorization` o el token no existe | Revisar la configuración del token |
| `Acceso denegado` | El token no tiene permiso para ese método, o el método no existe | Pedir el permiso o revisar la URL |
| `JSON inválido` | El body no es JSON válido o está vacío | Enviar al menos `{}` |
| `Request demasiado grande` | El body supera 64 KB; el servidor cierra la conexión | Corregir la app |
| `equipo_id debe ser numérico` | `equipo_id` llegó como string u otro tipo | Enviarlo como número JSON |
| `La operación no se pudo completar` | Error interno, queda registrado en el log del servidor | Reintentar; si persiste, avisar a sistemas |

## Referencia de métodos

Hay cinco métodos. Solo `corte_motor` y `canbus` modifican datos, y son los que crean el móvil de preinstalación si todavía no existe.

| Método | Para qué | Modifica datos |
| --- | --- | --- |
| `get_equipo_id` | Obtener el `equipo_id` a partir de IMEI, serie o nombre | No |
| `ultimo_reporte` | Ver si el equipo reporta y qué reportó | No |
| `corte_motor` | Activar o desactivar el corte de motor | Sí |
| `canbus` | Elegir el protocolo CAN bus | Sí |
| `opciones_pendientes` | Saber si el equipo ya aplicó la configuración | No |

### get\_equipo\_id

Devuelve el `equipo_id` del equipo que coincide con alguno de los datos enviados. Hay que enviar al menos uno. Si se envían varios, alcanza con que coincida cualquiera.

Si se tiene el IMEI, conviene enviar solo el IMEI, sin `serie` ni `nombre`. Cuantos más datos se envían, más probable es que coincidan con equipos distintos y se reciba el error de más de un equipo.

| Parámetro | Tipo | Obligatorio |
| --- | --- | --- |
| `imei` | string | Al menos uno de los tres |
| `serie` | string | Al menos uno de los tres |
| `nombre` | string | Al menos uno de los tres |

```json
// request
{ "imei": "861234567890123" }
// respuesta
{ "ok": true, "equipo_id": 1234 }
```

Si no hay coincidencias, `equipo_id` vale `false`, y no se trata como error.

Errores: `Se debe indicar imei, nombre y/o serie`, `Los datos indicados corresponden a más de un equipo`.

### ultimo\_reporte

Devuelve la última recepción del equipo y su último reporte de cada tipo de evento. Funciona con cualquier equipo, esté preinstalado o no.

| Parámetro | Tipo | Obligatorio |
| --- | --- | --- |
| `equipo_id` | number | Sí |

```json
{
  "ok": true,
  "ultima_recepcion": "2026-07-02T20:51:14.000Z",
  "ultimo_reporte": {
    "encendido": { "fecha": "2026-07-02T15:50:11.000Z", "datos": {} },
    "ignicion": { "fecha": "2026-07-02T15:50:12.000Z", "datos": { "presente": false } },
    "corte_de_motor": { "fecha": "2026-07-02T15:50:12.000Z", "datos": { "corte": false } },
    "estado_general": { "fecha": "2026-07-02T20:50:22.000Z", "datos": { "voltaje_bateria": 4.064, "voltaje_cargador": 0.11, "dbm_modem": -69, "temperatura_modem": 0 } },
    "posicion": { "fecha": "2026-07-02T20:44:09.000Z", "datos": { "latitud": -328834578, "longitud": -688581391, "altitud": 755, "velocidad": 0, "orientacion": 57, "satelites": 5, "hdop": 40, "odometro": 75090594 } },
    "geocerca_entrada": { "fecha": "2023-07-04T05:18:05.000Z", "datos": { "geocerca_id": 27360 } }
  }
}
```

El ejemplo está recortado: un equipo real puede devolver más de 20 eventos, por ejemplo `sim`, `firmware_actualizado`, `rfid` o `infraccion_velocidad`.

- `ultima_recepcion`: fecha y hora de la última comunicación del equipo, en ISO 8601 y UTC. Vale `false` si el equipo nunca reportó.
- `ultimo_reporte`: objeto indexado por nombre de evento. Cada evento trae `fecha` (ISO 8601, UTC) y `datos`. Los campos de `datos` varían según el evento, y pueden venir como objeto vacío `{}` o array vacío `[]`.
- Solo aparecen los eventos configurados en el servidor que el equipo reportó alguna vez. Si no hay reportes, el objeto viene vacío.
- Cada evento muestra su último reporte, que puede tener años (en el ejemplo, `geocerca_entrada` es de 2023). Para verificar una prueba, comparar `fecha` con la hora en que empezó.

Errores: `Requiere equipo_id`.

### corte\_motor

Activa o desactiva el corte de motor y le avisa al equipo para que aplique el cambio. Un corte activado vence solo a los 15 minutos.

| Parámetro | Tipo | Obligatorio |
| --- | --- | --- |
| `equipo_id` | number | Sí |
| `corte` | boolean | Sí; `true` corta, `false` libera |

```json
// request
{ "equipo_id": 1234, "corte": true }
// respuesta
{ "ok": true }
```

`ok: true` significa que la configuración quedó guardada, no que el equipo ya la aplicó. Para confirmarlo, usar `opciones_pendientes`.

Errores: `Requiere equipo_id`, `Requiere corte tipo boolean`, `equipo_id no encontrado en base de datos`, `No se puede testear por esta vía un equipo que actualmente está instalado en un cliente`.

### canbus

Configura el protocolo CAN bus y le avisa al equipo para que aplique el cambio.

| Parámetro | Tipo | Obligatorio |
| --- | --- | --- |
| `equipo_id` | number | Sí |
| `protocolo` | string: `"mercedes"`, `"fms"`, `"obd"` o `""` | Sí |

La cadena vacía `""` desactiva el CAN bus en el equipo. Es el valor con el que arranca un equipo preinstalado.

```json
// request
{ "equipo_id": 1234, "protocolo": "fms" }
// respuesta
{ "ok": true }
```

Igual que en `corte_motor`, `ok: true` no confirma que el equipo ya aplicó el cambio.

Errores: `Requiere equipo_id`, `Requiere protocolo 'mercedes', 'fms', 'obd', ''`, `equipo_id no encontrado en base de datos`, `No se puede testear por esta vía un equipo que actualmente está instalado en un cliente`.

### opciones\_pendientes

Indica si el equipo todavía tiene configuraciones sin aplicar.

| Parámetro | Tipo | Obligatorio |
| --- | --- | --- |
| `equipo_id` | number | Sí |

```json
// request
{ "equipo_id": 1234 }
// respuesta
{ "ok": true, "pendientes": false }
```

- `pendientes: true`: el equipo todavía no aplicó alguna configuración.
- `pendientes: false`: aplicó todo, o no tiene ningún móvil activo.

## Ciclo de vida de la preinstalación

El móvil temporal se crea con el primer `corte_motor` o `canbus`. Se borra solo cuando pasan 30 minutos sin requests para ese equipo.

```
Sin preinstalar  --(corte_motor o canbus)-->  Preinstalado (móvil temporal)
Preinstalado     --(request con equipo_id)--> Preinstalado (reinicia el plazo de 30 min)
Preinstalado     --(30 min sin requests)--->  Sin preinstalar (se borra el móvil)
```

- Cualquier request con `equipo_id` cuenta como uso, incluidos `ultimo_reporte` y `opciones_pendientes`. Por eso, una pantalla que consulta periódicamente mantiene vivo el móvil.
- Al borrarse el móvil, se pierde la configuración aplicada. El próximo `corte_motor` o `canbus` crea un móvil nuevo con la configuración por defecto: sin corte de motor y sin protocolo CAN bus.
- Si el servicio se reinicia, a los 30 minutos del arranque borra las preinstalaciones que nadie usó desde el reinicio.
- La API no tiene un método para borrar la preinstalación a mano.
- En un equipo instalado en un cliente, `corte_motor` y `canbus` devuelven error, mientras que `ultimo_reporte` y `opciones_pendientes` funcionan normalmente. Nunca se crea ni se borra nada sobre ese equipo.

## Flujo recomendado para la app

Una prueba típica tiene estos pasos: identificar el equipo, configurarlo, esperar a que aplique la configuración y verificar los reportes.

1. Identificar el equipo con `get_equipo_id` (por ejemplo, con el IMEI escaneado). Si devuelve `false`, el equipo no está dado de alta.
2. Comprobar que el equipo reporta, con `ultimo_reporte`. Mirar `ultima_recepcion`.
3. Configurar lo que haga falta con `canbus` o con `corte_motor`.
4. Consultar `opciones_pendientes` de forma periódica, por ejemplo cada 5 segundos, hasta que devuelva `false`. A partir de ahí, el equipo ya aplicó la configuración.
5. Verificar el resultado con `ultimo_reporte`.
6. Si se activó el corte de motor, liberarlo con `corte: false` al terminar. De todos modos, vence solo a los 15 minutos.

Al terminar, no hace falta limpiar nada: el móvil temporal se borra solo a los 30 minutos sin uso.

Para que la app no falle con `equipo_id debe ser numérico`, conviene guardar el `equipo_id` tal como lo devuelve `get_equipo_id` y reenviarlo sin convertirlo a string.
