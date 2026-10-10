# Cambios del 2026-10-08

Resumen de lo hecho en esta tanda (API `appHojaConformidad`, PWA `PWAWARACONFORMIDAD`). Detalle de diseño en
`docs-visita-fallida-pdf.md` y `docs-retiro-entrega-equipo.md`.

## Publicado (push a `master`)

- API: commit `70c6362`
- PWA: commit `16f6286`

### 1. Visita fallida vs. llegada tarde del técnico
- Dos PDFs distintos al ticket de Odoo: **constancia de visita fallida** (el técnico llegó a tiempo y la unidad no
  estaba) y **reprogramación por demora del técnico** (llegó tarde).
- El sistema sugiere el tipo comparando la hora agendada con el "llegué" del técnico (`enSitioAt`), tolerancia
  **15 minutos** (`clasificarIncidencia.ts`). Coordinación puede corregir el tipo antes de que salga el PDF.
- La PWA envía `horaAgendada` al reportar "no está en el lugar".
- Horas en PDF en formato 24 h.

### 2. Fotos de Android en vertical
- La PWA está bloqueada en vertical, así que las fotos tomadas en horizontal salían giradas. Ahora se rota el
  cuadro capturado según el acelerómetro (`utils/inclinacionCelular.ts`, `SlotPhotoCapture.tsx`).

### 3. 5º tipo de servicio: Retiro / entrega de equipo
- El cliente desinstala el equipo y el técnico lo recibe (se lo entrega o lo deja para retirar). No hay PRE, paso
  intermedio ni POST: un acta corta con modalidad, equipo, adicionales, quién entrega y firma (opcional), que se
  adjunta al ticket y cierra la tarea.
- API: `/api/retiros-equipo` (modelo `RetiroEquipo`, PDF del acta). PWA: formulario con cola offline.
- Se llega desde el selector "Tipo de servicio" del PRE y desde la ficha de la agenda.
- Tipo de servicio sugerido por producto o etiqueta de Odoo (`tipoServicioSugerido.ts`). Ojo: la etiqueta 125
  "RETIRAR EQUIPO GPS" es ambigua (también se usa en desinstalaciones normales).
- Stock / desinstalación hacia backoffice: solo documentado, el acta es lo único que se hace por ahora.

### 4. Tarea compartida por 2+ técnicos
- **Base de datos (ya aplicado, sin deploy):** había un índice único viejo `tareaOdooId_1` en
  `VisitaNotificacion` que permitía una sola visita abierta por tarea y causaba "duplicated record" al segundo
  técnico. Se eliminó con `scripts/migrateVisitaNotificacionIndexes.ts` (`syncIndexes`).
- **API:** si un compañero ya tiene el viaje abierto para esa tarea y fecha, el otro no puede abrir uno propio (409
  con el nombre del compañero).
- **PWA:** si el titular (el primero que salió) ya llegó, la ficha del otro técnico pasa a "en el lugar" y habilita
  el trabajo sin registrar viaje propio; si el titular solo salió, se oculta "Salir hacia destino"; mientras la ficha
  está abierta se actualiza el estado cada 8 s y al volver a la pestaña.

## Fuera del código

### Conformidad forzada AC 278 ZG (ticket 39768, subtarea 21819)
- Cargada de forma extraordinaria desde `scripts/forzarConformidadAC278ZG.ts` (no commiteado: tiene datos fijos):
  código `CONF-20261007-968AF412`, instalación del 07/10/2026 14:17, instalador Fernando Correa, equipo modelo 2601,
  IMEI 869131070995546, odómetro 89604 km.
- Fotos: PRE (matrícula, frente, interior, odómetro) y POST (3 de precintos, botón de pánico, odómetro). Faltan
  laterales, torpedo, N° de serie del equipo y ubicación del equipo.
- Firmas PRE y POST con el motivo "Conformidad cargada de forma extraordinaria", **sin imagen** (la firma está en la
  hoja física). Sincronización a Odoo en `PENDING`: no se envió ningún PDF, la tarea de Odoo sigue en "Nuevo".
- Descarga de fotos de GJD 682 (ticket 39768) en `Downloads\GJD682_fotos` (conformidad `CONF-20261007-DA884FF3`,
  su sincronización a Odoo figura `FAILED` por timeout).

### Datos de prueba
- Se borraron los viajes de prueba de las cuentas jsangiorgio y prueba en la tarea 21034.
- La visita de Renzo en la tarea 21817 (07/10) sigue abierta en `en_sitio`.

## Pendiente
- Probar en pantalla: retiro/entrega, rotación de fotos y tarea compartida con dos perfiles (salieron a producción
  sin prueba completa; el retiro escribe en Odoo real).
- Panel (web): listado de actas de retiro con "Ver PDF", y mostrar/corregir el tipo sugerido de la incidencia.
- Odoo: producto o etiqueta propia para "retiro en mano"; confirmar con coordinación la tabla de etiquetas.
- Foto del equipo recibido en el retiro (segunda etapa).
- Cierre de visita al firmar el POST de quien trabajó sin viaje propio: hoy puede mandar el aviso de "completo" por
  Telegram mientras el titular sigue en el lugar.
- Cambios de combustible en el panel (`web/`, `equipoGraficas.service.ts`) sin commitear: son de otro trabajo.
