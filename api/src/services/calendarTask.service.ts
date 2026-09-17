import { executeKw } from '../config/odoo.js';
import { cached } from '../config/odooSchemaCache.js';
import { env } from '../config/env.js';
import { classify, many2oneName, withTimeout } from './odooErrors.js';

// Campos reales descubiertos con scripts/discoverOdooTaskSchema.ts (de solo
// lectura, corrido contra la Odoo real) — NO hay un campo "fin" dedicado en
// este project.task: date_end viene siempre en false en los datos reales (es
// la fecha de cierre efectivo, no la del turno agendado). date_deadline es el
// candidato que mejor calza como fin de la ventana agendada — su relación
// con planned_date_begin en los datos reales coincide con el problema descrito
// en features.md (coordinación estira el rango a mano para que no desaparezca
// del técnico en Odoo). Confirmar contra la UI real de Field Service de Odoo.
const START_FIELD = 'planned_date_begin';
// date_deadline es el campo que mejor calza como fin de la ventana agendada
// en esta versión de Odoo — planned_date_end no existe en este modelo. Pero
// coordinación lo estira a propósito (a veces días después) para que la
// tarea no desaparezca del técnico si se atrasa, así que solo sirve como fin
// real cuando la ventana es razonable (ver MAX_DEADLINE_WINDOW_HOURS) — no
// exige que caiga el mismo día calendario, ver computeTaskEnd().
const END_FIELD = 'date_deadline';
const DEFAULT_TASK_DURATION_HOURS = 1;
const MAX_DEADLINE_WINDOW_HOURS = 8;
const AR_OFFSET_MS = 3 * 60 * 60 * 1000;

export interface CalendarSubtask {
  id: number;
  name: string;
  stage: string | null;
  technicianName: string | null;
  // user_ids de la subtarea en Odoo — permite scopear "mis subtareas dentro
  // de este lote" (ver ALCANCE_BACKOFFICE.md §14), a diferencia de
  // technicianName (string, solo para mostrar).
  technicianIds: number[];
  isClosed: boolean;
  description: string | null;
  odooUrl: string;
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
  // El helpdesk.ticket del que nace esta tarea de FSM, cuando existe — no
  // todas las tareas vienen de un ticket (ver discoverHelpdeskTaskLink.ts):
  // algunas se agendan directo desde una orden de venta. La agenda de la PWA
  // lo usa para precargar el vínculo a Odoo del PRE sin que el técnico tenga
  // que volver a buscarlo.
  ticketOdoo: { id: number; label: string } | null;
}

function many2oneRef(v: unknown): { id: number; label: string } | null {
  return Array.isArray(v) && v.length > 1 ? { id: v[0] as number, label: String(v[1]) } : null;
}

function parseOdooDate(s: string): Date {
  return new Date(`${s.replace(' ', 'T')}Z`);
}

function formatOdooDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  );
}

// `date_deadline` no es un fin de turno confiable: coordinación lo estira a
// propósito para que la tarea no desaparezca del técnico si se atrasa (ver
// calendario_logica_horarios.md — el caso real detectado ahí era un deadline
// 25hs después del inicio). `allocated_hours` es la fuente de verdad cuando
// está cargada; si no, `date_deadline` solo sirve si la ventana es razonable
// (≤ MAX_DEADLINE_WINDOW_HOURS).
//
// A propósito NO exige que caiga el mismo día calendario — un turno que
// arranca a la noche y cruza la medianoche (ej. 20:00 a 02:00, 6hs) es una
// ventana perfectamente razonable, y exigir "mismo día" lo rechazaba igual
// que a un deadline de 25hs después, cayendo los dos al fallback de 1h por
// default — eso hacía que un turno nocturno real se mostrara truncado a una
// hora arbitraria (ej. terminando a las 21:00 para un inicio a las 20:00) en
// vez de a la hora real en que termina, al día siguiente.
function computeTaskEnd(startStr: string, deadlineStr: string | false, allocatedHours: number): string {
  const start = parseOdooDate(startStr);
  if (allocatedHours > 0) {
    return formatOdooDate(new Date(start.getTime() + allocatedHours * 60 * 60 * 1000));
  }
  if (deadlineStr) {
    const deadline = parseOdooDate(deadlineStr);
    const deadlineHours = (deadline.getTime() - start.getTime()) / (60 * 60 * 1000);
    if (deadlineHours > 0 && deadlineHours <= MAX_DEADLINE_WINDOW_HOURS) {
      return deadlineStr;
    }
  }
  return formatOdooDate(new Date(start.getTime() + DEFAULT_TASK_DURATION_HOURS * 60 * 60 * 1000));
}

