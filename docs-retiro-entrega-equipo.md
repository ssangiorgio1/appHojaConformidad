# Retiro o entrega de equipo (5º tipo de servicio, evaluación)

Fecha: 2026-10-07. Estado: **API y PWA hechas (2026-10-08), sin panel; nada probado en pantalla ni commiteado**. Ver «Decisiones» y «Hecho» al final.

## Lo que se quiere

Cuando el cliente desinstala el equipo por su cuenta, hace falta un 5º tipo de servicio, **"retiro o entrega de equipo"**: WARA no interviene la unidad, así que **no lleva PRE, ni paso intermedio, ni POST**. Es un acta corta, como el PDF de visita fallida o de reprogramación, que se adjunta al ticket y queda con una tarea asignada.

Campos pedidos: si el cliente **lo entrega** o **lo deja para retirar**, y **firma** si es posible.

## Ticket de ejemplo (producción, solo lectura)

Ticket **#39522**, tarea **21815**, subtarea **21816**.

- **Título:** "Millán S.A.: RETIRAR GPS DE LA UNIDAD AD 880 CC + ADICIONALES". Cliente Millan S.A.
- **Qué pasó:** la unidad tuvo un siniestro y la aseguradora se la llevó. Sacaron el equipo sin avisar. **El equipo está en manos de una persona** (nombre y teléfono en el pedido), no en la unidad.
- **Adicionales:** el comentario interno dice "BP - RFID" y "faltaría el adicional RFID y BP". O sea, además del GPS hay accesorios que retirar o que faltan.
- **Cómo está armado en Odoo:** tarea "Servicio externo (WARA)" con etiqueta **"RETIRAR EQUIPO GPS"** (id 125), una subtarea con la patente (AD 880 CC), un técnico asignado, agendada el 2026-10-07 17:00 a 18:00. Etapa "Coordinado". La subtarea sigue en "Nuevo".
- **Sin orden de venta** vinculada.

## Diferencia con la desinstalación que ya existe

| | Desinstalación (hoy) | Retiro o entrega de equipo (nuevo) |
|---|---|---|
| Quién saca el equipo | El técnico, de la unidad | El cliente, o ya estaba sacado |
| Se interviene la unidad | Sí (PRE y POST, fotos, IMEI) | **No** |
| Qué se hace | Acta completa | Acta corta de recepción |

## Propuesta

**Flujo:** el técnico abre la tarea, elige el tipo "Retiro / entrega de equipo" y completa una sola pantalla. No pasa por PRE ni POST. Al terminar se genera el PDF y se adjunta al ticket (igual que la reprogramación), y la subtarea pasa a "Hecho".

**Campos:**
1. **Modalidad:** *El cliente lo entrega* (se lo da en mano al técnico) o *Lo deja para retirar* (queda en un lugar o con una persona).
2. **Equipo:** IMEI o número de equipo (con el escáner QR que ya existe) y estado a la vista (completo, dañado, sin carcasa).
3. **Adicionales:** lista con tilde de lo que se recibió (BP, RFID, varilla, cámara, etc.) y cuáles faltan. Importa por el caso del ticket.
4. **Quién entrega o dónde queda:** nombre y teléfono (en el ejemplo, la persona que lo tiene).
5. **Observaciones.**
6. **Firma** de quien entrega, opcional. Si no hay quien firme, leyenda "Sin persona para firmar" con el motivo, igual que "Cliente ausente".
7. **Foto del equipo** recibido (opcional, recomendada como respaldo).

**PDF:** "Acta de retiro / entrega de equipo", con la patente (subtarea), cliente, ticket, técnico, fecha y hora, modalidad, equipo, adicionales recibidos y faltantes, firma. Se adjunta al ticket con un resumen en el chat y la subtarea queda "Hecho".

**Reutiliza:** el envío de PDF al ticket (`pushReprogramacionToTicket`), el escáner QR, la cola sin señal y la firma. Es un modelo nuevo, más liviano que `Conformidad`.

## Cosas a resolver

- **Cómo se elige el tipo:** el técnico lo elige a mano (como los otros 4), o se sugiere por la etiqueta de Odoo ("RETIRAR EQUIPO GPS", id 125; también existen "RETIRO DE EQUIPOS" id 49, "ENTRGA EQUIPO" id 81 y "Entrega de equipo básico" id 8).
- **Dirección:** el pedido solo habla de que WARA **recibe** el equipo. Si también hay casos en que WARA **entrega** un equipo al cliente (sin instalarlo), cambia el acta: quién recibe y firma.
- **Stock:** si al recibir el equipo hay que darlo de baja o ingresarlo en la herramienta de stock.
- **Cuándo no se puede retirar:** si no aparece la persona o el equipo, es una visita fallida; hay que decidir si cae en el circuito existente.
- **Cobro:** si el retiro lleva producto en el catálogo.
- **Aviso al cliente:** el comentario del ticket es público y Odoo avisa por correo.

