# Chimichanga: índice de pendientes y temas en curso

Este archivo lo lee la skill `chimichanga` (`~/.claude/skills/chimichanga/SKILL.md`). Para anotar algo nuevo, agregarlo en "Temas abiertos" con una línea de estado y el enlace a su documento. Cuando un tema se cierra, pasarlo a "Cerrado".

Última actualización: 2026-10-14 (tema 16, envío único y reintentos).

## Temas abiertos

### 1. Mapeo de productos de Odoo en la PWA (en curso)
- **Documentos:** `docs-mapeo-productos-pwa.md` (mapeo y reglas), `docs-pendientes-productos-pwa.md` (lo hecho y lo que sigue).
- **Hecho:** la API trae productos y lo esperado por unidad; la PWA muestra la tarjeta "A instalar", tilda solo las casillas de la orden, bloquea las demás y retira lo tildado solo si el producto se saca de Odoo. Foto del equipo a colocar obligatoria en su paso. Teléfono del cliente en la ficha.
- **Sigue:** paso 3 (instalado o "no instalado" con motivo antes del POST) y paso 4 (botón "Actualizar productos" en la tarjeta, con un endpoint chico en la API).
- **Pendiente de decidir:** 5 preguntas del mapeo (`INS.ANT`, `INS.503`, `DES.108`, `AVL001`/`AVL002`, `INS.010`) y casillas nuevas para los 19 productos sin casilla.

### 2. PDF de visita fallida y de cliente ausente (para mañana)
- **Documento:** `docs-visita-fallida-pdf.md`.
- **Hoy:** la visita fallida no genera PDF. El cliente ausente con trabajo hecho sí sale en el PDF normal.
- **Propuesta:** "Constancia de visita" generada por la API al crear la incidencia, adjunta al ticket de Odoo.
- **Tipos de motivo (definidos 2026-10-07):** cliente ausente y sin unidades, unidades no estaban, nadie para autorizar, otro.
- **Decisiones:** GPS y foto (obligatorios o no), si le llega al cliente por correo, texto de Telegram, y si se sugiere `VIS.003`.

### 3. POST pendiente cuando la unidad se retira antes del POST
- **Documento:** `docs-post-pendiente.md`. Solo evaluado.
- **Idea:** pausar el POST sin que corra el tiempo de instalación ni de permanencia, y retomarlo en otra visita.
- **Decisiones:** mínimo primero o flujo completo, tiempo pausado en reportes, mensaje al cliente, si lo retoma el mismo técnico.

### 4. BO4 como CRM y cotización hacia Odoo
- **Documento:** `docs-bo4-odoo-cotizacion.md`. Probado en el staging de Odoo.
- **Plan:** sprints 0 a 4 (cotización desde BO4, seguimiento, unidades, pantalla de planificación).
- **Decisiones:** puerta de entrada a Odoo (nuestra API o BO4), qué pasa con los 652 leads del CRM de Odoo, quién explica el módulo propio de intervención.

### 6. Cancelar el PRE y proponer reprogramación (nuevo, 2026-10-07)
- **Documento:** `docs-cancelar-pre-reprogramar.md`. Solo evaluado.
- **Idea:** el técnico cancela el PRE empezado y envía una propuesta de día y hora para su tarea o unidades; coordinación acepta o rechaza.
- **Propuesta:** reutilizar `SubtareaIncidencia` (tipo `pre_cancelado`, fecha propuesta, estados `propuesta_pendiente` y `rechazada`) y el `PATCH` de reprogramar que ya existe.
- **Decidido:** PRE con datos queda de borrador, la unidad queda "En espera", coordinación puede cambiar la hora al aceptar, todo va por Odoo con un PDF nuevo ("el cliente pidió reprogramación para X"), y se genera constancia de visita.
- **También decidido:** se admite propuesta por tarea o por unidad; el aviso al cliente lo hace el técnico o coordinación; el PDF nuevo se adjunta al mismo ticket.
- **Implementado 2026-10-07 (API, PWA y panel), sin commit y sin probar de punta a punta:** el PDF es uno por subtarea; el técnico ve el rechazo en la ficha de la agenda. Falta probar contra el Odoo de pruebas (localhost), ver el PDF renderizado y commitear de forma selectiva.

