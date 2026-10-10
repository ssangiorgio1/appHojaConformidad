# Prompt para v0 — Prototipo maquetado de backoffice "bo4"

> Copiar todo lo que está debajo de la línea y pegarlo en v0.
> Solo maqueta: sin datos reales, sin backend. La estructura de pantallas viene del prototipo anterior; el diseño UX/UI queda a criterio de v0, salvo la paleta de colores.

---

## Prompt

Diseñá un prototipo navegable (solo front, Next.js + Tailwind + shadcn/ui, idioma español rioplatense) de un **backoffice interno llamado "bo4"** para una empresa de rastreo satelital (GPS) que gestiona clientes, unidades, equipos instalados, intervenciones técnicas, stock y facturación.

### Reglas generales

- **Todo mockup, cero datos reales.** Usá datos ficticios obvios: clientes "Cliente Demo 01", patentes "AAA 000", series "SN-0000", CUIT "00-00000000-0", emails "demo@ejemplo.com". No uses nombres de empresas ni personas reales.
- Todo es estático: botones y formularios no guardan nada. Los modales, filtros, pestañas, paginación, ordenamiento de tablas y selección múltiple sí tienen que **abrirse y alternar visualmente**, para poder recorrer el flujo.
- El diseño de las pantallas, la distribución, los componentes y la interacción los resolvés vos como mejor criterio de UX. Priorizá densidad de información legible (es una herramienta de escritorio de uso diario), tablas claras, filtros visibles y acciones en contexto.
- Debe verse bien en escritorio y ser usable en tablet. En móvil alcanza con que no se rompa.
- Incluí estados vacíos, de carga (skeleton) y de error en las pantallas principales.
- Modo claro. Tipografía **Inter**.

### Paleta de colores (obligatoria)

| Uso | Color |
|---|---|
| Color de marca / primario (barra lateral, botones principales, énfasis) | `#1B4365` |
| Marca oscuro (hover, fondos de selección) | `#15364F` y `#12304A` |
| Texto principal | `#13202D` |
| Texto secundario | `#5B6B7D` |
| Texto terciario / placeholders | `#8C9AAB` |
| Bordes y divisores | `#D9E2EC` (alternativos `#C9D5E2`, `#E1E8F0`) |
| Fondo de la app | `#F6F8FB` |
| Fondo de superficies suaves (filas alternas, cabeceras de tabla) | `#EEF3F8` y `#EAF1F8` |
| Superficie (tarjetas, modales) | `#FFFFFF` |
| Peligro / error | `#D9443C` (texto sobre fondo claro `#71130E`, acento `#EA5A53`) |
| Éxito | `#235C45` |
| Advertencia | `#99600A` |

Usalos como tokens (variables CSS / tema de Tailwind), no valores sueltos. Los estados (activo, baja, pendiente, realizada, bajo stock) se expresan con chips usando éxito / advertencia / peligro / neutro.

### Estructura general de la app

- **Pantalla de login**: botón "Ingresar con Google" (cuenta corporativa). Texto de ayuda: "Solo cuentas del dominio de la empresa dadas de alta en bo4".
- **Layout**: barra lateral colapsable + barra superior.
  - Barra superior: **buscador global** (atajo `/`), selector de distribuidor, y el usuario con su rol.
  - Buscador global: resultados agrupados (Clientes, Unidades, Equipos) con coincidencia resaltada; ignora espacios y guiones en CUIT y SIM; `Enter` abre el primer resultado, `Esc` cierra.
  - Un control **"Ver como rol (demo)"** que cambia entre roles (Administrador, Comercial, Coordinación, Mesa de ayuda, Facturación) y deja las pantallas en **solo lectura** para los roles sin permiso, mostrando un aviso "Solo lectura para tu rol".
- **Menú lateral agrupado**:
  - Inicio
  - *Principal*: Clientes, Unidades, Equipos
  - *Operaciones*: Intervenciones, Stock
  - *Administración*: Facturación (con contador de pendientes), Usuarios
