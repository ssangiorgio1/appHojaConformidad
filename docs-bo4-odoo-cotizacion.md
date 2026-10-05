# BO4 → Odoo: cotización desde afuera (evaluación y plan)

Fecha de la evaluación: 2026-10-05. Estado: **verificado en el staging de Odoo**, sin tocar producción.

## Idea

BO4 pasa a ser el CRM y Odoo queda para facturación. Desde BO4 se dispara la cotización hacia Odoo; cuando el cliente la confirma se dispara el ticket y el resto del flujo (tarea y subtareas). Una persona aparte se encarga de mapear clientes y productos. El trabajo se hace **por sprint y por partes**.

## Conclusión

**Sí es posible** crear la cotización desde afuera y llevarla hasta la confirmación. No hace falta desarrollar nada dentro de Odoo: alcanza con la conexión JSON-RPC que ya usa la API (`api/src/config/odoo.ts`, `executeKw`).

## Entorno

- Odoo 18. Módulos relevantes instalados: Ventas, CRM (+ `sale_crm`), Mesa de Ayuda (+ `helpdesk_sale`, `helpdesk_fsm`), Field Service (`industry_fsm`, `industry_fsm_sale`), `sale_project`, Facturación, Portal.
- **No hay base de pruebas separada de producción.** El `api/.env` hoy apunta a un **staging de Odoo.sh** (`wara-v1-testing-38610589.dev.odoo.com`), que **se borra solo el 25/10/2026**. Las líneas de producción están comentadas en el `.env`. Antes de escribir, mirar qué bloque está activo.
- La cuenta de servicio puede crear `sale.order` y `res.partner`. **No** puede ver `base.automation`, `ir.actions.server` ni `ir.model`.
- Todo lo que se crea queda a nombre del usuario de la API key (hoy un usuario personal). Falta un usuario de servicio propio de BO4.

## Lo que se probó (staging, 2026-10-05)

