# PDF de visita fallida y de cliente ausente (evaluación)

Fecha: 2026-10-06. Estado: **solo evaluado, sin implementar**.

## Lo que se quiere

Cuando la visita queda como **visita fallida** (el técnico fue al lugar y no encontró la unidad) se tiene que generar un PDF que lo deje asentado. Lo mismo cuando **el cliente no está y no pudo firmar**.

## Qué pasa hoy

| Situación | ¿Se genera PDF? | Qué queda registrado |
|---|---|---|
| **Unidad no encontrada** (visita fallida) | **No** | Una incidencia en Mongo (20 hasta hoy: 7 pendientes de reprogramar y 13 reprogramadas), una nota en la subtarea de Odoo, una actividad para coordinación y la tarjeta en "Visita fallida" / "En espera". No hay hoja de conformidad, así que no hay nada que imprimir. |
| **Cliente ausente, pero el trabajo se hace** (PRE o POST sin firma) | **Sí**, en la hoja normal | El PDF muestra el recuadro "Cliente ausente" y el motivo en lugar de la firma. Hay 28 hojas con cliente ausente en el PRE y 16 en el POST. |
| **Cliente ausente y no se puede hacer el trabajo** (no hay acceso a la unidad) | **No** | Cae en el primer caso: no hay hoja. |

Notas del segundo caso: el PDF solo llega al ticket si la hoja está completa, tiene ticket de Odoo vinculado y el técnico tiene su cuenta de Odoo vinculada. Algunas hojas viejas quedaron con cliente ausente y sin motivo (anteriores a que fuera obligatorio).

## Datos que ya existen para armar la constancia

- **De la incidencia:** unidad (patente), motivo, fecha, quién la reportó y a qué hora.
- **De la visita:** cuándo salió y cuándo llegó el técnico (`enCaminoAt`, `enSitioAt`), que sirve de prueba de presencia.
- **De la tarea y el ticket:** cliente, número de ticket y teléfono de contacto.

## Propuesta: "Constancia de visita"

**Cuándo se genera:** en la API, al crearse una incidencia (y a futuro, para el POST pendiente). Se genera una sola vez por incidencia (el reporte ya es idempotente por `clientId`). Si el reporte se hizo sin señal, se genera cuando llega, con la hora real del toque.

**Qué lleva:**
- Encabezado de WARA, número de ticket, cliente y unidad.
- Técnico, fecha y hora de llegada, y hora del reporte.
- Tipo de motivo y detalle.
- Resumen de lo ocurrido en una línea clara (ej. "El técnico se presentó en el lugar y la unidad no se encontraba").
- Firma de quien recibió, o la leyenda "No había persona para firmar".

**Datos nuevos que habría que pedir en la PWA:**
- **Tipo de motivo** (lista): unidad no estaba, cliente ausente, no permitieron el acceso, otro. Hoy el motivo es solo texto libre.
- **Ubicación (GPS)** al momento del reporte, como prueba de presencia.
- **Foto opcional del lugar** (en una segunda etapa, porque con reporte sin señal requiere subir archivos desde la cola).
- **Firma opcional** de quien atendió.

**A dónde va:**
- Se adjunta al ticket de Odoo, como las hojas de conformidad, y se deja una nota en la subtarea.
- En el panel, un botón "Ver constancia" en el listado de "Unidades no encontradas".

**Respaldo comercial:** el catálogo ya tiene el producto `VIS.003` "Visita fallida" (se cobra). La constancia sirve de respaldo para facturarlo.

## Cosas a resolver

- **Mensaje al cliente:** el comentario del ticket es público y Odoo le manda un correo al cliente como seguidor. Hay que decidir si la constancia se manda al cliente o queda como nota interna.
- **Aviso por Telegram:** hoy el cliente recibe "salió", "llegó" y "trabajo finalizado". Con una visita fallida hace falta un texto propio ("no se pudo realizar la visita").
- **Cuenta que publica en Odoo:** si el técnico no tiene la suya vinculada, hay que decidir si se usa la cuenta de servicio (para constancias parece razonable).
- **Cliente ausente con trabajo hecho:** el PDF actual ya lo cubre. Conviene que el motivo sea siempre obligatorio y que el teléfono del cliente se vea en esa pantalla.

## Estimación

Un sprint corto sin foto (API: campos, plantilla de PDF, envío a Odoo y tests; PWA: tipo de motivo y GPS; panel: botón). La foto del lugar y la firma, en una segunda etapa.

## Tipos de motivo (definidos 2026-10-07)

Lista de elección en la PWA; el texto libre queda como detalle.

| Tipo | Qué pasó |
|---|---|
| Cliente ausente y sin unidades | No había nadie y las unidades tampoco estaban |
| Unidades no estaban | Había alguien, pero las unidades no estaban en el lugar |
| Nadie para autorizar | Las unidades estaban, pero no había quien autorizara la instalación o intervención |
| Otro | Detalle obligatorio |

A confirmar: si hace falta un caso aparte para "había alguien pero no podía autorizar" (hoy entra en "Nadie para autorizar") y si conviene separar "cliente ausente" de "unidades no estaban" para facturar `VIS.003`.

## Decisiones pendientes

1. ~~¿Qué tipos de motivo se ofrecen?~~ Resuelto, ver arriba.
2. ¿GPS y foto: obligatorios u opcionales?
3. ¿La constancia le llega al cliente por correo o es solo interna?
4. ¿Texto del aviso de Telegram para visita fallida?
5. ¿Se sugiere o carga automáticamente `VIS.003` en la orden de venta?

