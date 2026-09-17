# Análisis y Corrección de la Lógica del Calendario (Horarios y Subtareas)

## 1. Problemas Reportados
1. **Horarios desfasados en la grilla**: Hay tareas que figuran como **"09:00 – 10:00"** pero la tarjeta visual en la grilla se estira ocupando todo el día hasta las **10 de la noche (22:00 hs)**.
2. **Falta de subtareas**: Al consultar o abrir una tarea/ticket en el calendario, **no se están trayendo ni mostrando las subtareas asociadas**.

---

## 2. Causa Raíz Detectada

### A. Horarios y Duración (Desborde hasta las 22:00 hs)
Tras inspeccionar las tareas reales directamente en la base de datos de Odoo (`project.task`), se descubrió la dinámica exacta:

#### Ejemplo real detectado en Odoo:
- **Ticket / Tarea:** `#16837` (*SAN RAFAEL - 1 SOLICITUD DE INSTALACION CLIENTE MARCOS BAUTISTA*)
- **`planned_date_begin`**: `2026-09-10 12:00:00` UTC (**09:00 hs** en horario de Argentina UTC-3)
- **`allocated_hours`** (Tiempo asignado de trabajo): **`1` hora** (la tarea realmente dura de 09:00 a 10:00)
- **`date_deadline`**: `2026-09-11 13:00:00` UTC (**10:00 hs del DÍA SIGUIENTE**, 25 horas después)

#### ¿Por qué se estiraba hasta las 22:00?
1. **Odoo no posee el campo `planned_date_end`**: El backend utilizaba `date_deadline` como el campo de fin de la tarea (`END_FIELD`).
2. **Coordinación estira el deadline a propósito**: Para evitar que la tarea desaparezca del técnico en Odoo si se atrasa, coordinación le asigna un `date_deadline` al día siguiente (o varios días después).
3. **Cálculo en la grilla (`CalendarGrid.tsx`)**:
   - `startHour`: `9` (09:00 hs).
   - `rawEndHour`: `34` (10:00 hs del día siguiente = 24 + 10).
   - La grilla tiene como tope `GRID_END_HOUR = 22` (las 22:00 hs / 10 de la noche).
   - Al renderizar el bloque del día, calcula:
     ```ts
     const clampedEnd = Math.max(clampedStart + 0.5, Math.min(p.endHour, GRID_END_HOUR));
     ```
     Como `Math.min(34, 22) = 22`, el bloque se dibuja físicamente de **09:00 a 22:00 hs** (13 horas de alto).
4. **Formato del texto (`timeLabel`)**:
   - El label ejecutaba `formatArTime` sobre la fecha de inicio y la fecha de fin:
     ```ts
     `${formatArTime(hourToDate(dayMidnightUtc, p.startHour))} – ${formatArTime(hourToDate(dayMidnightUtc, p.endHour))}`
     ```
   - Como `formatArTime` solo extrae `HH:mm` (sin mostrar la fecha ni el día), `34 horas` se formateaban como `"10:00"`.
   - **Efecto final**: El usuario leía el texto *"09:00 – 10:00"*, pero veía una tarjeta gigante que abarcaba de 9 de la mañana a 10 de la noche.

---

### B. Subtareas Ausentes
Al auditar el backend (`api/src/services/calendarTask.service.ts`), se identificaron dos motivos por los cuales las subtareas no están disponibles:

1. **Filtro excluyente en la query**:
   En la función `listCalendarTasks`:
   ```ts
   const domain: unknown[] = [
     ['project_id', 'in', projectIds],
     ['parent_id', '=', false], // <-- EXCLUYE explícitamente cualquier subtarea
     [START_FIELD, '>=', params.from],
     [START_FIELD, '<', params.to],
   ];
   ```
2. **No se solicita el campo `child_ids` ni se resuelven los hijos**:
   - La consulta no pide el campo `child_ids` de la tarea padre.
   - En Odoo, las subtareas se vinculan mediante:
     - `child_ids` (One2many en `project.task` hacia las subtareas).
     - `parent_id` (Many2one que apunta a la tarea padre).
     - `subtask_count` (Integer con la cantidad de subtareas).
   - En la interfaz TypeScript `CalendarTask` (tanto en `api` como en `web`), no existe el campo `subtasks`, y el componente `TaskDetailPanel.tsx` no tiene sección para renderizarlas.