// Link universal de Odoo para abrir un registro por modelo+id — funciona
// tanto en instancias viejas como nuevas (a diferencia de las URLs "bonitas"
// de una app específica, que varían según versión/menú instalado).
function odooTaskUrl(id: number): string {
  return `${env.ODOO_URL}/web#model=project.task&id=${id}&view_type=form`;
}

export interface OdooTechnician {
  id: number;
  name: string;
}

interface FieldServiceContext {
  projectIds: number[];
}

// Cacheado ~30min — qué proyectos son de Field Service cambia muy poco.
async function getFieldServiceContext(): Promise<FieldServiceContext> {
  return cached('calendar:fsm-context', 30 * 60 * 1000, async () => {
    try {
      const projects = (await withTimeout(
        executeKw('project.project', 'search_read', [[['is_fsm', '=', true]]], { fields: ['id', 'name'] }),
        'getFieldServiceContext',
      )) as Array<{ id: number; name: string }>;
      return { projectIds: projects.map((p) => p.id) };
    } catch (err) {
      throw classify(err);
    }
  });
}

function stripHtml(html: string | false): string | null {
  if (!html) return null;
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text || null;
}

// Cacheado ~5min — es un filtro de dropdown, no necesita estar al segundo.
// Se deriva de quién tiene tareas asignadas en los proyectos de Field
// Service (no de todo res.users, que incluye miles de clientes/portal users)
// — mismo criterio que usa el dashboard de reportes con su lista de nombres,
// pero acá resuelto por asignación real en vez de una lista hardcodeada.
export async function listTechnicians(): Promise<OdooTechnician[]> {
  return cached('calendar:technicians', 5 * 60 * 1000, async () => {
    try {
      const { projectIds } = await getFieldServiceContext();
      if (!projectIds.length) return [];

      const tasks = (await withTimeout(
        executeKw('project.task', 'search_read', [[['project_id', 'in', projectIds], ['parent_id', '=', false]]], {
          fields: ['user_ids'],
          limit: 2000,
          order: 'write_date desc',
        }),
        'listTechnicians:tasks',
      )) as Array<{ user_ids: number[] }>;

      const ids = Array.from(new Set(tasks.flatMap((t) => t.user_ids)));
      if (!ids.length) return [];

      const users = (await withTimeout(
        executeKw('res.users', 'read', [ids], { fields: ['id', 'name'] }),
        'listTechnicians:users',
      )) as Array<{ id: number; name: string }>;

      return users.sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
      throw classify(err);
    }
  });
}

// Sin cache — el calendario necesita ver cambios reales de Odoo (sync en
// vivo, sin capa de persistencia propia para las tareas).
export async function listCalendarTasks(params: { from: string; to: string; technicianIds?: number[] }): Promise<CalendarTask[]> {
  try {
    const { projectIds } = await getFieldServiceContext();
    if (!projectIds.length) return [];

    const domain: unknown[] = [
      ['project_id', 'in', projectIds],
      ['parent_id', '=', false],
      [START_FIELD, '>=', params.from],
      [START_FIELD, '<', params.to],
    ];
    // Sin esto, una tarea de lote ("instalar 10 unidades") donde el técnico
    // solo está asignado a UNA subtarea (no a la tarea padre) no aparecía en
    // su agenda — el filtro solo miraba user_ids de la tarea padre. Traer la
    // tarea si el técnico está en la tarea O en cualquiera de sus subtareas
    // (ver ALCANCE_BACKOFFICE.md §14). Pendiente de verificar que Odoo
    // resuelve bien este dominio con notación de punto sobre un one2many
    // (child_ids) encadenado con un many2many (user_ids).
    if (params.technicianIds?.length) {
      domain.push('|', ['user_ids', 'in', params.technicianIds], ['child_ids.user_ids', 'in', params.technicianIds]);
    }

    const rows = (await withTimeout(
      executeKw('project.task', 'search_read', [domain], {
        fields: [
          'id',
          'name',
          'user_ids',
          'user_names',
          'partner_id',
          'stage_id',
          'description',
          'allocated_hours',
          'child_ids',
          'subtask_count',
          'helpdesk_ticket_id',
          START_FIELD,
          END_FIELD,
        ],
        order: `${START_FIELD} asc`,
        limit: 500,
      }),
      'listCalendarTasks',
    )) as Array<Record<string, unknown>>;

    const subtasksByParent = await resolveSubtasks(rows.flatMap((r) => r.child_ids as number[]));

    return rows.map((r) => {
      const allSubtasks = subtasksByParent.get(r.id as number) ?? [];
      // Un técnico solo debe ver, dentro de cada tarea, las subtareas
      // (unidades) que tiene asignadas a él — no las de sus compañeros en el
      // mismo lote (ver ALCANCE_BACKOFFICE.md §14). Coordinación/mesa_ayuda/
      // admin (sin technicianIds, ven todo) siguen viendo el lote completo,
      // igual que hoy.
      const subtasks = params.technicianIds?.length
        ? allSubtasks.filter((s) => s.technicianIds.some((id) => params.technicianIds!.includes(id)))
        : allSubtasks;
      return {
        id: r.id as number,
        title: r.name as string,
        start: r[START_FIELD] as string,
        end: computeTaskEnd(r[START_FIELD] as string, r[END_FIELD] as string | false, (r.allocated_hours as number) || 0),
        technicianId: (r.user_ids as number[])[0] ?? null,
        technicianName: (r.user_names as string) || null,
        partnerName: many2oneName(r.partner_id),
        stage: many2oneName(r.stage_id),
        description: stripHtml(r.description as string | false),
        odooUrl: odooTaskUrl(r.id as number),
        subtaskCount: (r.subtask_count as number) || 0,
        subtasks,
        ticketOdoo: many2oneRef(r.helpdesk_ticket_id),
      };
    });
  } catch (err) {
    throw classify(err);
  }
}

