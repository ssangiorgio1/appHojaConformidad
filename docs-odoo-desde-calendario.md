# Gestión de tickets, tareas y subtareas de Odoo desde el calendario del panel (plan, 2026-11-10)

Solo plan: no se tocó código. Pensado para portarse a bo4 (ver `docs-bo4-odoo-cotizacion.md`).

## Qué existe hoy (verificado leyendo `C:\h\api` y `C:\h\web`)

- El calendario del panel ya escribe en Odoo: arrastrar una tarea y "Guardar cambios" llama a `PATCH /calendar/tasks/:id/move` → `moveCalendarTask` (`calendarTask.service.ts`), que hace `project.task.write` de fechas. Roles de escritura (`WRITE_ROLES`): coordinación, admin, superadmin, con `calendarMutationLimiter`.
- Servicios de Odoo ya hechos en la API: cambiar estado/etapa (`markTaskStateHecho`, `markTaskStageVisitaFallida`, `reopenTask`), `reassignTaskTechnician`, `moveParentDateIfSafe`, `createDerivedSubtask` (`project.task.create`, copia proyecto, cliente y etiquetas de la unidad original), notas (`postTicketNote`, `postNotaInternaTarea`) y `pushConformidadToTicket` (adjunta el PDF).
- Credenciales del técnico: `executeKwAsCredentials` escribe con el login de Odoo vinculado de cada usuario (el chatter queda a su nombre, no de la cuenta de servicio).
- `TaskDetailPanel.tsx` (calendario) muestra tarea y subtareas, hoy solo lectura.
- **No existe:** crear tickets (`helpdesk.ticket.create`; solo `searchTickets`/`verifyTicketExists`) ni crear tareas padre. `moveCalendarTask` **no audita** (`audit()` existe en `audit.service.ts` pero el controller de move no lo llama).

## Alcance

- **Entra:** coordinación crea y gestiona ticket, tarea y subtareas en Odoo desde el calendario; todo aparece en la agenda del técnico en la PWA.
- **No entra:** ejecutar la intervención (PRE/POST, fotos, firma, QR), que sigue en la PWA. Tampoco la carga retroactiva de conformidades desde el panel (toca la integridad del PDF y la firma).

## Arquitectura (clave para bo4)

| Capa | Qué contiene | En bo4 |
|---|---|---|
| Servicio Odoo | Funciones puras `createTicket`, `createTask`, `createSubtask`, sin Express ni Mongo | Se copia casi tal cual |
| Orquestación | Valida, verifica duplicados, llama al servicio, audita | Se reescribe sobre los permisos de bo4 |
| UI | Formularios en el `TaskDetailPanel` | Se rehace en Next |

El panel nunca habla con Odoo directo: todo pasa por la API.

## Fases

- **Fase 0 (sin código, con coordinación):** campos obligatorios de cada alta en Odoo (ticket: equipo de helpdesk, cliente, etiquetas, etapa; tarea: proyecto, etapa inicial; subtarea); quién puede crear qué (contrastar con el xlsx de roles de bo4; ¿mesa de ayuda crea tickets?); vínculo del técnico (la tarea nueva debe llevar su `odooUserId` o no aparece en la agenda de la PWA; ver el gap del paso manual de vinculación); credenciales del usuario logueado vs cuenta de servicio.
- **Fase 1 (primer corte, bajo riesgo):** `POST /calendar/tasks/:id/subtasks` con los mismos roles y limiter que `move`; reutiliza `createDerivedSubtask` ampliado con técnico y fecha opcionales; botón "Agregar subtarea" en el detalle del calendario; confirmación explícita antes de escribir; auditoría con `audit()` (sumarla también a `move`).
- **Fase 2:** servicios `createTicket` y `createTask`; antes de crear, buscar duplicados (cliente + equipo) con `searchTickets`; "Nueva intervención" en el calendario (cliente, equipo, motivo, etiquetas, técnico, fecha) que crea ticket + tarea + subtarea; etiquetas reutilizando el mapeo etiqueta → `tipoServicio` (tema "Odoo tag → tipoServicio", y campo `x_studio_tipo_de_servicio`, tema 33).
- **Fase 3:** exponer lo que ya existe: cambio de técnico, reprogramar, estados, notas internas.

## Riesgos y decisiones abiertas

- **No atómico:** Odoo no tiene transacción entre ticket, tarea y subtarea; si falla la segunda queda un ticket huérfano. Decidir si se compensa (archivar/borrar) o se reporta y se reintenta desde el id ya creado.
- **Timeouts:** como en `pushConformidadToTicket`, un timeout no significa "no se creó": re-consultar antes de reintentar para no duplicar.
- **Autoría:** credenciales del usuario = "creado por" real en Odoo; cuenta de servicio = no.
- **Volumen contra Odoo:** respetar el TTL corto de caché e invalidar solo lo afectado tras crear.
- **Permisos Odoo vs WARA:** que el panel permita crear no implica que el usuario Odoo tenga permiso; probar con cuentas reales de cada rol.
- **Pruebas sin ensuciar producción:** el staging de Odoo se borró (tema 35) y local y Render comparten Mongo (tema 28: ids que chocan entre instancias). Definir base de pruebas o tickets etiquetados TEST borrables.

## Para bo4

Dejar como anexo la lista de operaciones sobre Odoo (modelo, método, campos), los permisos y el flujo de compensación: eso es lo que realmente se porta.

## Preguntas abiertas

1. ¿Quién crea tickets hoy: solo coordinación o también mesa de ayuda?
2. ¿Hay una base de pruebas de Odoo o todo se prueba contra producción?
3. Credenciales del usuario o cuenta de servicio para las altas.