### 7. Motivo cuando no se instala o desinstala un módulo o sensor (nuevo, 2026-10-07)
- **Caso:** el producto está en la orden de venta, así que se tilda solo y se bloquea, pero en el lugar no se puede instalar (por ejemplo, hay que agujerear y el cliente no quiere). El técnico tiene que poder destildarlo y poner el motivo; después se da de baja el producto de la orden. Vale también para desinstalaciones.
- **Relación:** es el paso 3 del tema 1 ("no instalado" con motivo). Detalle en `docs-pendientes-productos-pwa.md`. Hacerlos juntos.
- **Implementado 2026-10-07 solo para instalación (PWA y API), sin commit ni prueba en pantalla:** en "Módulos y sensores" cada casilla que pide la orden tiene "No se pudo instalar en el lugar"; el técnico elige un motivo de una lista (cliente no autorizó, hay que perforar, falta material, sin acceso) o lo escribe, la casilla se destilda y no vuelve a tildarse sola. El motivo se guarda en la hoja (`noInstalados`), viaja a la API y sale en el comentario del ticket de Odoo ("No se instaló / no se retiró (dar de baja de la orden)"). Quien da de baja el producto es coordinación o comercial, a mano en Odoo.
- **Falta:** lo mismo para **desinstalación** (elementos retirados que la orden pedía y no se sacaron), mostrarlo en el PDF y en el panel, y confirmar si la lista de motivos es la correcta.

### 8b. Resultado del tema 8 (2026-10-07)
- **Hecho (API y PWA, sin commit):** el campo de Odoo es `x_studio_ubicacin_de_la_unidad` (en la subtarea, tipo texto). La API lo trae con cada unidad y la PWA lo muestra en la ficha de la tarea (resumen de la unidad, selector de unidades y tarea suelta) y en "Info del trabajo" (los 4 puntitos).

### 10. Teléfonos en las notas de mesa de ayuda y coordinación (2026-10-07)
- **Hecho (PWA, sin commit):** si una nota trae un número de teléfono (formatos argentinos, con o sin +54, espacios o guiones), se muestra como link para llamar, en la ficha de la tarea y en "Info del trabajo". Uso: cuando el teléfono de Odoo no atiende, coordinación o mesa dejan otro número en una nota de la tarea o del ticket y el técnico lo toca para llamar.
- **No toma como teléfono:** fechas, IMEI, patentes, números de ticket ni números de menos de 8 dígitos. Un teléfono pegado a otro sin separador raro puede no detectarse.

### 9. Reprogramar la visita ANTES de "Salir hacia destino" (consulta, 2026-10-07)
- Hoy el botón "No está en el lugar / reprogramar" solo aparece cuando el técnico ya salió o llegó. Antes de salir no hay forma.
- Se puede, pero hay una decisión: el reporte actual pasa la unidad a la etapa "Visita fallida" de Odoo, y eso no corresponde si el cliente avisó antes y el técnico nunca salió (además se podría cobrar `VIS.003`). Habría que agregar un tipo propio ("reprogramación previa"), que deje la unidad "En espera" sin la etapa "Visita fallida" y sin cobro.

### 8. Mostrar la "ubicación de la unidad" (nuevo, 2026-10-07)
- **Idea:** traer el campo "ubicación de la unidad" y mostrarlo en la ficha de la tarea y en la info del trabajo (menú de los 4 puntitos, `TrabajoInfoMenu.tsx`).
- **Dónde está:** en la subtarea de Odoo, el campo "ubicación de la unidad" (`x_studio_ubicacin_de_la_unidad`). Implementado, ver 8b.