## Estimación

Un sprint corto: API (modelo, endpoint, PDF, envío al ticket, tests), PWA (pantalla única, escáner, firma, cola sin señal) y panel (ver el acta).

## Decisiones (2026-10-07)

1. **Dirección:** WARA siempre **recibe** el equipo (entrega en mano o lo deja para retirar). No se contempla que WARA entregue un equipo en este tipo.
2. **Cómo se elige el tipo:** la PWA lo **precarga** por **producto** de la orden de venta y, si no alcanza, por **etiqueta** de la tarea en Odoo. El técnico puede cambiarlo. El producto manda sobre la etiqueta.
3. **Stock:** por ahora el retiro **solo se asienta en el acta**. El pasaje a stock y la desinstalación en el backoffice se documentan abajo.

## Precarga del tipo de servicio

Regla (`api/src/services/tipoServicioSugerido.ts`), por unidad:

| Se ve en la orden de venta | Tipo sugerido |
|---|---|
| Producto de **retiro/entrega** (`tipo: 'retiro_entrega'` en `productoMapeo.ts`) | Retiro / entrega de equipo |
| Instala y retira a la vez | Cambio de equipo |
| Solo retira (`DES.*`) | Desinstalación |
| Solo instala (`INS.*`, `CM.*`, `MOD.*`) | Instalación |
| Sin productos | La etiqueta de la tarea, si es una de las listadas |

Cada tarea de la agenda ahora trae `etiquetaIds` y `tipoServicioSugerido` (y cada unidad del lote, el suyo, con `fuente: 'producto' | 'etiqueta'`).

