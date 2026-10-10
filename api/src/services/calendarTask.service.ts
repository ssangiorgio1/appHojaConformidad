import { executeKw } from '../config/odoo.js';
import { cached } from '../config/odooSchemaCache.js';
import { env } from '../config/env.js';
import type { EsperadoUnidad } from '../config/productoMapeo.js';
import { elegirContacto, limpiarTelefono, type ContactoCliente } from './contactoCliente.js';
import { sugerirTipoServicio, marcarCambioUnidad, type SugerenciaTipoServicio } from './tipoServicioSugerido.js';
import { aplicarEsperado, idsDeLineas, type DetalleLinea, type ProductoUnidad } from './productosUnidad.js';
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
// "Ubicación de la unidad": dónde está la unidad dentro del predio del cliente (campo de Odoo Studio, tipo char).
const UBICACION_FIELD = 'x_studio_ubicacin_de_la_unidad';

// El campo es de Odoo Studio: puede existir en una base (staging) y no en otra (producción). Pedirle a Odoo un campo que no
// existe hace fallar TODA la lectura, así que antes se consulta una vez si existe y se agrega a la lista solo si está. El
// resultado se recuerda unos minutos; si la consulta falla, se asume que no está (la agenda sigue funcionando sin ubicación).
const UBICACION_CACHE_MS = 10 * 60_000;
let ubicacionDisponible: { valor: boolean; hasta: number } | null = null;

async function conUbicacion(fields: string[]): Promise<string[]> {
  if (!ubicacionDisponible || ubicacionDisponible.hasta < Date.now()) {
    let valor = false;
    try {
      const def = (await withTimeout(executeKw('project.task', 'fields_get', [[UBICACION_FIELD]], { attributes: ['type'] }), 'ubicacionFieldCheck')) as Record<string, unknown>;
      valor = UBICACION_FIELD in def;
    } catch (err) {
      console.error('UBICACION_FIELD_CHECK_FAILED', err);
    }
    ubicacionDisponible = { valor, hasta: Date.now() + UBICACION_CACHE_MS };
  }
  return ubicacionDisponible.valor ? [...fields, UBICACION_FIELD] : fields;
}
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
  // Campo "Ubicación de la unidad" de la subtarea en Odoo (x_studio_ubicacin_de_la_unidad). null si está vacío.
  ubicacion: string | null;
  odooUrl: string;
  // Otras tareas reales de Odoo que se colapsaron en esta (mismo `name` +
  // mismo padre — ver ALCANCE_BACKOFFICE.md §15.9b, ej. instalar GPS + RFID
  // en la misma patente termina siendo 2 project.task con el mismo nombre).
  // `id` de arriba es siempre la de menor id del grupo (determinístico); acá
  // van las demás, para poder cerrarlas todas cuando el técnico resuelve la
  // unidad (ver markTaskStageHecho en conformidades.controller.ts). Vacío
  // cuando no hubo colapso.
  mergedTaskIds: number[];
  // `sale_line_id` de cada tarea del grupo (cuando está cargado — no siempre,
  // ver §14.4 nota 2026-09-25). Informativo: qué producto(s) de la cotización
  // corresponden a esta unidad, tal como coordinación lo cargó en Odoo.
  productos: ProductoUnidad[];
  // Qué se espera instalar/retirar en esta unidad según sus productos (mapeo en config/productoMapeo.ts). null =
  // no se pudo calcular (Odoo no respondió al leer las líneas): la PWA no restringe nada en ese caso.
  esperado: EsperadoUnidad | null;
  // Tipo de servicio que la PWA precarga para esta unidad (por producto o por etiqueta de la tarea); null = sin dato.
  tipoServicioSugerido: SugerenciaTipoServicio | null;
}