### 5. Brechas sueltas detectadas
- **Hallazgo grave (2026-10-07):** el paquete compartido de la API (`packages/shared`) quedó MUY por detrás de la copia de la PWA (`src/shared`): `printHtml.ts` difiere en unas 216 líneas, y el PDF que la API genera y adjunta a Odoo no tiene nada de lo que se sumó solo en la PWA (motivo de la intervención, razón del cambio de equipo, etc.). Hay que sincronizar las dos copias (con cuidado: los cambios de la PWA no están commiteados ni probados del lado API).
- **Motivos descartados por la API:** la PWA envía `motivoIntervencion` (cambio de equipo, reinicio manual, revisar ramales, otro), `cambioEquipoRazon` (pantalla dañada u otro), sus detalles y `cambioEquipoTemporal`. El esquema y el modelo `Conformidad` de la API no tienen esos campos, así que no se guardan: el PDF del teléfono los muestra, pero el panel no, y al bajar la hoja (`pull.ts`) vuelven vacíos. Arreglo: agregarlos al esquema, al modelo, a los tipos compartidos y al panel.
- **Teléfono en "Cliente ausente":** mostrarlo, tocable para llamar, en esa pantalla del PRE y del POST.
- **Modo "sin IMEI" automático:** activarlo solo cuando la orden trae únicamente sensores o módulos. Depende del mapeo del tema 1.
- **Tipos de BO3** (`docs-bo3-adicionales.md`): falta confirmar `PRE` (probable CANbus, 68 filas). Sin eso no se arma el diccionario equipo/módulo/sensor en la API.

## Cuidados permanentes
- **Odoo:** el 2026-10-06 la API de Render pasa a Odoo real. El staging se borra el 2026-10-25. Antes de escribir en Odoo, mirar qué bloque del `.env` está activo.
- **Despliegue:** la API se pushea y despliega antes que la PWA.
- **Commits:** hay trabajo ajeno mezclado en varios archivos (PWA y API). Commitear de forma selectiva, sin subir lo que no se revisó.
- **IP de la API en la PWA (`.env.local`):** `NEXT_PUBLIC_API_URL` apunta a la IP local del trabajo (`http://192.168.100.232:4000`). Desde otra red (casa) la API no responde y la app se ve "sin conexión", con banner o "En curso" pegado, agenda guardada y envíos que no salen (2026-10-10, parecía un bug de la tarea 21044 y era esto). Antes de depurar comportamientos raros de la PWA, mirar primero esa IP y reiniciar el dev server al cambiarla (se compila en el build). Para probar contra producción, usar la URL de Render.

## Cerrado
- Tiempos de viaje offline, agenda sin carreras, cola de incidencias, banner que abre la unidad correcta.
- Verificación del equipo (registro "bajo responsabilidad", 3 intentos), PDF solo-PRE al ticket, caché de PDFs, panel responsive e instalable como app.

### 11. PDF con marca de agua y guardados en el panel (plan, 2026-10-08)
- **Estado:** solo planeado, sin tocar código ni base de datos.
- **Hoy:** el acta de retiro/entrega ya tiene `GET /api/retiros-equipo` y `/:id/pdf` en la API, pero el panel no tiene pantalla. Los PDF de reprogramación y de constancia de visita fallida solo se generan al mandarlos a Odoo (no hay endpoint para volver a verlos). Ningún PDF tiene marca de agua.
- **Plan:** (1) marca de agua en CSS dentro del render común (`renderPdfBuffer`), así sale igual en Odoo y en el panel; (2) no guardar archivos: regenerar a pedido con los datos que ya están (sin campos nuevos); (3) endpoint `GET /api/subtareas/incidencias/:id/pdf`; (4) pantalla "Retiros / entregas" en el panel (lista, filtros, "Ver PDF") y botón "Ver PDF" en `incidencias`; (5) tests de la marca.
- **Decisiones:** texto de la marca; si va también en los PDF que ven los clientes en Odoo; si se incluyen reprogramación y constancia o solo el acta; si alcanza con regenerar o se quiere copia guardada (eso sí tocaría la base).

### 12. Evitar que dos técnicos hagan la misma unidad (duplicidad, consulta 2026-10-08)
- **Estado:** solo consultado, sin tocar código.
- **Hueco hoy:** en una tarea con 2 técnicos y varias unidades, no hay bloqueo. La PRE/POST que empieza el técnico A queda en su celular y el servidor solo le muestra a cada técnico sus propias hojas (`tecnicoId`). El técnico B ve la unidad como disponible hasta que A termina y Odoo la pasa a "Hecho"; mientras, B puede abrirla y se guardan dos hojas (no hay restricción de unicidad por unidad).
- **Propuesta:** (1) reservar la unidad en el servidor al empezar la PRE (tarea + subtarea + fecha) y rechazar con 409 al segundo técnico; (2) en la PWA del otro técnico, la unidad sale bloqueada con "La está haciendo [nombre]"; (3) liberarla al terminar o cancelar la PRE, y con una regla de vencimiento (fin del día) o liberación por coordinación; (4) traspaso explícito con botón "Tomar esta unidad" que le avise a A (hoy existe que otro termine un `pendiente_post`).
- **Decisión:** la reserva (punto 1) toca la base con un dato nuevo; alternativa sin dato nuevo: consultar las hojas abiertas de esa unidad al entrar (menos segura si entran casi a la vez).

