# Equipos que no son vehículos (sin patente, torpedo ni odómetro)

Fecha: 2026-10-20. Estado: **implementado con elección manual del técnico**; falta la fuente automática desde Odoo y definir datos y fotos por tipo de equipo.

## Problema
Además de vehículos se instalan o intervienen otros equipos: surtidores, generadores de electricidad, depiladoras (literalmente) y otros. Esos equipos no tienen patente, tablero (torpedo) ni odómetro, pero la hoja pedía todo eso como obligatorio.

## Qué se hizo (elección manual)
- **Campo nuevo `tipoUnidad`** en la hoja: `vehiculo` (por defecto, y lo que asumen las hojas viejas) u `otro_equipo`. Viaja en el alta y en el PATCH, se guarda en Mongo (`Conformidad.tipoUnidad`) y vuelve en el pull.
- **PRE (PWA)**: selector "¿Qué se interviene? Vehículo / Otro equipo" en el primer paso. Con "Otro equipo" el campo "Patente" pasa a "Equipo" (nombre o código, se guarda en `matricula`).
- **Fotos PRE de otro equipo**: no se piden matrícula, laterales, frente, interior, torpedo ni odómetro. Se pide **una sola foto obligatoria (multi): `lugar_instalacion`** ("Lugar donde se va a instalar el equipo" en instalación; "Equipo a intervenir (vista general)" en intervención). En una intervención se conserva además "Estado del equipo antes de intervenir".
- **POST**: se sacan los slots de torpedo y odómetro; no se pide odómetro/horómetro en el control (ni se valida); no se ofrece "Equipo actual" (ese prellenado cruza por patente). Una intervención sin cambio de equipo queda sin fotos obligatorias en el cierre; lo hecho queda en la galería de "Intervención realizada".
- **Revisión general (paso 2 del PRE y paso 2 del POST)**: con "Otro equipo" no se piden luces de posición, guiñe, tablero, paragolpes ni tapizados. El paso pasa a llamarse "Revisión general del equipo" y trae, en el PRE y en el POST, los mismos cinco ítems (SÍ/NO, con detalle cuando corresponde):
  1. Autorización por parte de un responsable para la revisión del dispositivo.
  2. Equipo detenido y en condiciones seguras para intervenir (sin riesgo eléctrico ni de combustible). *Propuesta.*
  3. Estado general del dispositivo.
  4. Cableado y conexiones existentes sin daños visibles. *Propuesta.*
  5. Notificar sobre alguna falla (luces de algún tipo, alarmas, etc.). Es interno: no va en el PDF del cliente, igual que la luz de falla del vehículo.
- **PDF y panel**: el PDF dice "Equipo" en vez de "Matrícula" y usa los slots correctos; el panel resuelve la etiqueta de `lugar_instalacion`.
- Código: `photoSlotsFor(mode, …, tipoUnidad)` en las dos copias de `@wara/shared` (PWA y `C:\h\packages\shared`; la del monorepo es una versión más vieja y se parchó solo en lo mínimo).

## Pendiente: que venga solo de Odoo (campo a traer)
La API ya lee de la tarea de Odoo las **etiquetas** (`project.task.tag_ids`, que llegan como `etiquetaIds` y hoy alimentan `sugerirTipoServicio`) y los **productos de la orden** (`sale.order.line.product_id`, en `esperado`). Candidatos, de más a menos simple:

1. **Etiqueta de la tarea** (recomendado): una etiqueta tipo "Equipo no vehicular" que coordinación ponga al crear la tarea. Ya se lee; falta mapear su id a `tipoUnidad` (y exponerlo como `tipoUnidadSugerido` en la tarea de la agenda, igual que `tipoServicioSugerido`). El técnico lo ve preseleccionado y puede corregirlo.
2. **Producto o categoría del producto de la orden**: si los códigos de producto distinguen estos equipos, se deduce solo, sin depender de que coordinación se acuerde.
3. **Campo propio en Odoo Studio** en la tarea o el ticket: más prolijo, pero requiere desarrollo del lado de Odoo.

Hay que decidir cuál y verificarlo contra el Odoo de staging. Hasta entonces el técnico elige.

## Pendiente: datos de identificación del equipo
Hoy se pide solo un nombre o código libre. Qué más hace falta (número de serie, marca, modelo, ubicación) **depende del tipo de equipo**; la lista la va a pasar operaciones.

## Pendiente: fotos mínimas por caso (a confirmar)
- Instalación: foto del lugar donde se va a instalar (implementado).
- Intervención: foto de lo que se va a arreglar (hoy: vista general y estado antes de intervenir).
- Falta definir si hace falta algo más en desinstalación y en cambio de equipo.

## Otros puntos a revisar
- Los ítems 2 (seguridad) y 4 (cableado) de la revisión de otro equipo son una propuesta (la autorización, el estado general y la falla vienen de lo pedido). La alimentación eléctrica se sacó: a veces no corresponde. Confirmar con operaciones cuáles dejar.
- **El checklist de otro equipo reusa las claves de siempre** (`item2` = autorización, `item1` = seguridad, `item3` = estado, `item5` = cableado, `item6_falla`), para no tocar el esquema de la hoja ni la API. Quien lea esas claves sin mirar `tipoUnidad` verá la etiqueta del vehículo: el panel y el PDF ya lo respetan; **BO4 (`lib/conformidad-datos.ts`) todavía no**, y las hojas de otro equipo importadas se mostrarían con las etiquetas del vehículo.
- `matricula` guarda el nombre del equipo: los cruces por patente (equipo actual, estado del equipo, historial de la unidad) no encuentran nada para estos equipos, que es lo esperado.
- En BO4 (maqueta) la hoja importada llega con `matricula` = nombre del equipo y sin unidad; ver si conviene distinguirla.