export interface CalendarTask {
  id: number;
  // Identifica sin ambigüedad ESTA franja puntual (`${id}:${start}:${end}`) —
  // con el split por fecha real de abajo, el mismo `id` de Odoo puede
  // aparecer en más de una CalendarTask a la vez (una por cada fecha real
  // distinta entre sus subtareas). Los frontends usan esto como key de React
  // y como identidad de estado (drag, banner "en curso"), nunca `id` solo.
  occurrenceKey: string;
  // true cuando esta franja NO es la fecha propia de la tarea padre en Odoo
  // — nació de que 1+ subtareas del lote se reprogramaron a una fecha
  // distinta al resto (ver listCalendarTasks). El panel la muestra de solo
  // lectura (no se puede arrastrar): para reprogramarla más hay que usar
  // Incidencias → Reprogramar, que sabe exactamente qué subtarea mover.
  isSplitOccurrence: boolean;
  title: string;
  start: string;
  end: string | null;
  technicianId: number | null;
  technicianName: string | null;
  partnerName: string | null;
  stage: string | null;
  description: string | null;
  // "Ubicación de la unidad" de una tarea suelta (sin subtareas); null en un lote.
  ubicacion: string | null;
  odooUrl: string;
  subtaskCount: number;
  subtasks: CalendarSubtask[];
  // El helpdesk.ticket del que nace esta tarea de FSM, cuando existe — no
  // todas las tareas vienen de un ticket (ver discoverHelpdeskTaskLink.ts):
  // algunas se agendan directo desde una orden de venta. La agenda de la PWA
  // lo usa para precargar el vínculo a Odoo del PRE sin que el técnico tenga
  // que volver a buscarlo.
  ticketOdoo: { id: number; label: string } | null;
  // Solo para tareas SIN subtareas (la unidad es la tarea misma): sus productos y lo esperado. En un lote van vacíos y
  // cada unidad trae los suyos en `subtasks`.
  productos: ProductoUnidad[];
  esperado: EsperadoUnidad | null;
  // project.tags de la tarea (ids) y el tipo de servicio que la PWA precarga a partir de ellas y de los productos. En
  // un lote cada unidad trae el suyo en `subtasks`; este vale para una tarea suelta.
  etiquetaIds: number[];
  tipoServicioSugerido: SugerenciaTipoServicio | null;
  // id del cliente (res.partner) de la tarea y su teléfono de contacto (del ticket o, si no hay, del cliente en Odoo):
  // para llamarlo si no está en el lugar. null = sin teléfono cargado en ninguno de los dos.
  partnerId: number | null;
  contactoCliente: ContactoCliente | null;
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
// de una app específica, que varían según versión/menú instalado). Exportada
// porque otros lugares del panel (ej. incidencias de subtareas no
// encontradas) también necesitan armar el mismo link a partir de un id de
// project.task sin duplicar la lógica.
export function odooTaskUrl(id: number): string {
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

// Campo de texto de Odoo: `false` cuando está vacío.
function textoOpcional(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
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

const PARENT_FIELDS = [
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
  'sale_line_id',
  'tag_ids',
  START_FIELD,
  END_FIELD,
];

// Sin cache — el calendario necesita ver cambios reales de Odoo (sync en
// vivo, sin capa de persistencia propia para las tareas).
//
// Arma una CalendarTask por cada fecha real distinta entre las subtareas de
// un lote, no una sola por tarea padre (ver comentario largo en
// resolveSubtasksRaw/collapseDuplicateNames): cuando coordinación reprograma
// 1+ unidades a una fecha distinta al resto del lote (`resolveSubtareaIncidencia`
// en subtareaIncidencia.controller.ts ya escribe esa fecha en la subtarea),
// antes esa unidad quedaba invisible en la agenda — el calendario solo leía
// la fecha de la tarea padre. Ahora cada grupo de subtareas que comparte una
// misma (start,end) exacta se muestra como su propia entrada, en el día que
// le corresponde.
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

    const primaryRows = (await withTimeout(
      executeKw('project.task', 'search_read', [domain], {
        fields: await conUbicacion(PARENT_FIELDS),
        order: `${START_FIELD} asc`,
        limit: 500,
      }),
      'listCalendarTasks',
    )) as Array<Record<string, unknown>>;

    const primaryRawSubtasks = await resolveSubtasksRaw(primaryRows.flatMap((r) => (r.child_ids as number[]) ?? []));
    const knownSubtaskIds = new Set(primaryRawSubtasks.map((s) => s.id));
    // Hijos cuya PROPIA fecha cae en el rango pedido aunque la de su tarea
    // padre no (la unidad se reprogramó semanas después de la visita
    // original, que puede haber quedado en una semana vieja fuera de vista).
    const driftedRawSubtasks = await resolveDriftedChildrenRaw(params.from, params.to, projectIds, knownSubtaskIds);

    const rawByParent = new Map<number, RawSubtask[]>();
    for (const s of [...primaryRawSubtasks, ...driftedRawSubtasks]) {
      if (s.parentId === null) continue;
      const list = rawByParent.get(s.parentId);
      if (list) list.push(s);
      else rawByParent.set(s.parentId, [s]);
    }

    const parentRowsById = new Map<number, Record<string, unknown>>(primaryRows.map((r) => [r.id as number, r]));
    const primaryParentIds = new Set(parentRowsById.keys());

    // Tareas padre que solo aparecieron por tener un hijo a la deriva — no
    // vinieron en primaryRows por definición (si hubieran venido, no serían
    // "a la deriva"), así que hace falta un read aparte para sus datos.
    const missingParentIds = Array.from(rawByParent.keys()).filter((id) => !parentRowsById.has(id));
    if (missingParentIds.length) {
      const driftedParentRows = (await withTimeout(
        executeKw('project.task', 'read', [missingParentIds], { fields: await conUbicacion(PARENT_FIELDS) }),
        'listCalendarTasks:driftedParents',
      )) as Array<Record<string, unknown>>;
      for (const r of driftedParentRows) parentRowsById.set(r.id as number, r);
    }

    const allParentIds = new Set<number>([...primaryParentIds, ...rawByParent.keys()]);
    const result: CalendarTask[] = [];

    for (const parentId of allParentIds) {
      const parentRow = parentRowsById.get(parentId);
      if (!parentRow) continue;

      // Un padre que solo apareció por tener un hijo a la deriva (ver
      // missingParentIds arriba) puede no tener su propia fecha cargada —
      // domain solo garantiza START_FIELD seteado para primaryRows, no para
      // estos. Sin esto, computeTaskEnd(false, ...) tiraba
      // "s.replace is not a function" y tumbaba el proceso (502 en la PWA) al
      // navegar a un día con una unidad reprogramada cuyo padre nunca tuvo
      // fecha propia.
      const parentStartRaw = parentRow[START_FIELD] as string | false;
      const parentStart = parentStartRaw || null;
      const parentEnd = parentStart
        ? computeTaskEnd(parentStart, parentRow[END_FIELD] as string | false, (parentRow.allocated_hours as number) || 0)
        : null;
      const parentHasChildren = ((parentRow.child_ids as number[]) ?? []).length > 0;

      // Agrupa por (start,end) EXACTO, no solo start: una unidad reprogramada
      // a la misma fecha del padre pero con otra duración tiene que verse con
      // SU horario, no fusionarse mostrando el del padre.
      const occurrences = new Map<string, GroupedSubtask[]>();
      // Tarea suelta (sin subtareas reales) — sigue mostrando una entrada
      // aunque no tenga nada colgado, igual que antes de este cambio. Solo
      // aplica a tareas de la consulta principal: una tarea que apareció acá
      // nada más que por un hijo a la deriva nunca tuvo entrada "propia" en
      // este rango.
      // parentStart/parentEnd están garantizados acá: primaryRows solo entran
      // por domain con START_FIELD en rango, así que nunca es null para un
      // parentId que está en primaryParentIds.
      if (primaryParentIds.has(parentId) && !parentHasChildren) {
        occurrences.set(`${parentStart}|${parentEnd}`, []);
      }
      for (const g of collapseDuplicateNames(rawByParent.get(parentId) ?? [], parentStart)) {
        const key = `${g.start}|${g.end}`;
        const list = occurrences.get(key);
        if (list) list.push(g);
        else occurrences.set(key, [g]);
      }

      for (const [key, subtasksForOccurrence] of occurrences) {
        const [occStart, occEnd] = key.split('|');
        if (!(occStart >= params.from && occStart < params.to)) continue; // fuera del rango pedido

        // Mismo criterio de "técnico asignado a la unidad, o sin reparto
        // propio así que hereda el acceso del lote" que ya existía — ver
        // comentario largo debajo, en resolveDriftedChildrenRaw.
        const filtered = params.technicianIds?.length
          ? subtasksForOccurrence.filter(
              (s) => s.technicianIds.length === 0 || s.technicianIds.some((id) => params.technicianIds!.includes(id)),
            )
          : subtasksForOccurrence;
        // Una tarea suelta (parentHasChildren=false) sigue mostrándose aunque
        // filtered quede vacío — nunca tuvo subtareas que filtrar, y ya pasó
        // el domain de arriba por asignación propia. Un lote sin ninguna
        // unidad propia del técnico en ESTA franja, en cambio, no aporta nada.
        if (parentHasChildren && params.technicianIds?.length && !filtered.length) continue;

        result.push({
          id: parentId,
          occurrenceKey: `${parentId}:${occStart}:${occEnd}`,
          // parentStart null (padre sin fecha propia, ver arriba) => nunca hay
          // ventana propia con la que comparar, así que toda ocurrencia es split.
          isSplitOccurrence: !(parentStart !== null && occStart === parentStart && occEnd === parentEnd),
          title: parentRow.name as string,
          start: occStart,
          end: occEnd,
          technicianId: (parentRow.user_ids as number[])[0] ?? null,
          technicianName: (parentRow.user_names as string) || null,
          partnerName: many2oneName(parentRow.partner_id),
          stage: many2oneName(parentRow.stage_id),
          description: stripHtml(parentRow.description as string | false),
          // Solo para tarea suelta: en un lote, cada unidad trae la suya (ver CalendarSubtask.ubicacion).
          ubicacion: parentHasChildren ? null : textoOpcional(parentRow[UBICACION_FIELD]),
          odooUrl: odooTaskUrl(parentId),
          subtaskCount: filtered.length,
          subtasks: filtered.map(toCalendarSubtask),
          ticketOdoo: many2oneRef(parentRow.helpdesk_ticket_id),
          productos: parentHasChildren ? [] : productosDeLinea(many2oneRef(parentRow.sale_line_id)),
          esperado: null,
          etiquetaIds: Array.isArray(parentRow.tag_ids) ? (parentRow.tag_ids as number[]) : [],
          tipoServicioSugerido: null,
          partnerId: many2oneRef(parentRow.partner_id)?.id ?? null,
          contactoCliente: null,
        });
      }
    }

    await completarProductos(result);
    completarTipoServicio(result);
    await completarContacto(result);

    return result.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  } catch (err) {
    throw classify(err);
  }
}

// Teléfono del cliente por tarea: una consulta a los tickets y, solo para los que no tienen teléfono propio, otra a los
// clientes. Best-effort: si Odoo falla, las tareas quedan sin contacto y la agenda sigue funcionando.
async function completarContacto(tareas: CalendarTask[]): Promise<void> {
  try {
    const ticketIds = [...new Set(tareas.map((t) => t.ticketOdoo?.id).filter((x): x is number => typeof x === 'number'))];
    const telDeTicket = new Map<number, string | false>();
    if (ticketIds.length) {
      const rows = (await withTimeout(
        executeKw('helpdesk.ticket', 'read', [ticketIds], { fields: ['partner_phone'] }),
        'completarContacto:tickets',
      )) as Array<{ id: number; partner_phone: string | false }>;
      for (const r of rows) telDeTicket.set(r.id, r.partner_phone);
    }
    const sinTelDeTicket = tareas.filter((t) => !limpiarTelefono(t.ticketOdoo ? telDeTicket.get(t.ticketOdoo.id) : null) && t.partnerId != null);
    const partnerIds = [...new Set(sinTelDeTicket.map((t) => t.partnerId as number))];
    const clientes = new Map<number, { mobile: string | false; phone: string | false }>();
    if (partnerIds.length) {
      const rows = (await withTimeout(
        executeKw('res.partner', 'read', [partnerIds], { fields: ['mobile', 'phone'] }),
        'completarContacto:clientes',
      )) as Array<{ id: number; mobile: string | false; phone: string | false }>;
      for (const r of rows) clientes.set(r.id, r);
    }
    for (const t of tareas) {
      const c = t.partnerId != null ? clientes.get(t.partnerId) : undefined;
      t.contactoCliente = elegirContacto({
        ticketPhone: t.ticketOdoo ? telDeTicket.get(t.ticketOdoo.id) : null,
        partnerMobile: c?.mobile,
        partnerPhone: c?.phone,
      });
    }
  } catch (err) {
    console.error('CALENDAR_CONTACTO_FAILED', err);
  }
}

function productosDeLinea(linea: { id: number; label: string } | null): ProductoUnidad[] {
  return linea ? [{ id: linea.id, label: linea.label, productId: null, cantidad: null }] : [];
}

// Lee en Odoo el producto y la cantidad de cada línea de venta (una sola consulta por tanda) y calcula lo esperado
// por unidad. Best-effort: si falla, las unidades quedan con `esperado: null` y la agenda sigue funcionando.
async function completarProductos(tareas: CalendarTask[]): Promise<void> {
  const ids = idsDeLineas(tareas);
  if (ids.length === 0) {
    aplicarEsperado(tareas, new Map());
    return;
  }
  try {
    const detalle = new Map<number, DetalleLinea>();
    for (let i = 0; i < ids.length; i += 200) {
      const rows = (await withTimeout(
        executeKw('sale.order.line', 'read', [ids.slice(i, i + 200)], { fields: ['product_id', 'product_uom_qty'] }),
        'completarProductos',
      )) as Array<{ id: number; product_id: [number, string] | false; product_uom_qty: number }>;
      for (const r of rows) detalle.set(r.id, { productId: r.product_id ? r.product_id[0] : null, cantidad: r.product_uom_qty });
    }
    aplicarEsperado(tareas, detalle);
  } catch (err) {
    console.error('CALENDAR_PRODUCTOS_FAILED', err);
  }
}

// Tipo de servicio sugerido por unidad: primero por sus productos y, si no alcanza, por las etiquetas de la tarea.
// En un lote las etiquetas están en la tarea padre y valen para todas sus unidades.
function completarTipoServicio(tareas: CalendarTask[]): void {
  for (const t of tareas) {
    t.tipoServicioSugerido = sugerirTipoServicio(t.esperado, t.etiquetaIds);
    for (const s of t.subtasks) s.tipoServicioSugerido = sugerirTipoServicio(s.esperado, t.etiquetaIds);
    marcarCambioUnidad(t.subtasks);
  }
}

// Una misma unidad física a veces se carga en Odoo como 2+ project.task con
// el mismo `name` (ej. instalar GPS + RFID en la patente "QEW233" — ver
// ALCANCE_BACKOFFICE.md §15.9b, confirmado contra producción 2026-09-25). Sin
// esto, el técnico vería "QEW233" dos veces en la agenda y podría terminar
// generando 2 hojas de Conformidad para la misma unidad. Se agrupa acá, antes
// de exponerle nada a la PWA, para que TODO lo que consume subtareas
// (agenda, Conformidad.subtareaOdoo, incidencias, autoclose de lote) trabaje
// siempre con un único id "primario" por unidad — el de menor id del grupo,
// determinístico. Los ids que quedan afuera se guardan en `mergedTaskIds`
// solo para poder cerrarlos en Odoo (son registros reales, cada uno necesita
// su propio `state`).
interface RawSubtask {
  id: number;
  name: string;
  stage: string | null;
  technicianName: string | null;
  technicianIds: number[];
  isClosed: boolean;
  description: string | null;
  ubicacion: string | null;
  saleLine: { id: number; label: string } | null;
  // Fecha propia de ESTA subtarea (ver listCalendarTasks) — no siempre
  // coincide con la del padre: reprogramar una unidad desde Incidencias
  // escribe la fecha nueva acá, no en la tarea padre. `false` cuando viene de
  // resolveSubtasksRaw (hijos de un padre ya en rango, leídos sin filtro de
  // fecha propia) y la subtarea nunca se reprogramó individualmente — en ese
  // caso hereda el horario del padre, ver collapseDuplicateNames. No puede
  // ser false cuando viene de resolveDriftedChildrenRaw: ese domain exige
  // START_FIELD seteado.
  start: string | false;
  end: string | false;
  allocatedHours: number;
  parentId: number | null;
}

// Campos comunes a cualquier lectura de subtareas, vengan de resolveSubtasksRaw
// (hijos de una tarea padre ya conocida) o de resolveDriftedChildrenRaw
// (hijos sueltos cuya propia fecha cae en rango).
const SUBTASK_FIELDS = [
  'id',
  'name',
  'stage_id',
  'user_names',
  'user_ids',
  'parent_id',
  'is_closed',
  'description',
  'sale_line_id',
  'allocated_hours',
  START_FIELD,
  END_FIELD,
];

function mapOdooRowToRawSubtask(s: Record<string, unknown>): RawSubtask {
  const parentId = (s.parent_id as [number, string] | false) || null;
  return {
    id: s.id as number,
    name: s.name as string,
    stage: many2oneName(s.stage_id),
    technicianName: (s.user_names as string) || null,
    technicianIds: (s.user_ids as number[]) || [],
    isClosed: !!s.is_closed,
    description: stripHtml(s.description as string | false),
    ubicacion: textoOpcional(s[UBICACION_FIELD]),
    saleLine: many2oneRef(s.sale_line_id),
    start: s[START_FIELD] as string | false,
    end: s[END_FIELD] as string | false,
    allocatedHours: (s.allocated_hours as number) || 0,
    parentId: parentId ? parentId[0] : null,
  };
}

// GroupedSubtask = una CalendarSubtask (lo que ve el frontend) + su (start,end)
// ya resuelto — solo hace falta puertas adentro de listCalendarTasks, para
// agrupar por fecha real; toCalendarSubtask() lo despoja antes de exponerlo.
interface GroupedSubtask extends CalendarSubtask {
  start: string;
  end: string;
}

function toCalendarSubtask(g: GroupedSubtask): CalendarSubtask {
  return {
    id: g.id,
    name: g.name,
    stage: g.stage,
    technicianName: g.technicianName,
    technicianIds: g.technicianIds,
    isClosed: g.isClosed,
    description: g.description,
    ubicacion: g.ubicacion,
    odooUrl: g.odooUrl,
    mergedTaskIds: g.mergedTaskIds,
    productos: g.productos,
    esperado: g.esperado,
    tipoServicioSugerido: g.tipoServicioSugerido,
  };
}

// Una misma unidad física a veces se carga en Odoo como 2+ project.task con
// el mismo `name` (ej. instalar GPS + RFID en la patente "QEW233" — ver
// ALCANCE_BACKOFFICE.md §15.9b, confirmado contra producción 2026-09-25). Sin
// esto, el técnico vería "QEW233" dos veces en la agenda y podría terminar
// generando 2 hojas de Conformidad para la misma unidad. Se agrupa acá, antes
// de exponerle nada a la PWA, para que TODO lo que consume subtareas
// (agenda, Conformidad.subtareaOdoo, incidencias, autoclose de lote) trabaje
// siempre con un único id "primario" por unidad — el de menor id del grupo,
// determinístico. Los ids que quedan afuera se guardan en `mergedTaskIds`
// solo para poder cerrarlos en Odoo (son registros reales, cada uno necesita
// su propio `state`). Asume que todo el grupo comparte la misma fecha — cierto
// en la práctica: reprogramar mueve TODOS los ids colapsados juntos (ver
// resolveSubtareaIncidencia), así que alcanza con tomar la del primario.
//
// `parentStart` es el fallback para subtareas sin fecha propia: las que
// vienen de resolveSubtasksRaw (hijas de un padre que ya matcheó por SU
// propia fecha) se leen sin filtro sobre su propia START_FIELD, así que una
// que nunca se reprogramó individualmente trae `false` ahí — en ese caso
// corre bajo el horario del padre, no el suyo. Las que vienen de
// resolveDriftedChildrenRaw siempre traen fecha propia real (domain la
// exige), así que nunca necesitan este fallback. Garantizado no-null en ese
// caso: `parentStart` solo es null para un padre que apareció nada más que
// por un hijo a la deriva, y esos nunca aportan subtareas de
// resolveSubtasksRaw (ver listCalendarTasks).
function collapseDuplicateNames(subtasks: RawSubtask[], parentStart: string | null): GroupedSubtask[] {
  const groups = new Map<string, RawSubtask[]>();
  for (const s of subtasks) {
    const list = groups.get(s.name);
    if (list) list.push(s);
    else groups.set(s.name, [s]);
  }

  const result: GroupedSubtask[] = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => a.id - b.id);
    const [primary, ...rest] = sorted;
    const start = primary.start || parentStart;
    // No debería pasar (ver comentario arriba) — mejor perder esta unidad de
    // la agenda que tumbar el pedido completo del día por ella.
    if (!start) {
      console.error('CALENDAR_SUBTASK_SIN_FECHA', primary.id);
      continue;
    }
    const productos = sorted.flatMap((s) => productosDeLinea(s.saleLine));
    result.push({
      id: primary.id,
      name: primary.name,
      stage: primary.stage,
      // Si el técnico principal no tiene nombre propio cargado (ver comentario
      // en listCalendarTasks), se toma el primero del grupo que sí lo tenga.
      technicianName: primary.technicianName ?? sorted.find((s) => s.technicianName)?.technicianName ?? null,
      technicianIds: Array.from(new Set(sorted.flatMap((s) => s.technicianIds))),
      // Cerrada solo si TODAS las tareas reales del grupo lo están — si el
      // técnico ya instaló el GPS pero le falta el RFID, la unidad sigue
      // pendiente.
      isClosed: sorted.every((s) => s.isClosed),
      description: primary.description ?? sorted.find((s) => s.description)?.description ?? null,
      ubicacion: primary.ubicacion ?? sorted.find((s) => s.ubicacion)?.ubicacion ?? null,
      odooUrl: odooTaskUrl(primary.id),
      mergedTaskIds: rest.map((s) => s.id),
      productos,
      esperado: null,
      tipoServicioSugerido: null,
      start,
      end: computeTaskEnd(start, primary.end, primary.allocatedHours),
    });
  }
  return result;
}