- Cada pantalla de detalle tiene migas de pan y un botón "Volver".

### Pantallas

**1. Inicio**
Pantalla con un estado "A definir" (placeholder con ilustración simple y texto "El contenido de la pantalla de inicio está pendiente de definición").

**2. Clientes (listado)**
- Selector de distribuidor ("Todos mis distribuidores" + cantidad).
- Filtros: tipo de cliente, comercial responsable, con botón "Limpiar filtro".
- Tabla: razón social, CUIT/CUIL, comercial, unidades activas, unidades instaladas. Paginación.
- Botón "Nuevo cliente" (modal de alta).
- Estado vacío: "No hay clientes que coincidan con la búsqueda y los filtros seleccionados".

**3. Cliente (ficha)** — con pestañas:
- **Resumen**: datos clave en tarjetas (estado, abono mensual, cantidad de unidades, etc.).
- **Usuarios**: tabla con perfil, nombre, usuario, legajo, RFID, baja y acciones (Editar, Ingresar como). Filtros por tipo.
- **Unidades**: tabla (patente / DNI / N° de serie, nombre de unidad, ignición, odómetro, horómetro, equipo, último reporte, fecha de alta y de baja) con exportar a Excel y PDF.
- **Equipos**: tabla (N° de serie, modelo, SIM ICCID, unidad, estado).
- **Intervenciones**: lista con tipo, unidad, perfil, fecha, técnico, detalle, monto y estado.
- **Datos de la empresa y contactos**: ficha de datos fiscales y lista de contactos asociados (nombre, rol, teléfono, email).
- **Facturación**:
  - Responsable pagador (puede ser el propio cliente u otra entidad con su CUIT), con aviso "También paga por: …".
  - Estado del servicio con interruptores; **cada cambio abre un modal de confirmación**.
  - Suscripciones: tabla con plan, producto, unidades, precio unitario, subtotal mensual, vigencia y estado. Abono mensual total. Mensaje "Sin suscripciones. Se crean al confirmar la orden de venta".
  - Enlace "Ir a facturación".
- **Configuración**:
  - Zona horaria (país + zona).
  - Ente regulador: el cliente puede ser ente o pertenecer a uno; lista de clientes asociados.
  - Reenvío de información: destinos a los que se reenvían las tramas de todas las unidades.
  - Módulos habilitados: lista agrupada por categoría con interruptores y descripción.
  - Reglas de negocio: tabla Parámetro / Tipo / Valor, editable.
  - Para roles sin permiso: "Tu rol puede ver la configuración pero no modificarla".

**4. Unidades (listado)**
- Filtros: tipo, "Sin reportar hace más de N horas/días", cliente, con chips de filtros activos y "Limpiar".
- Aclaración visible: "La búsqueda incluye altas y bajas".
- Tabla: tipo, patente / DNI / N° de serie, nombre, modelo, cliente, último reporte (fecha + hace cuánto), última intervención (perfil, texto, meta). Paginación.

**5. Unidad (ficha)**
- Encabezado con ID, descripción, cliente, y acciones: **Dar de baja**, **Ajustar odómetro / horómetro**, **Programar intervención** (los tres con modal).
- Tarjetas con datos de estado (ignición, odómetro, horómetro, último reporte, etc.).
- **Equipamiento contratado**: viene de la cotización / orden de venta y determina lo que se factura. Mostrar tres variantes de estado:
  - con orden de venta confirmada,
  - solo cotizado ("sin orden de venta confirmada: no se factura ni se genera orden de instalación"),
  - sin cotización ni orden ("no hay equipamiento para informar").
- **Equipo instalado**: N° de serie, estado, modelo, SIM; **accesorios instalados** con N° de serie; nota "Registrado desde la app de técnicos · orden · técnico · fecha". Estado "Sin accesorios instalados".
- **Intervenciones** de la unidad (tipo, perfil, fecha, técnico, detalle, estado).