## Visita fallida vs. reprogramación por demora del técnico (definido 2026-10-07)

Son dos cosas distintas, con dos PDFs distintos al ticket:

| | Visita fallida (`no_encontrada`) | Llegada tarde (`llegada_tarde`) |
|---|---|---|
| Qué pasó | El técnico llegó a horario y la unidad no estaba | El técnico llegó pasada la tolerancia y la unidad ya se había ido |
| Culpa | Cliente | WARA |
| PDF | **Constancia de visita fallida** (con hora agendada y hora de llegada como prueba) | **Reprogramación sin cargo** (explica la demora) |
| `VIS.003` | Sí | No |

**Cómo se decide (opción C, híbrido):** al reportar, la API compara la hora agendada con la hora en que el técnico marcó "llegué" (`enSitioAt`). Si llegó más de **15 minutos** después, sugiere `llegada_tarde`; si no, `no_encontrada`. Sin hora agendada o sin "llegué" marcado no sugiere nada. Coordinación puede **corregir el tipo al resolver** (`tipo` en el PATCH), antes de que salga el PDF. Quedan guardados `tipoSugerido` y quién lo corrigió.

**Cuándo sale el PDF:** al resolver la incidencia. La constancia sale aunque todavía no haya fecha nueva; la reprogramación necesita fecha.

**Hecho en la API (2026-10-07):** `clasificarIncidencia.ts`, tipo `llegada_tarde`, campos `horaAgendada`/`llegadaAt`/`tipoSugerido`, `constanciaVisitaFallidaPdf.ts`, texto "sin cargo" en la reprogramación, horas en formato 24 h. Con tests.

**Falta:**
- **PWA:** mandar `horaAgendada` al crear la incidencia (la API ya lo acepta).
- **Panel:** mostrar el tipo sugerido y permitir cambiarlo al reprogramar (la API ya acepta `tipo`).
- Probar contra el Odoo de pruebas.
- Decidir si el aviso `VIS.003` se sugiere solo para `no_encontrada`.

## Regla por rango horario (2026-10-21) — reemplaza la tolerancia de 15 minutos

Las visitas se agendan por **rango** (ej. de 12:00 a 13:00): el técnico puede llegar en cualquier momento del rango sin que sea una demora. Ya no se compara la llegada con la hora de inicio.

| Cuándo marcó "Llegué" el técnico | Qué es | PDF al ticket | Se cobra |
|---|---|---|---|
| Antes de que termine el rango (o justo al fin) | **Visita fallida** | Constancia de visita fallida | Sí (VIS.003) |
| **Después** de que terminó el rango | En parte culpa de WARA | Reprogramación **sin cargo**, con el rango y la hora de llegada | No |

- Vale para los tres reportes de la ficha: "No está en el lugar", "Reprogramar" (PRE cancelado) y "Lo pidió el cliente". En el último el PDF es el de siempre y solo agrega la leyenda "sin cargo" si llegó fuera del rango.
- La PWA manda el rango (`horaAgendada` y `horaFinAgendada`); la API lo compara en `clasificarLlegada` y guarda `fueraDeRango` en la incidencia. **El tipo que reporta el técnico ya no se cambia solo.**
- Sin el fin del rango o sin "Llegué" marcado no se decide: queda como visita fallida.
- Coordinación puede corregirlo al resolver con `tipo` (`no_encontrada` = visita fallida, `llegada_tarde` = sin cargo); **el panel todavía no tiene el selector**. Las incidencias viejas con tipo `llegada_tarde` siguen siendo sin cargo.
- Ya no aparece el texto "por demora del técnico": se dice "llegó fuera del rango horario agendado".
- Un PRE cancelado dentro del rango ahora sale como constancia de visita fallida (antes salía como "reprogramación" sin cargo ni cobro).

## La constancia sale al reportar (2026-10-21)

Cuando el técnico confirma **"No está en el lugar"** y llegó dentro del rango horario, la constancia de visita fallida se genera y se adjunta al ticket **en ese momento**, sin esperar a coordinación: el ticket queda con la prueba de que el técnico fue al lugar.

- Si llegó **fuera del rango**, no sale nada todavía: va la reprogramación sin cargo (necesita fecha nueva) cuando coordinación resuelve, como antes.
- Si falla el envío (Odoo caído, etc.) la incidencia se guarda igual con el error, y **al resolver se reintenta**.
- Cuando coordinación reprograma, **no sale un segundo PDF**: se deja una nota en el ticket con la fecha nueva. Marcar solo como resuelta, sin fecha, no manda nada más.
- Sin ticket vinculado no hay dónde adjuntarla (no se manda nada).
- "Reprogramar" (PRE cancelado) sigue esperando a coordinación; "Lo pidió el cliente" ya mandaba su PDF al reportar.
- En pausa por decisión del 2026-10-21: ubicación (GPS), foto del lugar, firma de quien atendió y tipo de motivo en lista.
- **Para probarlo**: usar la API y el panel locales (los dos con el Odoo de pruebas). Resolver desde Vercel una incidencia creada en local actúa sobre el Odoo de producción con ids de pruebas (ver el incidente del ticket 39091).

**Estado (2026-10-22): el envío al reportar está APAGADO.** La constancia al reportar solo sale si la variable de entorno `CONSTANCIA_AL_REPORTAR=1` (en Render). Sin ella, reportar "No está en el lugar" no manda nada a Odoo y la constancia sigue saliendo cuando coordinación resuelve, como antes. La clasificación por rango horario sí se calcula y se guarda en la incidencia.