// Batch único para todas las subtareas de la semana/día visible — evita
// decenas de consultas individuales (una por tarea padre con subtareas).
async function resolveSubtasksRaw(childIds: number[]): Promise<RawSubtask[]> {
  const uniqueIds = Array.from(new Set(childIds));
  if (!uniqueIds.length) return [];

  const subtasksRaw = (await withTimeout(
    executeKw('project.task', 'read', [uniqueIds], { fields: await conUbicacion(SUBTASK_FIELDS) }),
    'listCalendarTasks:subtasks',
  )) as Array<Record<string, unknown>>;

  return subtasksRaw.map(mapOdooRowToRawSubtask).filter((s) => s.parentId !== null);
}

// Hijos de CUALQUIER tarea padre (no solo las ya traídas por la consulta
// principal) cuya propia fecha cae en el rango pedido — el caso real: una
// unidad se reprograma semanas después de la visita original del lote, cuya
// tarea padre quedó con SU fecha vieja, fuera de la semana que se está
// mirando ahora. `excludeIds` evita traer de nuevo una subtarea que ya vino
// por resolveSubtasksRaw (su tarea padre YA estaba en rango, así que ya está
// cubierta ahí). Sin filtro de técnico en el domain — mismo criterio que el
// resto del archivo cuando una subtarea no tiene técnico propio cargado: se
// resuelve en código (listCalendarTasks), no acá.
async function resolveDriftedChildrenRaw(
  from: string,
  to: string,
  projectIds: number[],
  excludeIds: Set<number>,
): Promise<RawSubtask[]> {
  const domain = [
    ['project_id', 'in', projectIds],
    ['parent_id', '!=', false],
    [START_FIELD, '>=', from],
    [START_FIELD, '<', to],
  ];
  const rows = (await withTimeout(
    executeKw('project.task', 'search_read', [domain], { fields: await conUbicacion(SUBTASK_FIELDS), limit: 500 }),
    'listCalendarTasks:driftedChildren',
  )) as Array<Record<string, unknown>>;

  return rows.map(mapOdooRowToRawSubtask).filter((s) => s.parentId !== null && !excludeIds.has(s.id));
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
    executeKw('project.task', 'read', [childIds], { fields: ['id', 'name', 'user_ids'] }),
    'getOwnSubtaskIds:children',
  )) as Array<{ id: number; name: string; user_ids?: number[] }>;

  // Mismo colapso por `name` que collapseDuplicateNames — si "QEW233" son 2
  // project.task reales, acá tienen que verse como UNA sola "propia" (el id
  // primario, menor id del grupo), porque es ese único id el que termina
  // guardado en Conformidad.subtareaOdoo.id. Sin esto, cerrarVisitaLoteSiTodoResuelto
  // (ver loteVisita.service.ts) esperaría por siempre una "propia" (la que
  // quedó fuera del grupo) que nunca va a tener su propia Conformidad.
  const groups = new Map<string, Array<{ id: number; assigned: boolean }>>();
  for (const c of childRows) {
    const entry = { id: c.id, assigned: (c.user_ids ?? []).includes(technicianOdooId) };
    const list = groups.get(c.name);
    if (list) list.push(entry);
    else groups.set(c.name, [entry]);
  }

  const ownPrimaryIds: number[] = [];
  for (const group of groups.values()) {
    if (!group.some((g) => g.assigned)) continue;
    const primaryId = Math.min(...group.map((g) => g.id));
    ownPrimaryIds.push(primaryId);
  }
  return ownPrimaryIds;
}