#### Estructura real de las subtareas en Odoo:
Inspeccionamos tareas reales con subtareas en producción:
- **Padre `#17388`** *"SESA: BAJA DOMINIO"*: tiene 16 subtareas numeradas del 1 al 16 (una por cada dominio a dar de baja).
- **Padre `#17414`** *"Sacar GPS interno 4002 y 2071"*: tiene 2 subtareas (`"1"` y `"2"`).
- **Padre `#17412`** *"URGENTE SOLICITUD DE INSTALACION - TRANSPOL"*: tiene 1 subtarea (`"1"`).

En Odoo las subtareas casi **nunca tienen fecha y hora propia** (`planned_date_begin` suele ser `false`): la fecha y hora de la visita la tiene la tarea padre. Las subtareas son los ítems/unidades que componen el trabajo a realizar durante esa franja horaria.

---

## 3. Solución Técnica Detallada

### A. Horarios y Duración

1. **Backend (`api/src/services/calendarTask.service.ts`)**:
   - Solicitar a Odoo el campo `allocated_hours` (tipo `float`) de `project.task`.
   - **Regla de cálculo para `end`**:
     - Si `allocated_hours > 0`: $\text{end} = \text{planned\_date\_begin} + \text{allocated\_hours}$.
     - Si `allocated_hours == 0` o no definido:
       - Si `date_deadline` es del **mismo día** que `planned_date_begin` y la duración es $\le 8$ hs, usar `date_deadline`.
       - Si cruza al día siguiente o excede 8 hs, usar `DEFAULT_TASK_DURATION_HOURS = 1`.

2. **Frontend (`CalendarGrid.tsx` y `calendarDates.ts`)**:
   - En la grilla, limitar visualmente las tareas diarias a la jornada (`GRID_END_HOUR = 22`).
   - Si una tarea excede el día calendario, aclararlo explícitamente en el label (ej: `09:00 – 10:00 (+1d)`).

---

### B. Subtareas (Resolución e Implementación)

1. **Estrategia Batch en el Backend (`api/src/services/calendarTask.service.ts`)**:
   - Para no hacer decenas de consultas individuales a Odoo, se aplica una estrategia en 2 pasos:
     1. En la consulta principal `search_read` de las tareas de la semana, pedir los campos `child_ids` y `subtask_count`.
     2. Recolectar todos los IDs de subtareas presentes (`allChildIds = rows.flatMap(r => r.child_ids)`).
     3. Ejecutar **una sola consulta Batch** a Odoo:
        ```ts
        const subtasksRaw = allChildIds.length > 0
          ? await executeKw('project.task', 'read', [allChildIds], {
              fields: ['id', 'name', 'stage_id', 'user_names', 'parent_id', 'is_closed']
            })
          : [];
        ```
     4. Mapear y agrupar las subtareas por su `parent_id[0]` asociándolas a cada tarea padre antes de enviar la respuesta al frontend.

2. **Tipos TypeScript (`web/src/lib/types.ts` y `api/src/services/calendarTask.service.ts`)**:
   ```ts
   export interface CalendarSubtask {
     id: number;
     name: string;
     stage: string | null;           // ej: "Nuevo", "Coordinado", "Hecho"
     technicianName: string | null;  // Si la subtarea tiene técnico específico
     isClosed: boolean;              // true si la subtarea está finalizada
   }

   export interface CalendarTask {
     id: number;
     title: string;
     start: string;
     end: string | null;
     technicianId: number | null;
     technicianName: string | null;
     partnerName: string | null;
     stage: string | null;
     description: string | null;
     odooUrl: string;
     subtaskCount: number;
     subtasks: CalendarSubtask[];
   }
   ```

3. **Interfaz de Usuario (Frontend)**:
   - **En `TaskDetailPanel.tsx` (Panel Lateral)**:
     - Nueva sección **"Subtareas / Unidades"** ubicada debajo de la descripción.
     - **Encabezado con métrica**: ej. `Subtareas (2 de 5 completadas)` con barra de progreso visual.
     - **Checklist**:
       - Cada subtarea listada con su nombre / número de unidad.
       - Badge de estado con color según la etapa (verde para terminadas, azul para en proceso, gris para nuevas/pendientes).
       - Técnico asignado si difiere del técnico de la tarea principal.
   - **En `CalendarGrid.tsx` (Grilla del Calendario)**:
     - Si `task.subtaskCount > 0`, se renderiza un badge compacto dentro del bloque horario:
       - Ejemplo: `📋 3 subtareas` o `1/3` para que coordinación identifique a simple vista qué visitas contienen múltiples unidades.
