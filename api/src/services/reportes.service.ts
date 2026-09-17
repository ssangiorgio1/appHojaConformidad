import { ConformidadModel } from '../models/Conformidad.js';
import { VisitaNotificacionModel } from '../models/VisitaNotificacion.js';
import { UsuarioModel } from '../models/Usuario.js';
import { getTechnicianTaskStats, arDateToOdooUtc } from './calendarTask.service.js';
import type { ReporteVisitasQuery } from '../schemas/reporte.schema.js';

function minutosEntre(a: Date | null | undefined, b: Date | null | undefined): number | null {
  if (!a || !b) return null;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
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

  const visitas = await VisitaNotificacionModel.find(filter)
    .sort({ enCaminoAt: -1 })
    .limit(500)
    .populate<{ tecnicoId: { _id: unknown; nombre: string } | null }>('tecnicoId', 'nombre')
    .lean();

  const tareaIds = [...new Set(visitas.map((v) => v.tareaOdooId))];
  const conformidades = await ConformidadModel.find({ 'tareaOdoo.id': { $in: tareaIds }, deletedAt: null })
    .select('tareaOdoo cliente fecha hora createdAt')
    .sort({ createdAt: 1 })
    .lean();

  const conformidadesPorTarea = new Map<number, typeof conformidades>();
  for (const c of conformidades) {
    const arr = conformidadesPorTarea.get(c.tareaOdoo!.id) ?? [];
    arr.push(c);
    conformidadesPorTarea.set(c.tareaOdoo!.id, arr);
  }

  return visitas.map((v) => {
    const candidatas = conformidadesPorTarea.get(v.tareaOdooId) ?? [];
    // Si la misma tarea tuvo más de un viaje, preferimos la Conformidad
    // creada durante ESTE viaje (en o después de que arrancó) para no
    // mostrar el cliente/nombre de un viaje anterior a la misma tarea.
    const match = candidatas.find((c) => !v.enCaminoAt || c.createdAt >= v.enCaminoAt) ?? candidatas[0] ?? null;

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
      minutosTraslado: minutosEntre(v.enCaminoAt, v.enSitioAt),
      minutosEnSitio: minutosEntre(v.enSitioAt, v.completoAt),
    };
  });
}

export interface ReporteTecnico {
  tecnicoId: string;
  tecnico: string;
  vinculadoOdoo: boolean;
  visitas: number;
  minutosTrasladoProm: number | null;
  minutosEnSitioProm: number | null;
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

  const visitas = await VisitaNotificacionModel.find(visitFilter).select('tecnicoId enCaminoAt enSitioAt completoAt').lean();

  const visitStatsByTech = new Map<
    string,
    { count: number; trasladoSum: number; trasladoCount: number; sitioSum: number; sitioCount: number }
  >();
  for (const v of visitas) {
    if (!v.tecnicoId) continue;
    const key = String(v.tecnicoId);
    const traslado = minutosEntre(v.enCaminoAt, v.enSitioAt);
    const sitio = minutosEntre(v.enSitioAt, v.completoAt);
    const stats = visitStatsByTech.get(key) ?? { count: 0, trasladoSum: 0, trasladoCount: 0, sitioSum: 0, sitioCount: 0 };
    stats.count += 1;
    if (traslado !== null) {
      stats.trasladoSum += traslado;
      stats.trasladoCount += 1;
    }
    if (sitio !== null) {
      stats.sitioSum += sitio;
      stats.sitioCount += 1;
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
      tareasTotal: taskStat?.tasksTotal ?? 0,
      tareasCompletadas: taskStat?.tasksCompleted ?? 0,
      tareasPendientes: taskStat?.tasksPending ?? 0,
      subtareasTotal: taskStat?.subtasksTotal ?? 0,
      subtareasCompletadas: taskStat?.subtasksCompleted ?? 0,
      subtareasPendientes: taskStat?.subtasksPending ?? 0,
    };
  });
}