// Batch único para todas las subtareas de la semana/día visible — evita
// decenas de consultas individuales (una por tarea padre con subtareas).
// Las subtareas casi nunca tienen su propia fecha/hora en Odoo: la visita
// la agenda la tarea padre, las subtareas son las unidades de trabajo.
async function resolveSubtasks(childIds: number[]): Promise<Map<number, CalendarSubtask[]>> {
  const uniqueIds = Array.from(new Set(childIds));
  const byParent = new Map<number, CalendarSubtask[]>();
  if (!uniqueIds.length) return byParent;

  const subtasksRaw = (await withTimeout(
    executeKw('project.task', 'read', [uniqueIds], {
      fields: ['id', 'name', 'stage_id', 'user_names', 'user_ids', 'parent_id', 'is_closed', 'description'],
    }),
    'listCalendarTasks:subtasks',
  )) as Array<Record<string, unknown>>;

  for (const s of subtasksRaw) {
    const parentId = (s.parent_id as [number, string] | false) || null;
    if (!parentId) continue;
    const subtask: CalendarSubtask = {
      id: s.id as number,
      name: s.name as string,
      stage: many2oneName(s.stage_id),
      technicianName: (s.user_names as string) || null,
      technicianIds: (s.user_ids as number[]) || [],
      isClosed: !!s.is_closed,
      description: stripHtml(s.description as string | false),
      odooUrl: odooTaskUrl(s.id as number),
    };
    const list = byParent.get(parentId[0]);
    if (list) list.push(subtask);
    else byParent.set(parentId[0], [subtask]);
  }
  return byParent;
}

// Para el cierre automático de la visita de un lote (ver loteVisita.service.ts):
// necesitamos saber, en el momento en que el técnico resuelve una unidad,
// cuáles son HOY sus propias subtareas dentro de ese lote — no todas las del
// lote, porque distintas unidades pueden estar asignadas a técnicos distintos
// y la reasignación puede cambiar en cualquier momento (ver caso real: una
// unidad reasignada a otro técnico a mitad de la visita). Un round-trip
// puntual a Odoo (no cacheado) a propósito: esto solo corre cuando una unidad
// se resuelve, no en cada carga de agenda.
export async function getOwnSubtaskIds(parentTaskId: number, technicianOdooId: number): Promise<number[]> {
  const parentRows = (await withTimeout(
    executeKw('project.task', 'read', [[parentTaskId]], { fields: ['id', 'child_ids'] }),
    'getOwnSubtaskIds:parent',
  )) as Array<{ child_ids?: number[] }>;
  const childIds = parentRows[0]?.child_ids ?? [];
  if (!childIds.length) return [];

  const childRows = (await withTimeout(
    executeKw('project.task', 'read', [childIds], { fields: ['id', 'user_ids'] }),
    'getOwnSubtaskIds:children',
  )) as Array<{ id: number; user_ids?: number[] }>;

  return childRows.filter((c) => (c.user_ids ?? []).includes(technicianOdooId)).map((c) => c.id);
}

