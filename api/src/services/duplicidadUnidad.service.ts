import { ConformidadModel } from '../models/Conformidad.js';

// Dos técnicos (sobre todo sin señal, cada uno sin ver al otro) pueden terminar haciendo la hoja de la MISMA unidad el
// mismo día. No se rechaza la segunda (ya se hizo el trabajo en campo y se perdería): se guarda, se marca como posible
// duplicado y NO se envía a Odoo hasta que coordinación la revise (liberarla o borrarla). La primera sigue su curso.

export interface ClaveUnidad {
  subtareaOdoo?: { id: number } | null;
  tareaOdoo?: { id: number } | null;
  fecha: string;
  tipoServicio?: string | null;
  cambioEquipo?: { rol?: string | null } | null;
  cambioUnidad?: { rol?: string | null } | null;
}

// Misma unidad = misma subtarea (o, sin lote, la misma tarea), el mismo día y el mismo tipo de servicio (una instalación y una
// desinstalación de la misma unidad el mismo día son trabajos distintos, no un duplicado). null = no se puede (u no corresponde) comparar:
// sin tarea de Odoo, o las hojas de cambio de equipo/unidad, que van de a dos a propósito (PRE de uno, POST del otro).
export function claveDeUnidad(r: ClaveUnidad): Record<string, unknown> | null {
  if (r.cambioEquipo?.rol || r.cambioUnidad?.rol) return null;
  if (r.subtareaOdoo?.id) return { fecha: r.fecha, tipoServicio: r.tipoServicio ?? null, 'subtareaOdoo.id': r.subtareaOdoo.id };
  if (r.tareaOdoo?.id) return { fecha: r.fecha, tipoServicio: r.tipoServicio ?? null, 'tareaOdoo.id': r.tareaOdoo.id, subtareaOdoo: null };
  return null;
}

// Devuelve el _id de la hoja que ya existía para esa unidad (la más antigua que no esté marcada como duplicada), si hay.
export async function buscarHojaPrevia(
  r: ClaveUnidad & { _id: unknown },
): Promise<string | null> {
  const clave = claveDeUnidad(r);
  if (!clave) return null;
  const previa = await ConformidadModel.findOne({
    ...clave,
    _id: { $ne: r._id },
    deletedAt: null,
    'cambioEquipo.rol': { $in: [null] },
    'cambioUnidad.rol': { $in: [null] },
    $nor: [{ 'duplicado.estado': 'pendiente' }],
  })
    .sort({ createdAt: 1 })
    .select('_id');
  return previa ? String(previa._id) : null;
}