// Todas las unidades (subtareas) de un lote, sin importar a quién estén asignadas — mismo colapso por `name` que
// getOwnSubtaskIds (el id primario, menor id del grupo, es el que queda guardado en Conformidad.subtareaOdoo.id).
// [] si la tarea no tiene subtareas (tarea suelta); null si Odoo no encuentra la tarea (no se puede saber).
export async function getAllSubtaskIds(parentTaskId: number): Promise<number[] | null> {
  const parentRows = (await withTimeout(
    executeKw('project.task', 'read', [[parentTaskId]], { fields: ['id', 'child_ids'] }),
    'getAllSubtaskIds:parent',
  )) as Array<{ child_ids?: number[] }>;
  if (!parentRows.length) return null;
  const childIds = parentRows[0]?.child_ids ?? [];
  if (!childIds.length) return [];
  const childRows = (await withTimeout(
    executeKw('project.task', 'read', [childIds], { fields: ['id', 'name'] }),
    'getAllSubtaskIds:children',
  )) as Array<{ id: number; name: string }>;
  const primarios = new Map<string, number>();
  for (const ch of childRows) primarios.set(ch.name, Math.min(ch.id, primarios.get(ch.name) ?? ch.id));
  return [...primarios.values()];
}

// Para el chequeo de pertenencia de visitas.controller.ts: ¿esta tarea (o
// alguna de sus subtareas) está asignada a este técnico? Mismo criterio que
// el domain de listCalendarTasks (user_ids de la tarea O de cualquier
// child_ids), pero resuelto puntual para un solo id en vez de un rango de
// fechas — no cacheado a propósito, es un chequeo de autorización.
export async function isTaskAssignedToTechnician(taskId: number, technicianOdooId: number): Promise<boolean> {
  try {
    const rows = (await withTimeout(
      executeKw('project.task', 'read', [[taskId]], { fields: ['user_ids', 'child_ids'] }),
      'isTaskAssignedToTechnician:task',
    )) as Array<{ user_ids: number[]; child_ids: number[] }>;

    const task = rows[0];
    if (!task) return false;
    if (task.user_ids.includes(technicianOdooId)) return true;
    if (!task.child_ids.length) return false;

    const children = (await withTimeout(
      executeKw('project.task', 'read', [task.child_ids], { fields: ['user_ids'] }),
      'isTaskAssignedToTechnician:children',
    )) as Array<{ user_ids: number[] }>;
    return children.some((c) => c.user_ids.includes(technicianOdooId));
  } catch (err) {
    throw classify(err);
  }
}