**Importante sobre la etiqueta del ticket de ejemplo (#39522):** la etiqueta "RETIRAR EQUIPO GPS" (id 125) es la misma que se usa para **desinstalar de la unidad**, así que por etiqueta ese ticket se sugiere como **desinstalación**, no como retiro en mano. Además el ticket **no tiene orden de venta**, así que no hay producto que lo distinga. Para que se precargue bien hace falta una de estas dos cosas en Odoo:

- **Un producto propio** de retiro/entrega de equipo (código nuevo, por ejemplo con prefijo `DES.`; el `DES.092` que mencionaste no existe hoy en el catálogo). Se agrega a `productoMapeo.ts` con `tipo: 'retiro_entrega'` y listo.
- **Una etiqueta propia** (por ejemplo "RETIRO EN MANO") y se suma a `ETIQUETAS_TIPO_SERVICIO`.

Las etiquetas hoy cargadas en la tabla son las que se usan en la práctica y están **a confirmar con coordinación**: desinstalación (125, 49, 41), instalación (1, 56, 59, 52, 140), cambio de equipo (42, 102), reparación (2, 35, 48, 116). Quedaron afuera las ambiguas ("CAMBIO", "ENTRGA EQUIPO", "Entrega de equipo básico").

## Pasaje a stock y desinstalación al backoffice (a definir)

Hoy el retiro **no mueve stock**: queda en el acta (equipo, IMEI, estado, adicionales recibidos y faltantes, quién lo entregó). Cuando exista el backoffice de equipos (`Equipo` y `MovimientoStock`, `ALCANCE_BACKOFFICE.md` §8), el acta es la fuente del movimiento.

**Qué haría el acta al conectarse:**

| Situación del acta | Movimiento de stock | Estado del equipo |
|---|---|---|
| Entrega en mano con el equipo completo | `cliente_a_tecnico` (tipo nuevo; hoy §8 solo tiene `deposito_a_tecnico`, `tecnico_a_cliente`, `tecnico_a_deposito`, `baja`) | `asignado_tecnico`, queda en el stock de quien lo recibió |
| Después, al llevarlo al depósito | `tecnico_a_deposito` | `en_deposito` |
| Dejado para retirar | Ninguno todavía: queda pendiente de retiro. Cuando alguien lo retira, se registra como la entrega en mano | Sigue `instalado` (o el estado que tenga) hasta que se retire |
| Equipo dañado o incompleto | Igual que arriba, con estado `en_reparacion` o `baja` según lo que decida depósito | `en_reparacion` o `baja` |
| Adicionales faltantes (como RFID y BP en el ticket) | No hay movimiento; se registran como faltantes para que comercial decida si se cobran | — |

**Desinstalación en el backoffice:** el acta cierra la relación equipo-cliente: `clienteId` pasa a nulo y se anota la baja del servicio para que no siga facturando abono. La baja de abono es una decisión comercial, no automática: el acta avisa, y quien administra el cliente da de baja el abono (`ABN.*`).

**Para que esto sea posible el acta ya guarda:** número de equipo, IMEI, estado, adicionales (recibido/faltante), quién entrega o dónde queda, técnico, fecha y hora, ticket y subtarea (`api/src/models/RetiroEquipo.ts`).

**Preguntas para cuando se diseñe:**
1. ¿El IMEI del acta tiene que existir ya en `Equipo`? Si el técnico lo tipea mal o el equipo no está cargado, ¿se rechaza o queda "equipo sin identificar" para revisar?
2. ¿Quién confirma el ingreso al depósito (el técnico al entregarlo o depósito al recibirlo)? Conviene que sea depósito, para que el stock del técnico no quede inflado.
3. ¿Qué hace el retiro con el `abono` del cliente? Hoy es manual.
4. ¿Hay que sincronizar con VisionBLO para sacar el equipo de la flota del cliente?

## Hecho (API, 2026-10-08)

- **Modelo:** `RetiroEquipo` (acta). Modalidad `entrega` o `deja_para_retirar`; equipo; adicionales recibidos y faltantes; quién entrega y dónde queda; observaciones; firma opcional con motivo si no hay quien firme. Enviar sin señal es idempotente (`clientId`).
- **Endpoints:** `POST /api/retiros-equipo` (técnico), `GET /api/retiros-equipo` y `GET /api/retiros-equipo/:id/pdf` (técnico lo suyo; coordinación, mesa de ayuda y admin todo).
- **Al crear el acta:** genera el PDF «Acta de retiro / entrega de equipo», lo adjunta al ticket con la cuenta del técnico (o la de servicio si no vinculó la suya) y deja la subtarea en «Hecho» (y la tarea, si era la última unidad). Si Odoo falla, el acta se guarda igual y el error queda anotado.
- **Reglas:** si «deja para retirar», hace falta decir dónde o con quién queda. Sin firma hace falta el motivo. La firma solo puede apuntar al bucket de R2.
- **Precarga del tipo** por producto y etiqueta (ver arriba).
- **Tests:** 62 en total, con casos nuevos del PDF y de la precarga.

## Falta

- **PWA:** pantalla única para este tipo (sin PRE/POST), con escáner QR, firma y cola sin señal, y la precarga del tipo en la agenda.
- **Panel:** listado de actas con «Ver PDF».
- **Odoo:** crear el producto o la etiqueta que distinga el retiro en mano, y confirmar la tabla de etiquetas.
- Probar contra el Odoo de pruebas y ver el PDF renderizado con firma.
- Foto del equipo recibido (segunda etapa, igual que en la constancia de visita fallida).

## Hecho (PWA, 2026-10-08, sin probar en pantalla)

Repo `C:\dev\wara-conformidad-pwa`, sin commitear.

- **Formulario único** (`RetiroEquipoForm.tsx`): modalidad (lo entrega / lo deja para retirar), escáner QR del equipo, número e IMEI, estado (completo, incompleto, dañado), adicionales con chips (botón de pánico, RFID, varilla, cámara, pantalla, cargador y «otro»: un toque = recibido, otro toque = falta), quién entrega, teléfono, dónde queda (solo si lo deja para retirar), observaciones y firma (o «no hay quien firme» con motivo). El botón «Guardar acta» queda deshabilitado con el motivo a la vista hasta completar lo obligatorio.
- **Dónde aparece:** en la ficha de la agenda, tanto en un lote (por unidad) como en una tarea suelta.
  - Si la API sugiere `retiro_entrega` (por producto o etiqueta), «Llegué» y «Empezar» abren el acta en vez del PRE, y el botón de la unidad dice «Registrar retiro».
  - Si no la sugiere, hay un enlace manual «Es un retiro / entrega de equipo» junto a «No está en el lugar». Hace falta porque con el ticket #39522 la etiqueta sugiere desinstalación.
- **Sin señal:** si falla el envío, el acta queda en el dispositivo (IndexedDB, versión 8) y se reenvía sola, igual que las incidencias. La firma se sube a R2 recién al enviar. Es idempotente (`clientId`).
- **Después de guardar:** la unidad queda como «Retiro registrado» y cuenta como resuelta para habilitar «Finalizar visita». La API cierra la tarea y, si era la última unidad, la visita.
- **También en esta tanda:** la agenda ahora manda `horaAgendada` al reportar «no está en el lugar», que es lo que permite sugerir visita fallida o llegada tarde (`docs-visita-fallida-pdf.md`).
- **Tests:** 15 casos nuevos de las reglas del formulario (`retiroEquipo.test.ts`); 77 en total en la PWA.

**Cuidado al probar:** la API de Render ya apunta al Odoo real. Para probar sin riesgo hay que usar la API local contra staging (`.env` de `C:\hpi` apuntando a staging, que hoy es así) y la PWA local contra esa API. El ticket #39522 no existe en staging: hay scripts para crear una tarea de prueba (`api/scripts/createTestSimpleTask.ts`, `createTestLoteTask.ts`).
