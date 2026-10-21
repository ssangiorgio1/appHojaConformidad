import { ConformidadModel } from '../models/Conformidad.js';
import { VisitaNotificacionModel } from '../models/VisitaNotificacion.js';
import { UsuarioModel } from '../models/Usuario.js';
import { getTechnicianTaskStats, arDateToOdooUtc } from './calendarTask.service.js';
import type { ReporteVisitasQuery } from '../schemas/reporte.schema.js';
import { minutosSuspendidosEn, type SuspensionVisita } from './suspensionVisita.js';

function minutosEntre(a: Date | null | undefined, b: Date | null | undefined): number | null {
  if (!a || !b) return null;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}

// Traslado (enCaminoAt → enSitioAt) y tiempo en sitio (enSitioAt → completoAt) netos: sin el tiempo que la visita estuvo
// suspendida (el técnico atendiendo otra tarea). Sin suspensiones es igual a minutosEntre.
type VisitaConTiempos = {
  enCaminoAt?: Date | null;
  enSitioAt?: Date | null;
  completoAt?: Date | null;
  suspensiones?: SuspensionVisita[] | null;
};

function minutosTrasladoNeto(v: VisitaConTiempos): number | null {
  const bruto = minutosEntre(v.enCaminoAt, v.enSitioAt);
  if (bruto === null) return null;
  return Math.max(0, bruto - minutosSuspendidosEn(v.suspensiones, v.enCaminoAt, v.enSitioAt, v.completoAt));
}

function minutosEnSitioNeto(v: VisitaConTiempos): number | null {
  const bruto = minutosEntre(v.enSitioAt, v.completoAt);
  if (bruto === null) return null;
  return Math.max(0, bruto - minutosSuspendidosEn(v.suspensiones, v.enSitioAt, v.completoAt, v.completoAt));
}

// "En sitio" (enSitioAt → completoAt) es el tiempo TOTAL del viaje una vez
// llegado — incluye instalar cada unidad, pero también caminar entre
// unidades, esperas, trámites con el cliente, etc. Coordinación pidió poder
// distinguir eso de cuánto tiempo se fue específicamente en instalar cada
// unidad del lote. No hay un botón de "empecé esta unidad" en la PWA, así que
// se estima con lo que ya existe: cada unidad tiene su propia Conformidad, y
// createdAt (cuándo arrancó esa hoja) → post.firma.firmedAt (cuándo se firmó
// el POST, o pre.firma.firmedAt si el POST todavía no se firmó/no aplica) es
// la mejor aproximación disponible sin agregar instrumentación nueva. Es una
// estimación, no un cronómetro exacto: si el técnico hace todos los PRE del
// lote primero y todos los POST después, los rangos se pisan entre unidades.
function minutosInstalandoUnidad(c: { createdAt: Date; pre?: { firma?: { firmedAt?: Date | null } | null } | null; post?: { firma?: { firmedAt?: Date | null } | null } | null }): number | null {
  const fin = c.post?.firma?.firmedAt ?? c.pre?.firma?.firmedAt ?? null;
  return minutosEntre(c.createdAt, fin);
}

// Unidades (Conformidades) que corresponden a ESTE viaje puntual de una
// tarea — no todas las de la tarea, porque una misma tarea puede tener varios
// viajes (ej. se reprogramó una unidad y el técnico volvió otro día, o —
// desde 2026-09-25 — 2 técnicos distintos con subtareas propias del mismo
// lote tienen cada uno su propio viaje en paralelo, ver
// VisitaNotificacion.ts). Recibe `candidatas` ya filtradas por técnico (ver
// caller) — sin eso, el viaje de un técnico mostraría también las unidades
// que instaló el otro, con la misma tareaOdoo.id. Dentro de esas candidatas
// propias, se scopea por ventana de tiempo del viaje (llegada → cierre, o
// "hasta ahora" si sigue abierto) igual que el resto de este archivo estima
// límites sin tener un id de viaje guardado en Conformidad.
function unidadesDeVisita<T extends { createdAt: Date }>(
  v: { enCaminoAt?: Date | null; completoAt?: Date | null },
  candidatas: T[],
): T[] {
  return candidatas.filter((c) => {
    if (!v.enCaminoAt || c.createdAt < v.enCaminoAt) return false;
    if (v.completoAt && c.createdAt > v.completoAt) return false;
    return true;
  });
}