// Para el handoff de una hoja cambio_equipo pendiente de POST (ver
// isAssignedToPendingSwap en conformidades.controller.ts): a diferencia de
// isTaskAssignedToTechnician, acá interesa UNA subtarea puntual, no "cualquier
// hijo de la tarea" — dos unidades de un mismo lote pueden estar asignadas a
// técnicos distintos y no queremos que compartir la tarea padre alcance para
// destrabar el acceso a la hoja de otra unidad.
export async function isSubtaskAssignedToTechnician(subtaskId: number, technicianOdooId: number): Promise<boolean> {
  try {
    const rows = (await withTimeout(
      executeKw('project.task', 'read', [[subtaskId]], { fields: ['user_ids'] }),
      'isSubtaskAssignedToTechnician',
    )) as Array<{ user_ids: number[] }>;
    return (rows[0]?.user_ids ?? []).includes(technicianOdooId);
  } catch (err) {
    throw classify(err);
  }
}

// project.task.state (Estado) — NO es stage_id (la columna del kanban tipo
// Nuevo/Hecho que ya usa many2oneName en este archivo): son dos campos
// nativos totalmente distintos en esta versión de Odoo. `state` es el que
// arma el dropdown que ve coordinación en la vista de tareas — confirmado
// contra la instancia real. Es un campo selection nativo de Odoo (Project
// 17+), así que estos 6 son TODOS los valores que existen, no hay forma de
// sumar uno propio (ej. "No encontrada") sin Studio:
//   01_in_progress       En progreso
//   02_changes_requested Cambios solicitados
//   03_approved          Aprobada
//   1_done                Hecha
//   1_canceled            Cancelada
//   04_waiting_normal     En espera
type OdooTaskState = '01_in_progress' | '02_changes_requested' | '03_approved' | '1_done' | '1_canceled' | '04_waiting_normal';