export interface TechnicianTaskStats {
  technicianId: number;
  tasksTotal: number;
  tasksCompleted: number;
  tasksPending: number;
  subtasksTotal: number;
  subtasksCompleted: number;
  subtasksPending: number;
}

// Para /reportes/tecnicos — a diferencia de listCalendarTasks, acá no
// importa el detalle de cada tarea (nombre, descripción, cliente), solo
// contarlas por técnico y por estado (is_closed), así que se pide el mínimo
// de campos posible. Igual que listCalendarTasks, cuenta una tarea con
// varios técnicos asignados (user_ids) una vez por cada uno.
export async function getTechnicianTaskStats(params: { from: string; to: string; technicianIds?: number[] }): Promise<TechnicianTaskStats[]> {
  try {
    const { projectIds } = await getFieldServiceContext();
    if (!projectIds.length) return [];

    const domain: unknown[] = [
      ['project_id', 'in', projectIds],
      ['parent_id', '=', false],
      [START_FIELD, '>=', params.from],
      [START_FIELD, '<', params.to],
    ];
    if (params.technicianIds?.length) domain.push(['user_ids', 'in', params.technicianIds]);

    const rows = (await withTimeout(
      executeKw('project.task', 'search_read', [domain], {
        fields: ['id', 'user_ids', 'is_closed', 'child_ids'],
        limit: 2000,
      }),
      'getTechnicianTaskStats:tasks',
    )) as Array<{ id: number; user_ids: number[]; is_closed: boolean; child_ids: number[] }>;

    const allChildIds = Array.from(new Set(rows.flatMap((r) => r.child_ids)));
    const childRows = allChildIds.length
      ? ((await withTimeout(
          executeKw('project.task', 'read', [allChildIds], { fields: ['id', 'is_closed'] }),
          'getTechnicianTaskStats:subtasks',
        )) as Array<{ id: number; is_closed: boolean }>)
      : [];
    const closedByChildId = new Map(childRows.map((c) => [c.id, !!c.is_closed]));

    const statsByTech = new Map<number, TechnicianTaskStats>();
    for (const r of rows) {
      for (const techId of r.user_ids) {
        const stats = statsByTech.get(techId) ?? {
          technicianId: techId,
          tasksTotal: 0,
          tasksCompleted: 0,
          tasksPending: 0,
          subtasksTotal: 0,
          subtasksCompleted: 0,
          subtasksPending: 0,
        };
        stats.tasksTotal += 1;
        if (r.is_closed) stats.tasksCompleted += 1;
        else stats.tasksPending += 1;

        for (const childId of r.child_ids) {
          stats.subtasksTotal += 1;
          if (closedByChildId.get(childId)) stats.subtasksCompleted += 1;
          else stats.subtasksPending += 1;
        }
        statsByTech.set(techId, stats);
      }
    }
    return Array.from(statsByTech.values());
  } catch (err) {
    throw classify(err);
  }
}

// Convierte un día calendario en hora Argentina ("YYYY-MM-DD") al datetime
// UTC naive que espera Odoo — mismo criterio de offset fijo (UTC-3, ver
// AR_OFFSET_MS) que el resto del archivo. `endExclusive` sirve para el
// límite superior del rango (el día siguiente a las 00:00 ART), así el
// filtro `< to` incluye el día completo de fechaHasta.
export function arDateToOdooUtc(fechaIso: string, endExclusive = false): string {
  const dayOffsetMs = endExclusive ? 24 * 60 * 60 * 1000 : 0;
  const utcMidnight = new Date(`${fechaIso}T00:00:00Z`).getTime() + dayOffsetMs;
  return formatOdooDate(new Date(utcMidnight + AR_OFFSET_MS));
}

// Escribe en Odoo real — mover una tarea arrastrándola en el calendario.
// Solo se llama cuando coordinación/admin confirma explícitamente "Guardar
// cambios" (el drag en sí solo actualiza estado local en el navegador); ver
// el protocolo de seguridad del plan sobre escrituras contra producción.
export async function moveCalendarTask(id: number, input: { start: string; end: string }): Promise<void> {
  try {
    await withTimeout(
      executeKw('project.task', 'write', [[id], { [START_FIELD]: input.start, [END_FIELD]: input.end }]),
      'moveCalendarTask',
    );
  } catch (err) {
    throw classify(err);
  }
}
