# Cancelar el PRE y proponer reprogramación (evaluación)

Fecha: 2026-10-07. Estado: **solo evaluado, sin implementar**.

## Lo que se quiere

Ayer pasó que se empezó el PRE y el técnico no podía quedarse ni volver a otra hora. Hoy no hay forma de cancelar el PRE y avisar. Se quiere que el técnico pueda **cancelar el PRE y enviar una propuesta de reprogramación (día y hora) junto con su tarea o sus unidades**, y que **coordinación acepte o rechace** la propuesta.

## Qué hay hoy (revisado en la API)

- Existe `SubtareaIncidencia` (`api/src/models/SubtareaIncidencia.ts`): una por unidad, con `motivo` obligatorio, `clientId` (idempotente y apto para cola sin señal) y estados `pendiente_reprogramar` → `reprogramada`. El único tipo es `no_encontrada`.
- Al crearla, la API pone la subtarea en "En espera" y "Visita fallida" en Odoo, deja una nota, crea una actividad para coordinación y, si todas las unidades del lote fallaron, mueve también la tarea padre.
- Coordinación reprograma desde el panel con `PATCH` (`resolveSubtareaIncidencia`): mueve la fecha en Odoo, reabre la tarea, puede cambiar de técnico y marca la incidencia como reprogramada. Solo pueden `coordinacion`, `admin` y `superadmin`. Si Odoo falla, la incidencia no se marca.
- La PWA ya tiene cola de incidencias sin señal (`incidenciaQueue.ts`) y pide confirmación antes de cerrar la visita.
- **No revisé la PWA** (pantalla del PRE ni `AgendaTaskSheet`). Lo que dependa de ella está marcado como supuesto.

## Propuesta: reutilizar la incidencia

No crear un circuito nuevo. Ampliar `SubtareaIncidencia`:

- **Tipo nuevo:** `pre_cancelado` (el técnico cancela el PRE y no puede volver). Se suma a `no_encontrada`.
- **Campos nuevos:** `propuestaInicio` y `propuestaFin` (la fecha y hora que propone el técnico), y `motivoRechazo`.
- **Estados nuevos:** `propuesta_pendiente` (espera respuesta), `rechazada` (coordinación dijo que no; vuelve a necesitar fecha). Se mantienen `pendiente_reprogramar` y `reprogramada`.
- **Aceptar:** es el mismo `PATCH` de hoy, usando la fecha propuesta: mueve en Odoo, reabre y marca `reprogramada`. Coordinación puede cambiar la hora antes de aceptar. Eso sería una contraoferta, que hay que decidir si se admite.
- **Rechazar:** coordinación escribe el motivo; la unidad queda `pendiente_reprogramar` y coordinación la reprograma por el camino actual.
- **Varias unidades:** una incidencia por unidad, todas con la misma propuesta y un identificador de grupo para aceptarlas o rechazarlas juntas. Si no se agrupan, coordinación tendría que aceptar una por una.
- **Sin señal:** funciona con la cola actual, porque el `clientId` hace el envío idempotente.

## Qué le pasa al PRE empezado (supuesto, sin revisar la PWA)

Si el PRE ya tiene fotos, IMEI o checklist, hay que elegir:
- **Descartarlo:** más simple, pero se pierde lo hecho.
- **Dejarlo como borrador:** se retoma en la nueva fecha. Es más útil, pero se parece al tema 3 (POST pendiente) y conviene resolverlos juntos.

Además hay que cerrar la visita del técnico (`/visitas/:id/finalizar`) para que no quede en curso ni corra el tiempo.

## Cosas a resolver