// Best-effort a propósito, mismo criterio que cerrarVisitaLoteSiTodoResuelto:
// si Odoo está caído o el campo no existe en alguna instancia, nunca debe
// romper el flujo del técnico — como mucho, alguien lo actualiza a mano.
// Nunca pisa un estado terminal (Hecha/Cancelada) — ni una hoja completada
// tarde ni un "no encontrada" reportado después deben revivir una subtarea
// que coordinación ya cerró de un lado o del otro.
async function setTaskState(taskId: number, state: OdooTaskState, logTag: string): Promise<void> {
  try {
    const rows = (await withTimeout(executeKw('project.task', 'read', [[taskId]], { fields: ['state'] }), `${logTag}:read`)) as Array<{
      state: string;
    }>;
    const current = rows[0]?.state;
    if (current === state || current === '1_done' || current === '1_canceled') return;

    await withTimeout(executeKw('project.task', 'write', [[taskId], { state }]), `${logTag}:write`);
  } catch (err) {
    console.error(`ODOO_${logTag}_FAILED`, taskId, err);
  }
}

// El técnico reporta desde la agenda que la unidad no estaba físicamente en
// el lugar (ver createSubtareaIncidencia en subtareaIncidencia.controller.ts,
// que ya deja un comentario + una actividad de recordatorio para
// coordinación) — "En espera" la distingue de un vistazo de una que sigue
// "En progreso" sin que nadie la haya tocado, mientras sigue visible en la
// agenda/panel igual que cualquier otra (nada acá filtra por `state`).
export async function markTaskWaiting(taskId: number): Promise<void> {
  await setTaskState(taskId, '04_waiting_normal', 'MARK_TASK_WAITING');
}

// El técnico termina el trabajo físico de una unidad (hoja de conformidad
// completa) — pone `state` en "Hecha" (el circulito que ve coordinación en la
// vista de tareas, distinto de `stage_id`/columna del Kanban, ver
// markTaskStageHecho más abajo). Es el técnico quien dispara esto, no
// coordinación: a diferencia de `stage_id`, acá NO hay un paso de aprobación
// manual pendiente — coordinación revisa y aprueba moviendo la tarjeta del
// Kanban a "Hecho con Producto" (otra etapa, fuera del alcance de este
// código), no reabriendo el `state` de la tarea.
export async function markTaskStateHecho(taskId: number): Promise<void> {
  await setTaskState(taskId, '1_done', 'MARK_TASK_STATE_HECHO');
}

// Mismo momento que markTaskWaiting (unidad reportada "no encontrada") — pero
// en `stage_id`, la columna del Kanban: mueve la tarjeta a "Visita fallida"
// para que coordinación la vea ahí de un vistazo, además del recordatorio
// puntual que ya deja scheduleSubtareaReprogramarActivity.
export async function markTaskStageVisitaFallida(taskId: number): Promise<void> {
  await moveTaskToStage(taskId, STAGE_ID_VISITA_FALLIDA, 'MARK_TASK_STAGE_VISITA_FALLIDA');
}

