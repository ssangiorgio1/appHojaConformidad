# Recontacto de clientes con unidades sin reportar y pre-agenda por zona (plan, 2026-10-16)

Solo plan, sin código. Parte del mapa por zonas del tema 18 de `docs-chimichanga.md`.

## Idea
Una herramienta nueva sobre el mapa de zonas para **recuperar unidades que dejaron de reportar** (24 h, 48 h, 72 h o más):
1. **Ver dónde están:** elegir clientes, o un departamento o distrito, y ver sus unidades sin reportar sobre el mapa.
2. **Contactar al cliente** (WhatsApp) para coordinar una visita y recopilar datos (¿el vehículo está en servicio?, ¿dónde está?, ¿cuándo se puede ir?).
3. **Armar una pre-agenda o pre-hoja de ruta** por técnico, agrupando visitas por zona. Ejemplo: el técnico ya tiene 3 unidades en Lavalle y se le suma la unidad de otro cliente que también está por ahí.

## Qué ya existe
- **Flota (VisionBLO):** cada unidad trae posición, cliente, última vez que reportó y categoría (`sin_reportar_24h`, `_48h`, `_72h`, `corte_sin_reportar`, `baja`, etc.). Ver `FlotaUnidad` y `flota.service.ts`.
- **Zonas:** `ubicar(lat, lng)` da el departamento y el distrito de cada unidad (`web/src/lib/zonas.ts`). La posición es la **última conocida**, no necesariamente dónde está hoy.
- **Contacto:** el teléfono del cliente sale de Odoo (`res.partner`: `mobile` y `phone`); el cliente de VisionBLO (`clienteId`) y el partner de Odoo **no están cruzados** todavía.
- **Agenda:** las tareas y subtareas viven en Odoo (`project.task`). Ya se pueden crear subtareas por RPC bajo una tarea padre sin técnico (se hace en la derivación "requiere otro técnico") y con fecha y técnico (fase 0 del tema 17).

## Piezas
### A. Vista "Sin reportar" en Zonas
- Filtros por tramo (24 h, 48 h, 72 h, más de una semana, nunca) y por cliente.
- Zonas pintadas por cantidad de unidades sin reportar; lista de clientes afectados por zona con sus unidades.
- Selección múltiple de clientes o unidades para pasar a contacto o a agenda.
- Reglas posibles: no reincidir si ya se contactó hace X días, excluir bajas y cortes de servicio, marcar unidades "esperando visita".

### B. Contacto por WhatsApp
- **Camino correcto:** WhatsApp Business API oficial (Cloud API de Meta o un proveedor), con número verificado, **plantillas aprobadas** para iniciar la conversación, y respuestas dentro de la ventana de 24 h. Un script sobre una cuenta personal o con librerías no oficiales arriesga el bloqueo del número y es contrario a los términos de WhatsApp: no lo recomiendo.
- **Flujo mínimo:** plantilla de aviso ("tu unidad X dejó de reportar…") con botones o respuestas rápidas → el cliente elige un día y franja, o dice que la unidad no está en servicio, o pide que lo llame un humano.
- **Bot que recopila datos:** preguntas cortas y cerradas (¿está operativa?, ¿dónde estará?, contacto en el lugar, horario). Las respuestas se guardan estructuradas y alimentan la pre-agenda. Todo lo ambiguo pasa a una persona.
- **Registro:** cada mensaje enviado y recibido queda en la base (quién, cuándo, plantilla, respuesta), y aviso en el ticket de Odoo si corresponde.
- **Cuidados:** consentimiento y baja ("no quiero más mensajes"), horarios razonables, tope de mensajes por cliente por semana, y no mandar nada automático al cliente sin una revisión de coordinación al principio (lección del ticket 39509).

### C. Pre-agenda y hoja de ruta
- **Propuesta de visita para el cliente (hecha 2026-10-16, probada solo el PDF):** en "Sin reportar", al marcar clientes aparece "Armar propuesta de visita". Se elige técnico (de los usuarios con rol técnico), día, franja, contacto y "qué tener listo"; cada cliente puede tener su propio día. Genera un documento por cliente (vista previa y PDF por impresión → "Guardar como PDF") con sus unidades, día, franja, técnico, zona y cómo confirmar. **No lleva coordenadas ni paradas de otros clientes y no envía nada.** Código: `PropuestaVisita.tsx`, `propuestaVisitaHtml.ts`. Estilo y logo iguales al PDF de las conformidades (`web/public/logo-wara.png`). Todavía no crea tareas en Odoo ni guarda "propuesta enviada".
- Entrada: unidades con visita aceptada por el cliente (día, franja, lugar).
- Agrupar por zona (distrito o departamento) y por día; cruzar con lo que **ya tiene agendado cada técnico** en Odoo ese día y proponer a quién sumárselo según cercanía.
- Salida: borrador editable por coordinación; al confirmar se crean las subtareas en Odoo (técnico, fecha) y aparecen en la agenda de la PWA.
- Más adelante: orden de visitas dentro del día por distancia (necesita coordenadas de las visitas; se puede usar la última posición de la unidad como aproximación) y relación con el kilometraje del tema 19.

## Plan por fases
1. **Vista "Sin reportar"** en Zonas (solo lectura, usa lo que ya hay). **Hecha el 2026-10-16, sin ver en pantalla:** pestaña "Sin reportar" en `/flota` con chips de estado (+72 h, 48–72 h, 24–48 h y, aparte, corte sin reportar), el mapa por zonas con departamentos y distritos, y la lista "Sin reportar en <zona>" (`SinReportarClientes.tsx`) con clientes ordenados por urgencia, casillas para marcarlos (el mapa pasa a mostrar solo sus unidades) y descarga de CSV. Falta: guardar "ya contactado", ver si alcanza para coordinación o si hace falta algo más.
2. **Cruce cliente VisionBLO ↔ partner de Odoo** (teléfonos). Sin esto no hay a quién escribir.
3. **Prueba de contacto manual**: botón que arma el mensaje y el link de WhatsApp (`wa.me`) para que lo envíe una persona. Valida el texto y el flujo sin riesgo.
4. **Bot oficial** con plantillas aprobadas (requiere cuenta de WhatsApp Business, proveedor y aprobación de Meta: es el paso lento).
5. **Pre-agenda** (agrupar por zona, proponer técnico, crear subtareas en Odoo).

## Decisiones pendientes
- Proveedor de WhatsApp (Cloud API directa de Meta o un proveedor) y número que se usaría.
- Quién aprueba los mensajes y los textos de las plantillas.
- Qué hacer con una unidad que no reporta pero cuyo vehículo está parado o dado de baja por el cliente.
- Si la visita la agenda un humano de coordinación a partir de las respuestas, o si el bot puede confirmar día y hora solo.
- Cómo se cruzan el cliente de VisionBLO y el partner de Odoo (por nombre, CUIT u otro dato).
- Posición de la unidad desactualizada: ¿se usa la última conocida o se le pregunta al cliente dónde está?
- Datos personales: dónde se guardan las conversaciones y por cuánto tiempo.
