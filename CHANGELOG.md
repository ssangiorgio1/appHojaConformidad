# Novedades de la app y del panel

Resumen de los cambios recientes, escrito para técnicos y para Operaciones. Lo más nuevo está arriba.

- **App** = la aplicación que usan los técnicos en el celular.
- **Panel** = la pantalla web de Operaciones y coordinación.

Para agregar una novedad: sumar una sección nueva arriba, con la fecha en que se publicó, y contar qué cambió y qué tiene que hacer cada persona (si hay que hacer algo).

---

## 16 de octubre

### Firma con DNI y cargo
- **App:** al firmar, se piden también el **DNI** y el **cargo** de quien firma, en los mismos casos en que ya se pedía el nombre.
- **Panel:** el DNI y el cargo se guardan con la hoja.

### Motivo cuando el control del vehículo dice NO
- **App:** en la revisión general del vehículo, si los puntos 1 a 5 se responden **NO**, hay que escribir un detalle.
- **Panel:** ese detalle lo ve la empresa. **No sale en el PDF que recibe el cliente.**

### Los servicios sin enviar salen solos
- **App:** si un PRE o un POST quedó sin enviar por falta de señal, ahora se envía **solo, en segundo plano**, desde cualquier pantalla, en cuanto vuelve la señal. Ya no hace falta volver a la lista para que salga. La hoja que se está completando no se toca.
- **Panel:** los servicios llegan sin esperar a que el técnico abra la lista.

### La unidad en la que se está trabajando se ve marcada
- **App:** en la agenda, la unidad en curso muestra la etiqueta **"Trabajando en esta unidad"**.

### PDF más ordenado
- **Para todos:** el PDF de la hoja de conformidad ya no muestra filas vacías ni casillas sin tildar. Solo aparece lo que se completó.

---

## 13 de octubre

### Cambio de unidad: ahora con tres opciones
Al elegir "Cambio de unidad" en el PRE hay que indicar qué se hace:
- **Unidad de ORIGEN:** se desinstala el equipo, que vuelve siempre al laboratorio.
- **Unidad de DESTINO:** se instala un equipo **nuevo** en la unidad a la que se cambia.
- **CAMBIO completo (nuevo):** una **sola hoja** para retirar el equipo anterior e instalar el nuevo en la misma unidad.

Origen y destino son dos hojas, una por unidad. Pueden hacerlas técnicos distintos y en días distintos. Si las dos unidades cuelgan de la misma tarea en Odoo, las hojas se vinculan solas.

### Más cambios para los técnicos
- **App:** en el cambio de equipo, los precintos y los ramales se cargan junto con el equipo nuevo, y la foto de la ubicación va junto al control.
- **App:** en una intervención, el N° de equipo y el IMEI se traen solos a partir de la patente.
- **App:** el PRE tiene un campo de **observaciones internas**.
- **App:** si un servicio quedó guardado en un paso que ya no existe, el POST abre igual y no se rompe.
- **Panel:** se ven las observaciones internas del PRE. Estas **no salen en el PDF del cliente**.
- **Panel:** los videos se muestran con la etiqueta "Video", no "Foto".

---

## 10 de octubre

### El envío a Odoo no se duplica
- **Para todos:** cada PDF (PRE y hoja completa) se adjunta **una sola vez** al ticket de Odoo. Si el envío tarda o se corta, el sistema verifica en el ticket antes de volver a mandarlo. Esto evita los mensajes repetidos.
- **App:** se quitó el botón "Reintentar": el reenvío es automático.

### Retiro y entrega de equipo
- **App:** el formulario pregunta primero si es **retiro** o **entrega**, y después si es un equipo o un sensor o módulo.
- **Panel / Odoo:** el acta se titula "retiro" o "entrega" según corresponda y admite varios equipos y fotos.

---

## 8 de octubre

### Visita fallida o llegada tarde
- **Para Operaciones:** el sistema distingue dos situaciones y manda un PDF distinto al ticket de Odoo en cada una:
  - **Visita fallida:** el técnico llegó a horario y la unidad no estaba. Genera una constancia.
  - **Llegada tarde del técnico:** llegó pasados **15 minutos** de la hora agendada. Genera una reprogramación por demora.