- **Mientras se espera la respuesta:** ¿la unidad ya pasa a "Visita fallida" / "En espera" (como hoy) o queda en la agenda del técnico hasta que coordinación responda? Lo primero la saca de la agenda y evita visitas dobles; lo segundo mantiene todo en su lugar si se rechaza.
- **Cómo se entera coordinación:** ya existe la actividad en Odoo y el listado de incidencias del panel. Falta un contador o aviso de "propuestas pendientes" y definir quién las atiende.
- **Cómo se entera el técnico de la respuesta:** hoy no hay un canal definido. Opciones: que la nueva fecha aparezca en su agenda (ya ocurre al reprogramar) y una notificación para el rechazo.
- **Cliente:** hoy recibe avisos por Telegram de "salió", "llegó" y "finalizado". Hace falta un texto para "visita cancelada, nueva fecha".
- **Constancia de visita (tema 2):** esto es otro motivo de visita no realizada. Conviene que genere la misma constancia, con un tipo propio ("cancelada por el técnico, reprogramación propuesta").
- **Facturación:** `VIS.003` (visita fallida) no debería sugerirse cuando la cancelación es por el lado de WARA.
- **Mesa de ayuda:** hoy solo puede marcar como resuelta, no reprogramar. Mantener ese criterio.

## Estimación

Sprint corto si se reutiliza la incidencia y no se guarda el PRE como borrador:
- **API:** campos y estados nuevos, endpoint de aceptar o rechazar con tests.
- **PWA:** botón "Cancelar PRE" con motivo y selector de fecha y hora, para una o varias unidades.
- **Panel:** lista de propuestas con "Aceptar", "Contraofertar" y "Rechazar".

Si además se conserva el PRE como borrador, se suma el trabajo del tema 3.

## Decisiones (2026-10-07)

1. **PRE con datos:** queda como borrador si tuvo datos cargados (se junta con el tema 3, POST pendiente).
2. **Mientras coordinación no responde:** la unidad queda "En espera".
3. **Aceptar:** coordinación puede cambiar la hora o aceptar la que propuso el técnico.
4. **Propuesta por tarea o por unidad:** se admiten **ambas**. El técnico puede proponer un horario para toda la tarea o uno distinto por unidad (caso típico: se hace una unidad y la otra queda para otra hora o fecha). Conviene que la pantalla arranque con un horario común y permita cambiarlo por unidad.
5. **Avisos:** todo queda por Odoo. El aviso al cliente lo hace el técnico o coordinación (no hay envío automático). Al reprogramar se genera un **PDF nuevo** ("el cliente pidió reprogramación para X fecha y hora") que se **adjunta al mismo ticket**.
6. **Constancia de visita:** sí, esto también la genera (tema 2).

## Aclaraciones (2026-10-07, tarde)

- **El horario de la tarea (padre) en Odoo se respeta.** Al reprogramar, el día y la hora se escriben **en la SUBTAREA** (la unidad), no en la tarea.
- **Varias unidades:** el técnico puede marcar algunas o todas como "no se encuentra" / PRE cancelado. Cada unidad lleva su propia propuesta, y al ticket llega la reprogramación **de cada subtarea, con el nombre de la subtarea (la unidad)**.

## Pasos de implementación