### 13. Inventario de depósito y técnicos en BO4 (plan, 2026-10-09)
- **Documento:** `docs-inventario-tecnico.md`. Solo plan, sin código.
- **Idea:** árbol de productos con el stock del depósito y el inventario de cada técnico. Equipos con serie/IMEI uno por uno; sensores, módulos, botones y ramales por cantidad. Las instalaciones consumen del inventario del técnico según una receta que mapea el producto de Odoo; el técnico se reabastece con transferencias desde el depósito.
- **Decidido:** BO4 es el dueño del stock (Odoo solo productos y facturación); un solo depósito por ahora, modelo preparado para más; el técnico no puede instalar sin tener el producto (sin saldo negativo); muchos equipos vuelven al stock (pasan por revisión); ramales por cantidad y cables no se modelan.
- **Dos capas:** el comprobante (remito, recibo, acta) genera el movimiento de stock. El remito/recibo de BO3 hoy no toca stock, así que los saldos iniciales salen de un conteo físico.
- **Pendiente de decidir:** cómo es el remito/recibo de BO3 (falta captura o endpoint), quién aprueba ajustes, quién revisa los equipos devueltos, si se carga lo ya instalado en campo, y revisar `ALCANCE_BACKOFFICE.md` §8 para no duplicar `MovimientoStock`. Se relaciona con el pasaje a stock del acta de retiro (`docs-retiro-entrega-equipo.md`) y con la confirmación de `PRE` del tema 5.

### 14. Varios elementos en una intervención, p. ej. 10 cámaras ADAS (evaluado, 2026-10-13)
- **Estado:** solo evaluado, sin tocar código. **Falta saber el caso:** ¿las 10 cámaras van en una misma unidad, o una por vehículo en 10 vehículos?
- **Hoy:** una conformidad = una unidad (patente). "Cámaras ADAS" es una casilla con un solo campo de serie (`camarasAdasSerie`); no tiene cantidad. Otros elementos (temperatura, puertas, varilla) tienen cantidad pero sin series. Los lotes de Odoo ya dan una conformidad por unidad.
- **Caso A (10 en una unidad):** cantidad más lista de series con "+ Agregar cámara", foto por cámara, la comparación con VisionBLO pasa a esperar la cantidad, y PDF, panel y comentario de Odoo muestran "Cámaras ADAS: 10" con las series (se guarda como texto, sin migrar). Opción más amplia: en intervención, una lista "Elementos intervenidos" (tipo, serie, qué se hizo).
- **Caso B (1 por vehículo, 10 vehículos):** ya funciona como lote. Mejoras: "Repetir con los mismos elementos" (copia de la unidad anterior) y una sola firma para todo el lote si el cliente es el mismo.
- **Una conformidad para varias unidades:** no recomendado (rompe historial por matrícula, ticket y subtarea de Odoo). Solo tendría sentido para trabajos masivos idénticos.
- **Recomendación:** empezar por el caso A (cantidad y lista de series, útil también para pantallas y Starlink); después firma única de lote y copia entre unidades.