function fechaRangeFilter(query: ReporteVisitasQuery): Record<string, Date> | null {
  if (!query.fechaDesde && !query.fechaHasta) return null;
  const range: Record<string, Date> = {};
  if (query.fechaDesde) range.$gte = new Date(query.fechaDesde);
  if (query.fechaHasta) range.$lte = new Date(query.fechaHasta);
  return range;
}

// Reporte por VIAJE (un documento de VisitaNotificacion), no por Conformidad
// — antes era al revés (una fila por Conformidad, cruzada con la visita de
// su tarea) y eso rompía en dos casos reales:
//   1) Un lote de N unidades genera N Conformidades para la MISMA visita, así
//      que salían N filas idénticas en Salió/Llegó/Terminó — "3 unidades" se
//      veía como "3 visitas" en vez de un solo viaje.
//   2) Un viaje que el técnico cortó antes de crear ninguna hoja (canceló el
//      borrador, o nunca llegó a "Llegué") no tenía ninguna Conformidad de la
//      que colgar — quedaba completamente invisible acá, aunque sí haya
//      "salido" según VisitaNotificacion.
// Ahora que VisitaNotificacion es un viaje por documento (ver
// VisitaNotificacion.ts) y cancelarVisita cierra en vez de borrar, esto se
// arregla arrancando la consulta desde ahí. Cliente/tarea siguen siendo
// datos de Conformidad (VisitaNotificacion no los tiene) — se cruzan
// después, de exhibición nomás, sin afectar Salió/Llegó/Terminó/Traslado/En
// sitio, que salen todos del propio viaje.
export async function getReporteVisitas(query: ReporteVisitasQuery) {
  const filter: Record<string, unknown> = { enCaminoAt: { $ne: null } };
  if (query.tecnicoId) filter.tecnicoId = query.tecnicoId;
  const rango = fechaRangeFilter(query);
  if (rango) filter.enCaminoAt = { $ne: null, ...rango };

  const skip = (query.page - 1) * query.pageSize;
  const [visitas, total] = await Promise.all([
    VisitaNotificacionModel.find(filter)
      .sort({ enCaminoAt: -1 })
      .skip(skip)
      .limit(query.pageSize)
      .populate<{ tecnicoId: { _id: unknown; nombre: string } | null }>('tecnicoId', 'nombre')
      .lean(),
    VisitaNotificacionModel.countDocuments(filter),
  ]);

  const tareaIds = [...new Set(visitas.map((v) => v.tareaOdooId))];
  const conformidades = await ConformidadModel.find({ 'tareaOdoo.id': { $in: tareaIds }, deletedAt: null })
    .select('tareaOdoo subtareaOdoo tecnicoId cliente fecha hora createdAt pre.firma.firmedAt post.firma.firmedAt')
    .sort({ createdAt: 1 })
    .lean();

  const conformidadesPorTarea = new Map<number, typeof conformidades>();
  for (const c of conformidades) {
    const arr = conformidadesPorTarea.get(c.tareaOdoo!.id) ?? [];
    arr.push(c);
    conformidadesPorTarea.set(c.tareaOdoo!.id, arr);
  }

  const data = visitas.map((v) => {
    // Filtrado por técnico primero: 2 técnicos distintos pueden tener cada
    // uno su propio viaje sobre la misma tareaOdooId (lote con subtareas
    // repartidas, ver VisitaNotificacion.ts) — sin este filtro, el viaje de
    // uno mostraría también el cliente/unidades del otro.
    const propias = (conformidadesPorTarea.get(v.tareaOdooId) ?? []).filter(
      (c) => String(c.tecnicoId) === String(v.tecnicoId?._id ?? v.tecnicoId),
    );
    // Si el mismo técnico tuvo más de un viaje a esta tarea, preferimos la
    // Conformidad creada durante ESTE viaje (en o después de que arrancó)
    // para no mostrar el cliente/nombre de un viaje anterior.
    const match = propias.find((c) => !v.enCaminoAt || c.createdAt >= v.enCaminoAt) ?? propias[0] ?? null;

    // Desglose por unidad dentro de ESTE viaje — ver minutosInstalandoUnidad.
    // Un lote de 1 sola unidad da un desglose de 1 elemento, nada especial.
    const unidades = unidadesDeVisita(v, propias).map((c) => ({
      subtareaOdooId: c.subtareaOdoo?.id ?? null,
      subtareaNombre: c.subtareaOdoo?.nombre || null,
      minutosInstalando: minutosInstalandoUnidad(c),
    }));
    const conMinutos = unidades.filter((u) => u.minutosInstalando !== null);
    const minutosInstalandoTotal = conMinutos.length ? conMinutos.reduce((sum, u) => sum + u.minutosInstalando!, 0) : null;

    return {
      visitaId: String(v._id),
      tareaOdooId: v.tareaOdooId,
      tareaNombre: match?.tareaOdoo?.nombre || null,
      cliente: match?.cliente || null,
      tecnico: v.tecnicoId?.nombre ?? null,
      estado: v.estado,
      abierta: v.abierta,
      fecha: match?.fecha ?? null,
      hora: match?.hora ?? null,
      enCaminoAt: v.enCaminoAt,
      enSitioAt: v.enSitioAt,
      completoAt: v.completoAt,
      minutosTraslado: minutosTrasladoNeto(v),
      // Tiempo total en el lugar (llegada → cierre) — incluye instalar TODAS
      // las unidades del lote más cualquier otro tiempo en el lugar que no es
      // instalación pura (ver minutosInstalandoTotal para esa parte sola).
      minutosEnSitio: minutosEnSitioNeto(v),
      // Suma de minutosInstalandoUnidad de cada unidad del lote — estimado,
      // ver la nota en esa función.
      minutosInstalandoTotal,
      unidades,
    };
  });

  return {
    data,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.ceil(total / query.pageSize),
  };
}