- Coordinación puede corregir el tipo antes de que salga el PDF.

### Retiro / entrega de equipo (quinto tipo de servicio)
- **App:** cuando el cliente desinstala el equipo y el técnico lo recibe, se completa un **acta corta**, sin PRE ni POST: modalidad, equipo, adicionales recibidos, quién entrega y firma (opcional). Se adjunta al ticket y cierra la tarea. Funciona sin señal.
- Se elige desde el tipo de servicio del PRE o desde la ficha de la agenda.

### Fotos en el celular
- **App:** las fotos tomadas con el celular acostado ya **no salen giradas** en Android.

### Dos técnicos en la misma tarea
- **App:** si el compañero ya salió o ya llegó a la unidad, no se puede abrir un viaje propio para esa tarea, y la app lo avisa con el nombre del compañero. Si el compañero ya está en el lugar, la ficha pasa a "en el lugar" y se puede trabajar sin registrar un viaje propio.

**A tener en cuenta:** el retiro / entrega, las fotos giradas y la tarea compartida salieron sin una prueba completa en pantalla. Si algo no anda como se describe acá, avisar.

---

## 7 de octubre

### El técnico propone reprogramar
- **App:** en "No está en el lugar / reprogramar" hay una opción **"Cancelo el PRE"** (el borrador queda guardado) y se puede proponer **nueva fecha y hora**, aplicándolo también a otras unidades del lote.
- **Panel:** coordinación ve las propuestas en una pestaña y puede **aceptar** (con o sin cambio de hora) o **rechazar** con motivo. El técnico ve el rechazo en su agenda. Al aceptar, sale un PDF de reprogramación por unidad, adjunto al ticket.

### Más datos en la ficha de la tarea
- **App:** se ve la **ubicación de la unidad** con un enlace a Google Maps, y el **teléfono del cliente**.
- **App:** los teléfonos escritos en las notas de mesa de ayuda o coordinación se pueden **tocar para llamar**.
- **App:** en "Módulos y sensores", los productos de la orden vienen tildados solos. Si no se pudo instalar alguno hay que marcar **"No se pudo instalar"** y elegir el motivo. Ese motivo aparece en el comentario del ticket.

### Número de equipo desde el QR
- **Panel:** en Atilio se puede escanear el QR del equipo para obtener su número, y el estado del equipo muestra satélites y calidad de la señal GPS.
- **App:** el QR se lee con solo el IMEI.

---

## 6 de octubre

### Más rápida con los PDF y el mapa
- **Para todos:** los PDF se generan más rápido y de forma más estable, y el mapa de flota carga mejor.

### Chequeo de GPS
- **App:** el chequeo del equipo ya no dice "sin posición" cuando sí hay una posición reciente.

### Detalles
- **App:** el banner del trabajo en curso abre la unidad correcta. "No está en el lugar" también funciona con el PRE empezado.
- **Panel:** el calendario se puede editar desde el reporte de cada técnico, y las tareas reprogramadas llevan una etiqueta.

---

## 5 de octubre

### Verificación del equipo
- **App:** si el técnico avanza con el equipo sin haberlo confirmado, queda registrado (estado, problemas, hora) como avance **bajo responsabilidad**.
- **Panel:** se ve un aviso en el detalle de la hoja y hay un filtro "Verificación del equipo" en el listado.

### PDF del PRE al ticket
- **Para todos:** al terminar el PRE, se adjunta al ticket un PDF **solo con el PRE**. La firma del PRE queda en la segunda hoja.

### Sin señal
- **App:** "No está en el lugar" funciona sin conexión y se reenvía solo. También funciona en tareas sin subtareas. La pantalla de inicio (splash) aparece solo al abrir la app.

### Panel en el celular
- **Panel:** se puede usar en el celular, con barra inferior y tarjetas, y se puede **instalar como app**.

---

## En preparación (todavía no disponible)

- **Pantalla de Tickets (panel):** ver un ticket con sus tareas y unidades, y agendar la unidad de destino de un cambio de unidad sin entrar a Odoo. Hoy es una maqueta.
- **Pantalla de Facturación (panel):** productos de Odoo por unidad, cargos extra y PDF de detalle. Hoy es una maqueta.