// project.task.stage_id (la columna del Kanban de Field Service que
// coordinación efectivamente mira para dar el check manual) — distinto de
// `state` de arriba. Confirmados contra la instancia real (script de solo
// lectura scripts/discoverOdooStages.ts, 2026-09-25), en uso activo hoy en
// los 5 proyectos de Servicio Externo (WARA/Bs As/Computecnia/Gustavo
// Flores/San Juan).
const STAGE_ID_HECHO = 2;
const STAGE_ID_VISITA_FALLIDA = 379;

// Etapas tipo "cancelación" que coordinación pudo haber puesto a mano — no
// hay que pisarlas silenciosamente si la hoja se termina de completar (o la
// unidad se reporta no encontrada) después (mismo criterio que el guard de
// 1_done/1_canceled en setTaskState). Solo confirmadas linkeadas al proyecto
// "Servicio externo (WARA)" hoy, pero se chequean para cualquier proyecto
// igual.
const CANCEL_LIKE_STAGE_IDS = new Set([377, 378, STAGE_ID_VISITA_FALLIDA]); // Cancelada / Cancelada por el cliente / Visita fallida

async function moveTaskToStage(taskId: number, stageId: number, logTag: string): Promise<void> {
  try {
    const rows = (await withTimeout(executeKw('project.task', 'read', [[taskId]], { fields: ['stage_id'] }), `${logTag}:read`)) as Array<{
      stage_id: [number, string] | false;
    }>;
    const currentId = rows[0]?.stage_id ? rows[0].stage_id[0] : null;
    if (currentId === stageId || (currentId !== null && CANCEL_LIKE_STAGE_IDS.has(currentId))) return;

    await withTimeout(executeKw('project.task', 'write', [[taskId], { stage_id: stageId }]), `${logTag}:write`);
  } catch (err) {
    console.error(`ODOO_${logTag}_FAILED`, taskId, err);
  }
}

// El técnico termina el trabajo físico de una unidad en el celular (hoja de
// conformidad completa), pero eso solo vive en Mongo hasta que alguien mueve
// la tarjeta a mano en Odoo — este helper mueve la subtarea a la columna
// "Hecho" del Kanban apenas se completa la hoja (ver patchConformidad en
// conformidades.controller.ts, que la llama), para que coordinación la vea
// ahí y revise. A propósito NO toca `state` (la pastilla verde "Hecha" del
// formulario): ese campo lo dispara Odoo solo cuando coordinación, después de
// revisar, mueve la tarjeta a "Hecho con Producto" — es el paso de
// aprobación manual, no algo que el técnico deba disparar con solo terminar
// su parte.
export async function markTaskStageHecho(taskId: number): Promise<void> {
  await moveTaskToStage(taskId, STAGE_ID_HECHO, 'MARK_TASK_STAGE_HECHO');
}

// Cuando TODAS las unidades de un lote terminan en la MISMA columna del
// Kanban (todas "Hecho", o todas "Visita fallida"), la tarea PADRE (el lote
// en sí, ej. "Tarea Instalación GPS + BP - S03933") pasa a esa misma columna
// — no solo la subtarea puntual que acaba de cambiar. A propósito NO reusa
// getOwnSubtaskIds/"propias" de cerrarVisitaLoteSiTodoResuelto (eso escopea
// por técnico, útil para cerrar SU visita en la agenda) — acá hace falta
// mirar TODOS los hijos reales de la tarea en Odoo (puede haber más de un
// técnico en el mismo lote), así que se lee child_ids directo. A propósito
// exige que TODOS coincidan en la MISMA etapa (no "todos resueltos de
// cualquier forma"): un lote con unidades en etapas distintas (ej. una
// "Hecho" y otra "Visita fallida") queda sin tocar — coordinación tiene que
// verlo y decidir, no hay una única etapa que represente bien ese mix.
async function markParentStageIfAllChildrenInStage(parentTaskId: number, targetStageId: number, logTag: string): Promise<void> {
  try {
    const parentRows = (await withTimeout(
      executeKw('project.task', 'read', [[parentTaskId]], { fields: ['child_ids'] }),
      `${logTag}:read_parent`,
    )) as Array<{ child_ids: number[] }>;
    const childIds = parentRows[0]?.child_ids ?? [];
    if (!childIds.length) return; // tarea suelta, sin subtareas — no es un lote

    const children = (await withTimeout(
      executeKw('project.task', 'read', [childIds], { fields: ['stage_id'] }),
      `${logTag}:read_children`,
    )) as Array<{ stage_id: [number, string] | false }>;
    const allSameStage = children.every((c) => (c.stage_id ? c.stage_id[0] : null) === targetStageId);
    if (!allSameStage) return;

    await moveTaskToStage(parentTaskId, targetStageId, logTag);
  } catch (err) {
    console.error(`ODOO_${logTag}_FAILED`, parentTaskId, err);
  }
}

export async function markParentStageHechoIfAllChildrenResolved(parentTaskId: number): Promise<void> {
  await markParentStageIfAllChildrenInStage(parentTaskId, STAGE_ID_HECHO, 'PARENT_LOTE_STAGE_HECHO');
}

// Simétrico al de arriba: si TODAS las unidades del lote se reportaron "no
// encontrada" (todas en "Visita fallida"), el lote entero se ve igual desde
// el Kanban en vez de quedar "Nuevo" para siempre esperando que alguien lo
// note.
export async function markParentStageVisitaFallidaIfAllChildrenFailed(parentTaskId: number): Promise<void> {
  await markParentStageIfAllChildrenInStage(parentTaskId, STAGE_ID_VISITA_FALLIDA, 'PARENT_LOTE_STAGE_VISITA_FALLIDA');
}

// Etapa "Nuevo" del Kanban — confirmada contra la instancia real
// (discoverOdooStages.ts, 2026-09-25). Target de reopenTask de abajo.
const STAGE_ID_NUEVO = 1;