export interface ReporteTecnico {
  tecnicoId: string;
  tecnico: string;
  vinculadoOdoo: boolean;
  visitas: number;
  minutosTrasladoProm: number | null;
  minutosEnSitioProm: number | null;
  minutosInstalandoProm: number | null;
  tareasTotal: number;
  tareasCompletadas: number;
  tareasPendientes: number;
  subtareasTotal: number;
  subtareasCompletadas: number;
  subtareasPendientes: number;
}

// Cuántos días hacia atrás mirar en Odoo cuando coordinación no filtra por
// fecha — sin esto, cada carga de /reportes/tecnicos escanearía todo el
// historial de Field Service en Odoo (lento y en general irrelevante para
// "cómo viene rindiendo cada técnico").
const DEFAULT_RANGE_DAYS = 30;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function resolveTaskDateRange(query: ReporteVisitasQuery): { from: string; to: string } {
  const today = new Date();
  const fallbackDesde = new Date(today.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
  const fechaDesde = query.fechaDesde || isoDate(fallbackDesde);
  const fechaHasta = query.fechaHasta || isoDate(today);
  return { from: arDateToOdooUtc(fechaDesde), to: arDateToOdooUtc(fechaHasta, true) };
}

// Resumen por técnico para /reportes/tecnicos: promedios de tiempo de
// traslado/instalación y conteo de visitas — un VIAJE (VisitaNotificacion)
// por visita, no una Conformidad, por el mismo motivo que getReporteVisitas:
// contar Conformidades inflaba el número de "visitas" de un técnico que hace
// lotes (3 unidades del mismo viaje contaban como 3 visitas) y pesaba 3
// veces el mismo traslado en el promedio. Más el conteo de tareas/subtareas
// de Odoo Field Service (via Usuario.odooUserId, ver calendarTask.service.ts)
// — son dos fuentes de datos distintas, cruzadas acá por técnico.
export async function getReporteTecnicos(query: ReporteVisitasQuery): Promise<ReporteTecnico[]> {
  const tecnicoFilter: Record<string, unknown> = { role: 'tecnico' };
  if (query.tecnicoId) tecnicoFilter._id = query.tecnicoId;
  const tecnicos = await UsuarioModel.find(tecnicoFilter).select('nombre odooUserId').lean();
  if (!tecnicos.length) return [];

  const visitFilter: Record<string, unknown> = {
    enCaminoAt: { $ne: null },
    tecnicoId: { $in: tecnicos.map((t) => t._id) },
  };
  const rango = fechaRangeFilter(query);
  if (rango) visitFilter.enCaminoAt = { $ne: null, ...rango };

  const visitas = await VisitaNotificacionModel.find(visitFilter)
    .select('tecnicoId tareaOdooId enCaminoAt enSitioAt completoAt suspensiones')
    .lean();

  // Mismo cruce con Conformidad que getReporteVisitas, para poder promediar
  // minutosInstalandoTotal por técnico (ver unidadesDeVisita/minutosInstalandoUnidad).
  const tareaIds = [...new Set(visitas.map((v) => v.tareaOdooId))];
  const conformidades = tareaIds.length
    ? await ConformidadModel.find({ 'tareaOdoo.id': { $in: tareaIds }, deletedAt: null })
        .select('tareaOdoo tecnicoId createdAt pre.firma.firmedAt post.firma.firmedAt')
        .lean()
    : [];
  const conformidadesPorTarea = new Map<number, typeof conformidades>();
  for (const c of conformidades) {
    const arr = conformidadesPorTarea.get(c.tareaOdoo!.id) ?? [];
    arr.push(c);
    conformidadesPorTarea.set(c.tareaOdoo!.id, arr);
  }

  const visitStatsByTech = new Map<
    string,
    { count: number; trasladoSum: number; trasladoCount: number; sitioSum: number; sitioCount: number; instalandoSum: number; instalandoCount: number }
  >();
  for (const v of visitas) {
    if (!v.tecnicoId) continue;
    const key = String(v.tecnicoId);
    const traslado = minutosTrasladoNeto(v);
    const sitio = minutosEnSitioNeto(v);
    // Mismo motivo que en getReporteVisitas: filtrar por técnico antes de
    // pasarle candidatas a unidadesDeVisita — 2 técnicos pueden compartir
    // tareaOdooId con viajes propios.
    const propias = (conformidadesPorTarea.get(v.tareaOdooId) ?? []).filter((c) => String(c.tecnicoId) === key);
    const unidadesConMinutos = unidadesDeVisita(v, propias)
      .map((c) => minutosInstalandoUnidad(c))
      .filter((m): m is number => m !== null);
    const instalando = unidadesConMinutos.length ? unidadesConMinutos.reduce((sum, m) => sum + m, 0) : null;

    const stats = visitStatsByTech.get(key) ?? {
      count: 0,
      trasladoSum: 0,
      trasladoCount: 0,
      sitioSum: 0,
      sitioCount: 0,
      instalandoSum: 0,
      instalandoCount: 0,
    };
    stats.count += 1;
    if (traslado !== null) {
      stats.trasladoSum += traslado;
      stats.trasladoCount += 1;
    }
    if (sitio !== null) {
      stats.sitioSum += sitio;
      stats.sitioCount += 1;
    }
    if (instalando !== null) {
      stats.instalandoSum += instalando;
      stats.instalandoCount += 1;
    }
    visitStatsByTech.set(key, stats);
  }

  const odooIds = tecnicos.map((t) => t.odooUserId).filter((id): id is number => typeof id === 'number');
  const { from, to } = resolveTaskDateRange(query);
  const taskStats = odooIds.length ? await getTechnicianTaskStats({ from, to, technicianIds: odooIds }) : [];
  const taskStatsByOdooId = new Map(taskStats.map((s) => [s.technicianId, s]));

  return tecnicos.map((t) => {
    const visitStat = visitStatsByTech.get(String(t._id));
    const taskStat = t.odooUserId != null ? taskStatsByOdooId.get(t.odooUserId) : undefined;

    return {
      tecnicoId: String(t._id),
      tecnico: t.nombre,
      vinculadoOdoo: t.odooUserId != null,
      visitas: visitStat?.count ?? 0,
      minutosTrasladoProm: visitStat?.trasladoCount ? Math.round(visitStat.trasladoSum / visitStat.trasladoCount) : null,
      minutosEnSitioProm: visitStat?.sitioCount ? Math.round(visitStat.sitioSum / visitStat.sitioCount) : null,
      minutosInstalandoProm: visitStat?.instalandoCount ? Math.round(visitStat.instalandoSum / visitStat.instalandoCount) : null,
      tareasTotal: taskStat?.tasksTotal ?? 0,
      tareasCompletadas: taskStat?.tasksCompleted ?? 0,
      tareasPendientes: taskStat?.tasksPending ?? 0,
      subtareasTotal: taskStat?.subtasksTotal ?? 0,
      subtareasCompletadas: taskStat?.subtasksCompleted ?? 0,
      subtareasPendientes: taskStat?.subtasksPending ?? 0,
    };
  });
}