**6. Equipos (listado)**
- Botón "Alta de equipo" (modal).
- Tabla con **selección múltiple** y barra inferior "Comparar" (hasta N equipos, con chips para quitar): N° de serie, modelo, SIM ICCID, estado, unidad, cliente y acción "Pasar a stock" (con confirmación).

**7. Equipo (ficha)**
- **Datos del equipo** con enlaces "Ver unidad" y "Ver cliente".
- **Trazabilidad**: línea de tiempo del historial. Aclaración "Registro inalterable: las entradas no se editan ni se borran".
- **Bitácora**: formulario "Nueva observación" con validación de error, y entradas que muestran tipo, campo, valor antes / después, motivo y autor.
- **Gráficas de estado**: gráficas de línea / escalón por día (ej. velocidad, ignición, tensión, señal) con eje de tiempo, **zoom por arrastre**, botón "Restablecer zoom", cursor con valor puntual, y selector de día. Mensaje "Sin reportes para este día".
- "Editar equipo" (modal).

**8. Comparador de equipos**
- Vista de solo consulta ("Para modificar la configuración de un equipo, abrí su ficha"), con botón "Volver a Equipos".
- Columnas por equipo seleccionado; filas de componentes instalados con interruptor **"Solo diferencias"**, y mensaje "Todos los equipos tienen los mismos componentes".
- Gráficas de estado superpuestas de los equipos seleccionados, con el mismo zoom y cursor sincronizado.

**9. Intervenciones (listado)**
- Pestañas por estado (todas, pendientes, programadas, realizadas, facturadas) con contador, y filtros.
- Indicadores arriba (KPIs) en tarjetas.
- Tabla: N°, tipo · unidad, perfil, detalle, cliente, técnico, fecha, estado, factura asociada y acción **"Marcar realizada"** (con confirmación).

**10. Stock**
- Pestañas: Productos y Movimientos, con aviso de productos bajo stock mínimo.
- **Productos**: tabla con producto (con código de origen), tipo, disponible, instalados, en laboratorio, stock mínimo, estado (chip) y acción **"Registrar movimiento"** (modal: tipo, cantidad, motivo o comprobante). Estado vacío "No hay productos que coincidan". Enlace "Ver productos".
- **Movimientos**: historial con fecha, producto, código, tipo, cantidad, motivo o comprobante y usuario.

**11. Facturación**
- Pestañas: Pendientes de facturar, Facturas emitidas, Suscripciones.
- KPIs: abono mensual total, pendiente de facturar.
- **Pendientes**: las intervenciones realizadas se **agrupan por responsable pagador** (propio cliente u otra entidad con CUIT, condición de IVA, email de facturación). Cada grupo se despliega para ver sus intervenciones (ID, tipo · unidad · fecha, cliente, monto), muestra el total y el botón **"Generar factura"**. Texto aclaratorio: "Al generar la factura se envía al sistema contable con los productos y servicios asociados; no hace falta cargarla a mano". Estado vacío "No hay intervenciones pendientes de facturar".
- **Emitidas**: número, pagador y CUIT, clientes incluidos, cantidad de ítems, total y chip "Sincronizada".
- **Suscripciones**: cliente, plan, producto, unidades, precio unitario, subtotal mensual, vigencia, estado.

**12. Usuarios (administración)**
- Tabla de usuarios internos con rol, estado y último acceso; alta, edición y baja con modal.
- Matriz simple de permisos por rol (solo visual).

### Entregable

Un prototipo navegable con todas las pantallas anteriores enlazadas entre sí (por ejemplo desde un cliente se llega a sus unidades, desde una unidad a su equipo, desde un equipo a su ficha), con los datos ficticios repetidos en suficiente cantidad para que las tablas, filtros y paginación se vean realistas. Componentes reutilizables y bien nombrados, listos para conectar a una API más adelante.