### 15. Video opcional, varias cámaras ADAS / DSM / MDVR y "requiere otra intervención" (hecho sin probar en pantalla, 2026-10-14)
- **Video opcional:** tarjeta "Video del servicio (opcional)" en el primer paso del POST de los 4 tipos (hasta 5 s, sin audio, se sube a R2, el PDF solo marca que hay video, se ve en el panel).
- **Cámaras:** ADAS ahora admite varias series (una por fila con "+ Agregar cámara", la cantidad es la cantidad de series; la comparación con VisionBLO espera esa cantidad). Casillas nuevas: Cámara DSM (añadido de la ADAS, sin serie propia) y MDVR (con canales 4 u 8 y serie). PDF, panel y comentario del ticket las muestran con comas.
- **Requiere otra intervención (solo intervención):** casilla con motivo obligatorio en el paso "Intervención realizada". Al cerrar la hoja la API crea una subtarea nueva en la misma tarea (mismo ticket, sin técnico ni fecha), deja una incidencia `requiere_otro_tecnico` en el panel de incidencias, agenda una actividad en Odoo a los destinatarios y agrega el aviso al comentario del ticket. La visita original queda "Hecho"; el ticket queda abierto por la subtarea nueva. Código: `api/src/services/derivacion.service.ts`, `createDerivedSubtask` en `calendarTask.service.ts`.
- **Falta:** probarlo contra staging (la API de Render escribe en Odoo real), ver cómo queda el panel de incidencias para este tipo, confirmar si la DSM también cuenta como módulo "cámara" en VisionBLO (hoy la comparación solo espera las ADAS) y si el mapeo de productos debe tildar DSM/MDVR. Agrega un campo en la base compartida: no desplegar con técnicos trabajando sin avisar.
- **Aparte:** los 2 tests de `odoo.service.test.ts` que fallaban ya se actualizaron (ver tema 16).

### 16. PRE duplicados al ticket #39509 (caso Renzo Gonzalez, 2026-10-13; arreglos hechos sin commit ni deploy)
- **Qué pasó:** dos hojas del mismo PRE de la unidad JQE994 (tarea 21959) creadas con 11 s de diferencia (doble toque con mala señal). Cada envío a Odoo daba timeout a los 60 s aunque Odoo igual publicaba, la API lo marcaba FAILED y la PWA reintentaba: **7 mensajes y 7 PDF** en 45 min, con correo a 10 seguidores cada vez, **cliente incluido** (vial.lavalle@gmail.com).
- **Hecho en la PWA:** bloqueo de botones de inicio con spinner ("Abriendo…"), no crear si ya hay hoja en curso, todas las entradas abren la misma hoja (`elegirHojaPrincipal`), y recarga automática de la app al desplegar una versión nueva (`ActualizadorPWA`, solo fuera de las hojas).
- **Hecho en la API:** `pushConformidadToTicket` verifica si el PDF ya está publicado antes de postear y, si hay timeout, vuelve a consultar el ticket antes de dar el envío por fallido (con tests). Producción parece haber corrido una versión sin el chequeo anterior (commit del 10/10): **confirmar el deploy en Render**.
- **Pendiente:** decidir qué hoja se descarta (A `6ace3a20…ec84d` o B `6ace3c31…ec84e`, ambas en POST pendiente); limpiar los 6 mensajes repetidos del ticket (lo hace el usuario); decidir si el PRE debe publicarse como nota interna para no mandar correo al cliente (por ahora se deja como está); freno en el servidor para dos hojas de la misma unidad y día (descartado por ahora).
- **Envío forzado de BGJ01 (2026-10-14):** la hoja `CONF-20261013-06039D55` (_id `6ace5016…ec84f`, ticket 39509) quedó FAILED por timeout. Se dejó el script `api/scripts/forzarEnvioTicket39509.ts` (dry-run por defecto; `--apply` publica en Odoo PRODUCCIÓN con las credenciales comentadas de `.env` y marca `odooSync` SYNCED). Lo corre el usuario; **confirmar que se ejecutó** y borrar el script si ya no hace falta. Las fotos pre/post se bajaron a `Downloads\BGJ01_pre_post`.
- **Test del envío único (2026-10-14):** los 86 tests de la API pasan; los 5 de `odoo.service.test.ts` cubren no duplicar y el timeout. **Sin test:** el flujo completo de `syncConformidadToOdoo` (candado en memoria, guard SYNCED, PRE y completo independientes, carrera de 2 requests).
- **Si falla un envío:** queda `odooSync`/`preOdooSync` = FAILED con `lastError`; se reintenta solo (home de la PWA) o con el botón "Reintentar" de la hoja; solo SYNCED queda bloqueado. **Brechas:** el auto-reintento no tiene enfriamiento (`odooRetryDue` siempre true si no es SYNCED, martilla Odoo si está caído); no hay reenvío desde el panel web; el candado es solo en memoria (no sirve con 2 instancias o reinicio).
- **Decisiones pendientes:** agregar enfriamiento al auto-reintento, botón de reenvío en el panel y tests del controller/carrera.