1. **API:** incidencia con tipo `pre_cancelado`, propuesta (`propuestaInicio`/`propuestaFin`), estados `propuesta_pendiente` y `rechazada`, aceptar (con hora propia o la propuesta) y rechazar con motivo. **Hecho 2026-10-07**, con tests del esquema; falta probar contra Odoo.
2. **API:** PDF de reprogramación adjunto al ticket, uno por subtarea con su nombre. **Hecho 2026-10-07** (`reprogramacionPdf.ts`, `buildReprogramacionPdfBuffer`, `pushReprogramacionToTicket`): se genera cuando coordinación reprograma o acepta, si la incidencia trae `ticketOdooId`; lo publica con la cuenta de Odoo del técnico o, si no la vinculó, con la de servicio. Si falla, la reprogramación igual queda hecha y el error se guarda en la incidencia. La PWA tiene que mandar `ticketOdooId` y `clienteNombre` al crear. Falta ver el PDF renderizado de verdad y ajustar el texto.
3. **PWA:** **Hecho 2026-10-07** (sin probar en pantalla). En la ficha de la agenda, el botón "No está en el lugar / reprogramar" abre el formulario con "No está en el lugar" o "Cancelo el PRE" (el PRE empezado queda de borrador), el motivo, "Proponer nueva fecha y hora" (desde/hasta) y la elección de otras unidades del lote para aplicarles lo mismo. Una incidencia por unidad, con el nombre de la subtarea. Si coordinación acepta o rechaza, la ficha lo muestra. Funciona sin señal por la cola de siempre. Límite actual: no hay botón dentro de la pantalla del PRE, se cancela desde la ficha de la agenda; y la propuesta es una sola para todas las unidades marcadas (para horarios distintos se repite el reporte por unidad).
4. **Panel:** **Hecho 2026-10-07** (sin probar en pantalla). En Incidencias hay pestañas Propuestas, Pendientes (incluye las rechazadas) y Reprogramadas. Una propuesta se puede Aceptar tal cual, Cambiar hora (precarga la hora propuesta y su duración) o Rechazar con motivo obligatorio. Muestra si fue PRE cancelado y avisa si el PDF no se pudo adjuntar al ticket. La API acepta ahora varios estados separados por coma en el filtro.

**Falta:** prueba de punta a punta en el Odoo de pruebas (local), ver el PDF renderizado, y commit selectivo (hay trabajo ajeno mezclado en los tres repos) con despliegue de la API primero.

## Decisiones pendientes

- Cómo se entera el técnico de un rechazo (¿actividad o nota en la subtarea, o aviso en la PWA?).
- Con propuestas por unidad, si el PDF sale uno por unidad o uno solo con todas las unidades y sus horarios (recomendado: uno solo).

## Reprogramación a pedido del cliente, con firma (2026-10-20)

Tercer motivo de incidencia, `reprogramado_cliente`: el técnico fue al lugar y el cliente pidió pasar la visita a otro día. Queda constancia firmada.

**Decisiones:**
- El PDF "Constancia de reprogramación a pedido del cliente" **sale al reportar** (la fecha ya está acordada con el cliente), no cuando coordinación responde. Se adjunta al ticket, igual que la visita fallida, y coordinación recibe la actividad en la tarea.
- La incidencia queda `propuesta_pendiente` con la fecha que eligió el cliente. Coordinación puede aceptar, cambiar la hora o rechazar. El PDF queda con la fecha del cliente; si coordinación pone otra, **solo se deja una nota en el ticket** (no hay segundo PDF).
- Firma del cliente (PNG, nombre y DNI opcional) o **"No hay quien firme"** con motivo. Una de las dos es obligatoria.
- **Se cobra** `VIS.003` (visita fallida) en este caso.
- El PRE empezado queda como borrador.

**API:** tipo y `firmaCliente` en `SubtareaIncidencia`; el PNG viaja en el POST (`firma.png`, data URI ≤ 400.000 caracteres, validado por bytes mágicos) y la API lo sube a R2 con `buildIncidenciaFirmaKey`; `reprogramacionClientePdf.ts` + `buildReprogramacionClientePdfBuffer`; `postTicketNote` para la nota. Si falla la subida de la firma el reporte no se guarda (el reintento por `clientId` es idempotente). Si falla el envío del PDF queda `pdfReprogramacionError`, que el panel muestra.
**PWA:** tercera opción "Lo pidió el cliente" en `ReporteVisitaCampos` (fecha obligatoria, `SignaturePad`, nombre, DNI o "No hay quien firme"); `errorReporte` y `firmaAlBody`. Funciona sin señal por la cola (la firma va dentro del reporte encolado).
**Panel:** en Incidencias muestra el tipo, quién firmó con enlace a la firma (o el motivo de que no hubo), y el error del PDF.

**Falta:** probar contra el Odoo de staging, ver el PDF renderizado con una firma real, y probar la pantalla en un celular. No hay reintento del PDF si falló al crear (queda visible el error en el panel).