1. Buscar productos por código interno: `INS.001` (Instalación GPS comodato + BP) y `ABN.003` (Abono mensual pantalla 7").
2. Crear el cliente (`res.partner`) y la cotización (`sale.order`) en una llamada, con las líneas (`order_line`). Odoo calculó precios, impuestos y total.
3. Obtener el link del portal con `get_portal_url` (devuelve `/my/orders/<id>?access_token=...`). La base es la URL de Odoo.
4. Buscar la cotización por referencia propia: `search` sobre `client_order_ref`. Sirve para que un reintento no duplique.
5. `action_quotation_sent` → estado `sent`, sin mandar correo.
6. `action_confirm` → estado `sale`. **Odoo creó solo el ticket** "Ticket de Instalación - S0xxxx", con `requires_intervention = true` y `quantity_works = 0`.

Registros de prueba que quedaron en el staging (se borran con él): cliente 34871 "ZZ PRUEBA BO4 (borrar)", cotización S03946 (id 3947) confirmada, ticket 39070 y una suscripción activa.

## Lo que BO4 tiene que enviar (Odoo no lo adivina)

| Dato | Detalle |
|---|---|
| `plan_id` | **Obligatorio si hay un producto recurrente** (el abono). Sin plan, `action_confirm` falla con "Agregue un plan recurrente a la suscripción". Las ventas reales usan 1 = "Mensual (Calendario)". Planes: 1 Mensual (Calendario), 2 Mensual (Corrido), 3 Semestral (Calendario), 4 Semestral (Corrido), 5 Anual (Calendario), 6 Anual (Corrido), 7 Convenio Marco - Mendoza, 8 Trimestral (Corrido), 9 Trimestral (Calendario). |
| `pricelist_id` | Si no se indica, Odoo asigna "Clientes nuevos - Mendoza (ARS)". Las listas son por zona. Los precios los calcula Odoo según la lista (el `list_price` de `ABN.003` es 0 y el precio sale de la lista). |
| `team_id` y `user_id` | Equipo de ventas y vendedor. Por defecto salió el equipo "Mendoza". |
| `partner_id` | Clientes mapeados, idealmente por CUIT (`vat`). Buscar antes de crear para no duplicar. |
| Líneas | Productos mapeados por código interno (`default_code`). |
| `client_order_ref` | Id de BO4 (ej. `BO4-<id>`). Es la clave de idempotencia. |
| `require_signature` | Las cotizaciones reales usan `true`, con la plantilla "Presupuesto Base" (id 1). |
| Cantidad de trabajos | El ticket nace con `quantity_works = 0`. Hoy la carga coordinación a mano. BO4 podría completarla con la cantidad de unidades. |

## Flujo real después de confirmar (observado)

1. Confirmar la venta crea **solo** el ticket (`helpdesk.ticket`, vinculado por `sale_order_id`).
2. **Coordinación interviene a mano**, porque coordina con el cliente la visita, el lugar y las unidades. Usa el botón estándar "Planear intervención" (`action_generate_fsm_task`; asistente `helpdesk.create.fsm.task` con título, proyecto y cliente), que crea la tarea padre de Field Service.
3. Según el número de "Cantidad Trabajos" (`quantity_works`) se crean las **subtareas**, una por unidad. El nombre es la patente o el nombre que quiera el cliente, que debe pasar antes al comercial o a coordinación.
4. `quantity_works`, `quantity_pending` y `requires_intervention` son campos de un módulo propio de WARA. Son enteros simples (sin cálculo): los mantiene el código de ese módulo, que no se ve con la cuenta de servicio.

Por eso **BO4 no debería crear la tarea y las subtareas automáticamente al confirmar**: es una decisión humana de coordinación, y si se crean por API sin replicar la lógica del módulo, el contador de pendientes se desfasa.

## Decisiones

1. **Quién confirma la cotización.** Recomendado: **el cliente en el portal de Odoo** (A). Odoo conserva la firma y el estado oficial, y BO4 se entera consultando el estado o con un aviso que configure un administrador. Alternativa (B): confirmar desde BO4 (`action_confirm`), lo que obliga a rehacer la aceptación.
2. **Quién crea ticket, tarea y subtareas.** El ticket lo crea Odoo solo (no se toca). La tarea y las subtareas: dejar la intervención de coordinación como está y, más adelante, simplificarla con una pantalla de planificación (Sprint 4).
3. **Quién llama a Odoo:** la API actual como puerta de entrada (ya tiene el cliente y la cuenta) o una integración propia de BO4. Sin decidir.
4. **Qué pasa con los 652 leads del CRM de Odoo** cuando BO4 sea el CRM. Sin decidir.

## Plan por sprints

**Sprint 0 — Preparación**
- Mantener el staging mientras exista (vence el 25/10). Después, definir reglas de prueba sobre producción o duplicar la base desde el gestor de Odoo.
- Crear un usuario de servicio propio para BO4 con permisos mínimos.
- Definir la tabla de mapeo con quien la va a cargar: clientes por CUIT, productos por código, plan y lista de precios por zona.
- Conseguir la especificación del módulo de intervención (cómo se nombran las subtareas, qué más hace al aceptar).
- Resolver las decisiones 3 y 4.

**Sprint 1 — Cotización de BO4 a Odoo (sin confirmar)**
- Crear o actualizar el cliente por CUIT, y crear la cotización en borrador con plantilla, líneas, plan y lista de precios.
- Enviar el link del portal y guardar el id de la cotización en BO4. Reintentos sin duplicar (`client_order_ref`).

**Sprint 2 — Seguimiento y confirmación**
- BO4 consulta cada pocos minutos el estado de sus cotizaciones (o recibe un aviso configurado por un administrador de Odoo) y detecta la aceptación.
- Al confirmarse, leer el ticket que crea Odoo y mostrar el avance en BO4: cotizada, enviada, aceptada, con ticket, en intervención (`quantity_pending`), completada.
- Contemplar cotizaciones canceladas, vencidas o con cambios después de enviadas.

**Sprint 3 — Unidades antes de la intervención**
- BO4 guarda las patentes o nombres que pasa el cliente, ligados a la cotización. La cantidad debe coincidir con "Cantidad Trabajos".
- Coordinación ve esa lista al intervenir y no la vuelve a tipear.

**Sprint 4 (opcional) — Planificación simplificada**
- Pantalla en el panel web donde coordinación elige ticket, unidades, fecha, hora y técnico, y con un guardado se crean la tarea y las subtareas.
- Idea a validar: llamar al asistente estándar de Odoo por RPC (en vez de reimplementar la lógica), para que corra el código propio de WARA y los contadores queden bien.
- Sigue siendo una decisión humana: se simplifica, no se automatiza.

## Pendiente por probar

- El envío del correo de la cotización desde Odoo (no se probó a propósito).
- La aceptación del cliente desde el portal, con firma. Se usó `action_confirm` como reemplazo; falta abrir el link en el staging y aceptarlo como cliente.
- Crear la tarea llamando al asistente `helpdesk.create.fsm.task` por RPC y ver si genera las subtareas.

## Riesgos y cuidados

- **Escribir en producción sin base de pruebas** ensucia ventas, facturación y agenda. Usar cliente y cotizaciones de prueba marcados y un script de limpieza.
- **Duplicados al reintentar:** usar siempre `client_order_ref` y buscar antes de crear.
- **Auditoría:** usuario de servicio propio para saber qué creó cada sistema.
- **Cotización enviada y luego modificada:** definir cuántas revisiones se permiten.
- **CRM duplicado** si BO4 pasa a ser el CRM mientras Odoo conserva el suyo.
