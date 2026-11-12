import { AgendaCompartidaModel } from '../models/AgendaCompartida.js';
import { UsuarioModel } from '../models/Usuario.js';
import { asignacionDeTareaEnOdoo, type CalendarTask } from './calendarTask.service.js';
import { companerosPorTecnico } from './companeros.js';

// Ver models/AgendaCompartida.ts: con quién viaja cada técnico en cada tarea y fecha, guardado al servir su agenda.

const VIGENCIA_MS = 3 * 24 * 3_600_000;
const AR_OFFSET_MS = 3 * 3_600_000;

// 'YYYY-MM-DD HH:MM:SS' de Odoo (UTC) → 'YYYY-MM-DD' en hora de Argentina (la misma fecha que usa la PWA para la visita).
export function fechaArDeOdoo(inicio: string): string | null {
  const t = new Date(`${inicio.replace(' ', 'T')}Z`).getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t - AR_OFFSET_MS).toISOString().slice(0, 10);
}

// Best-effort: si falla, la agenda sale igual (los avisos de compañeros quedan con lo que había).
export async function guardarAgendaCompartida(usuarioId: string, tareas: CalendarTask[]): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + VIGENCIA_MS);
    const ops = [];
    for (const t of tareas) {
      const fecha = fechaArDeOdoo(t.start);
      if (!fecha) continue;
      ops.push({
        updateOne: {
          filter: { usuarioId, tareaOdooId: t.id, fecha },
          update: { $set: { companerosOdooIds: t.companerosIds ?? [], expiresAt } },
          upsert: true,
        },
      });
    }
    if (ops.length) await AgendaCompartidaModel.bulkWrite(ops, { ordered: false });
  } catch (err) {
    console.error('AGENDA_COMPARTIDA_SAVE_FAILED', err);
  }
}

export interface TareaCompartida {
  tareaOdooId: number;
  fecha: string;
  companerosOdooIds: number[];
}

// Las tareas (de hoy en adelante y de los últimos días, lo que siga vigente) que el técnico comparte con alguien.
export async function tareasCompartidasDe(usuarioId: string, acotar?: { tareaOdooId: number; fecha: string }): Promise<TareaCompartida[]> {
  const filas = await AgendaCompartidaModel.find(
    { usuarioId, ...(acotar ?? {}), 'companerosOdooIds.0': { $exists: true } },
    { tareaOdooId: 1, fecha: 1, companerosOdooIds: 1 },
  )
    .limit(100)
    .lean();
  return filas.map((f) => ({ tareaOdooId: f.tareaOdooId, fecha: f.fecha, companerosOdooIds: f.companerosOdooIds ?? [] }));
}

// ¿Comparte el técnico esta tarea+fecha con ese compañero (id de Odoo)? null = no hay registro (todavía no cargó su agenda
// desde este cambio): quien llama decide qué hacer.
export async function compartenViaje(usuarioId: string, tareaOdooId: number, fecha: string, companeroOdooId: number | null | undefined): Promise<boolean | null> {
  const fila = await AgendaCompartidaModel.findOne({ usuarioId, tareaOdooId, fecha }, { companerosOdooIds: 1 }).lean();
  if (!fila) return null;
  return typeof companeroOdooId === 'number' && (fila.companerosOdooIds ?? []).includes(companeroOdooId);
}

// Al salir hacia destino: se relee la asignación de esa tarea en Odoo (una vez) y se rehace lo guardado de TODOS sus
// técnicos para esa fecha, incluidos los que coordinación sacó de la unidad compartida y todavía no actualizaron su agenda.
// Así el banner, el "Tu compañero salió" y el registro de llegada del compañero no siguen usando una asignación vieja.
// Devuelve con quién comparte unidad cada usuario de Odoo, o null si Odoo no respondió (queda lo que había guardado).
export async function refrescarCompartidaDeTarea(tareaOdooId: number, fecha: string): Promise<Map<number, number[]> | null> {
  const asignacion = await asignacionDeTareaEnOdoo(tareaOdooId);
  if (!asignacion) return null;
  const porOdoo = companerosPorTecnico(asignacion.asignadosDelPadre, asignacion.unidades);
  try {
    const [usuarios, guardadas] = await Promise.all([
      UsuarioModel.find({ odooUserId: { $in: [...porOdoo.keys()] } }).select('_id odooUserId'),
      AgendaCompartidaModel.find({ tareaOdooId, fecha }, { usuarioId: 1 }).lean(),
    ]);
    const companerosDe = new Map(usuarios.map((u) => [String(u._id), porOdoo.get(u.odooUserId as number) ?? []]));
    // Quien tenía fila y ya no figura en la tarea (lo sacaron del todo) se queda sin compañeros.
    for (const g of guardadas) if (!companerosDe.has(String(g.usuarioId))) companerosDe.set(String(g.usuarioId), []);
    const expiresAt = new Date(Date.now() + VIGENCIA_MS);
    const ops = [...companerosDe].map(([usuarioId, companerosOdooIds]) => ({
      updateOne: {
        filter: { usuarioId, tareaOdooId, fecha },
        update: { $set: { companerosOdooIds, expiresAt } },
        upsert: true,
      },
    }));
    if (ops.length) await AgendaCompartidaModel.bulkWrite(ops, { ordered: false });
  } catch (err) {
    console.error('AGENDA_COMPARTIDA_REFRESH_FAILED', tareaOdooId, err);
  }
  return porOdoo;
}