// Cuando coordinación reprograma una visita fallida (ver
// resolveSubtareaIncidencia en subtareaIncidencia.controller.ts), la subtarea
// tiene que volver a un estado "activo" además de tener fecha nueva — si no,
// aunque tenga fecha, coordinación la sigue viendo como "Visita fallida"/"En
// espera" en Odoo. A propósito NO reusa moveTaskToStage (ese tiene el guard
// que bloquea pisar una etapa de cancelación a propósito, para no revivir
// algo que coordinación cerró de otro lado) — acá es exactamente lo
// contrario: una acción explícita de coordinación para sacar la tarjeta DE
// una etapa de cancelación, así que el guard no aplica. No es best-effort:
// quien llama a esto (resolveSubtareaIncidencia) necesita saber si falló para
// no marcar la incidencia como resuelta sin que Odoo se haya movido de
// verdad.
export async function reopenTask(taskId: number): Promise<void> {
  await withTimeout(
    executeKw('project.task', 'write', [[taskId], { stage_id: STAGE_ID_NUEVO, state: '01_in_progress' }]),
    'REOPEN_TASK',
  );
}

// Si la tarea PADRE de un lote había quedado en "Visita fallida" (porque
// TODAS sus unidades habían fallado, ver
// markParentStageVisitaFallidaIfAllChildrenFailed), reprogramar una sola ya
// invalida esa premisa — hay que reabrirla también. Se chequea antes de
// escribir (a diferencia de reopenTask) para no pisar la etapa del padre si
// está ahí por otro motivo que no sea "todas fallaron".
export async function reopenParentIfVisitaFallida(parentTaskId: number): Promise<void> {
  const rows = (await withTimeout(executeKw('project.task', 'read', [[parentTaskId]], { fields: ['stage_id'] }), 'REOPEN_PARENT:read')) as Array<{
    stage_id: [number, string] | false;
  }>;
  const currentId = rows[0]?.stage_id ? rows[0].stage_id[0] : null;
  if (currentId !== STAGE_ID_VISITA_FALLIDA) return;

  await reopenTask(parentTaskId);
}

// Reasigna la subtarea reprogramada a otro técnico, si coordinación elige uno
// distinto al que reportó la incidencia — reemplaza la lista completa de
// user_ids (mismo patrón que scripts/createTestLoteTask.ts), no la suma.
export async function reassignTaskTechnician(taskId: number, odooUserId: number): Promise<void> {
  await withTimeout(
    executeKw('project.task', 'write', [[taskId], { user_ids: [[6, 0, [odooUserId]]] }]),
    'REASSIGN_TASK_TECHNICIAN',
  );
}

// Desde que listCalendarTasks arma una entrada por cada fecha real distinta
// entre las subtareas de un lote (ver el split más arriba), una subtarea
// reprogramada a su propia fecha YA se ve sola en la agenda del técnico sin
// que nadie más haga nada — esto ya no es necesario para que la unidad no
// quede invisible. Sigue siendo útil como prolijidad: cuando es seguro,
// fusiona la unidad reprogramada de vuelta en la MISMA entrada que el resto
// del lote en vez de dejarla como una entrada aparte (isSplitOccurrence).
// Seguro cuando esta es la ÚNICA unidad del lote que sigue activa (lote de
// una sola unidad, o el resto ya está Hecho/cancelada), O cuando el resto de
// las unidades activas YA fueron reprogramadas a esta misma fecha/hora (mismo
// reintento de visita, caso típico: coordinación reprograma todas las
// unidades falladas del lote juntas, a la misma fecha) — si queda alguna
// unidad activa en una fecha DISTINTA, mover el padre le rompería el turno a
// esa otra unidad, así que se deja sin tocar (esa unidad simplemente sigue
// viéndose en su propia entrada, gracias al split).
async function parentDateIsSafeToMove(parentTaskId: number, excludeTaskIds: number[], targetStart: string): Promise<boolean> {
  const parentRows = (await withTimeout(
    executeKw('project.task', 'read', [[parentTaskId]], { fields: ['child_ids'] }),
    'REPROGRAM_PARENT_DATE:read_parent',
  )) as Array<{ child_ids: number[] }>;
  const siblingIds = (parentRows[0]?.child_ids ?? []).filter((id) => !excludeTaskIds.includes(id));
  if (!siblingIds.length) return true;

  const siblings = (await withTimeout(
    executeKw('project.task', 'read', [siblingIds], { fields: ['stage_id', START_FIELD] }),
    'REPROGRAM_PARENT_DATE:read_siblings',
  )) as Array<{ stage_id: [number, string] | false; [START_FIELD]: string }>;

  // A diferencia de CANCEL_LIKE_STAGE_IDS (que trata "Visita fallida" como
  // cancelación para que moveTaskToStage no la pise silenciosamente), acá
  // "Visita fallida" NO cuenta sola como resuelta — significa exactamente lo
  // contrario: a esa unidad todavía le falta que alguien le ponga fecha
  // nueva. Solo Hecho y las cancelaciones reales (377/378) dejan de
  // necesitar agenda por sí solas; una "Visita fallida" cuenta igual, pero
  // únicamente si ya quedó con la MISMA fecha que se está por poner (ver
  // abajo) — así una unidad reprogramada antes, en el mismo reintento, no
  // bloquea a la última que falta reprogramar.
  const NO_LONGER_NEEDS_SCHEDULING_STAGE_IDS = new Set<number>([STAGE_ID_HECHO, 377, 378]);
  return siblings.every(
    (s) =>
      (s.stage_id !== false && NO_LONGER_NEEDS_SCHEDULING_STAGE_IDS.has(s.stage_id[0])) || s[START_FIELD] === targetStart,
  );
}

// Devuelve si efectivamente movió la fecha del padre — resolveSubtareaIncidencia
// lo informa en la respuesta (`parentDateMoved`) a título informativo: el
// técnico ve la unidad reprogramada en su agenda de cualquier manera (entrada
// propia si esto da false), esto solo decide si queda fusionada con el resto
// del lote o aparte.
export async function moveParentDateIfSafe(
  parentTaskId: number,
  excludeTaskIds: number[],
  input: { start: string; end: string },
): Promise<boolean> {
  const safe = await parentDateIsSafeToMove(parentTaskId, excludeTaskIds, input.start);
  if (!safe) return false;
  await moveCalendarTask(parentTaskId, input);
  return true;
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
