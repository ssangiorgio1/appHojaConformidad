# Pendientes del mapeo de productos en la PWA (para retomar)

Fecha: 2026-10-06. Contexto: `docs-mapeo-productos-pwa.md` (mapeo y reglas) y lo ya implementado en API y PWA.

## Hecho hasta hoy

- **API:** cada unidad trae sus productos con id y cantidad, y `esperado` (qué instalar/retirar) resuelto con `api/src/config/productoMapeo.ts`. Teléfono del cliente por tarea.
- **PWA, paso 1:** tarjeta "A instalar según la orden de venta" en "Módulos y sensores".
- **PWA, paso 2:** las casillas esperadas se tildan solas (con cantidad), las que no están en la orden se bloquean, y si el producto se saca de Odoo y se actualiza la agenda, lo que se tildó solo se retira.
- **PWA:** la foto del equipo a colocar es obligatoria en el mismo paso (antes solo se pedía al finalizar).

## Pendiente

### Paso 3: instalado o "no instalado" antes del POST
Antes de avanzar al POST, cada producto esperado tiene que quedar instalado o marcado **"no instalado" con motivo** (el recordatorio contra los olvidos). El "no instalado" avisa a coordinación y comercial (se vendió y no se instaló: ajuste de la orden o nota de crédito).

**Caso concreto (aclarado 2026-10-07):** el producto está en la orden de venta, así que el paso lo tilda y lo bloquea, pero en el lugar no se puede instalar (por ejemplo, hay que agujerear algo y el cliente no quiere). El técnico necesita poder **destildar ese producto y escribir el motivo**. Después **se da de baja el producto de la orden** (la baja la hace coordinación o comercial en Odoo; la PWA solo deja el motivo y avisa). Lo mismo para desinstalaciones que no se pudieron hacer.
- **Falta decidir:** si el motivo es lista (cliente no autorizó, requiere perforar, falta material, sin acceso, otro) o texto libre, y si aparece en el PDF y en el panel.
- **Falta decidir:** quién da de baja el producto en Odoo (aviso a comercial o acción de la API).

### Paso 4: botón "Actualizar productos"
**Dónde va:** en la tarjeta "A instalar", arriba a la derecha, con el texto "Actualizado hace X min".

- Al tocarlo consulta Odoo en vivo y avisa qué cambió ("Sin cambios", "Se sumó: …", "Se quitó: …"). Las casillas se tildan o se retiran en el momento, sin salir del paso.
- **Sin internet:** botón deshabilitado con "Necesita conexión".
- **Refuerzo 1:** al tocar una casilla bloqueada (candado), un aviso corto: "No está en la orden de venta. Si el cliente lo pidió, que comercial lo sume y tocá Actualizar".
- **Refuerzo 2:** en el chequeo del paso 3, si falta un producto, ofrecer ahí mismo "Actualizar".
- **No** se pone en cada paso: sería ruido.

**API necesaria:** un endpoint chico, por ejemplo `GET /calendar/tasks/:id/productos?subtareaId=…`, que lea solo esa tarea (y las tareas colapsadas en la unidad) y sus líneas de venta, y devuelva productos y `esperado`. Reusar la agenda del día es pesado.

### Otros pendientes del mapeo
- 5 preguntas abiertas de `docs-mapeo-productos-pwa.md` (`INS.ANT`, `INS.503`, `DES.108`, `AVL001`/`AVL002`, `INS.010`).
- 19 productos de hardware sin casilla en la PWA: agregar casillas o decidir cómo se registran.
- Activar automáticamente el modo "no es un equipo con IMEI" cuando la orden solo trae sensores/módulos (hoy lo marca el técnico).
- Mostrar el teléfono del cliente también en la pantalla de "Cliente ausente" del PRE y del POST.
- Commit selectivo y despliegue (la API va primero).

## Tema nuevo para mañana
PDF cuando la visita queda como **visita fallida** (unidad no encontrada) y cuando el **cliente no está para firmar**. Ver `docs-visita-fallida-pdf.md`.
