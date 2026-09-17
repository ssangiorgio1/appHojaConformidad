import { ConformidadModel } from '../models/Conformidad.js';
import { SubtareaIncidenciaModel } from '../models/SubtareaIncidencia.js';
import { UsuarioModel } from '../models/Usuario.js';
import { getOwnSubtaskIds } from './calendarTask.service.js';
import { notificarEstadoVisita } from './telegram.service.js';
import type { Types } from 'mongoose';

// Antes, cerrar la visita de un lote era 100% manual ("Finalizar visita",
// ver visitas.controller.ts) — el técnico tenía que volver a abrir la ficha
// una vez resueltas todas sus unidades. Si en el medio la tarea se
// reasignaba en Odoo (a otro técnico, o alguna de las subtareas), esa ficha
// podía volverse inalcanzable y el banner de "trabajo en progreso" quedaba
// pegado para siempre. Esta función corre sola cada vez que una unidad se
// resuelve (Conformidad completa o incidencia de "no encontrada") y cierra
// la visita apenas ya no queda ninguna subtarea PROPIA del técnico sin
// resolver — sin esperar a que vuelva a la ficha. Recalcula "propia" contra
// Odoo en cada llamada (no cachea) porque es justo lo que puede cambiar a
// mitad de la visita.
export async function cerrarVisitaLoteSiTodoResuelto(
  tareaOdooId: number,
  tecnicoId: Types.ObjectId | string | null | undefined,
): Promise<void> {
  if (!tecnicoId) return;
  try {
    const usuario = await UsuarioModel.findById(tecnicoId).select('odooUserId');
    if (!usuario?.odooUserId) return; // sin vínculo a Odoo, no hay forma de scopear "propias"

    const propias = await getOwnSubtaskIds(tareaOdooId, usuario.odooUserId);
    if (propias.length === 0) return; // no es un lote, o ya no le queda ninguna unidad propia asignada

    const [completadas, reportadas] = await Promise.all([
      ConformidadModel.find({
        'tareaOdoo.id': tareaOdooId,
        'subtareaOdoo.id': { $in: propias },
        status: 'completo',
      }).distinct('subtareaOdoo.id'),
      SubtareaIncidenciaModel.find({
        tareaOdooId,
        subtareaOdooId: { $in: propias },
      }).distinct('subtareaOdooId'),
    ]);

    const resueltas = new Set([...completadas, ...reportadas]);
    const todasResueltas = propias.every((id) => resueltas.has(id));
    if (!todasResueltas) return;

    await notificarEstadoVisita(tareaOdooId, 'completo', tecnicoId);
  } catch (err) {
    // Best-effort: si Odoo no responde a tiempo o falla la consulta, el
    // técnico sigue teniendo el botón manual "Finalizar visita" como red de
    // contención — no hay que romper el PATCH/incidencia que disparó esto.
    console.error('LOTE_VISITA_AUTOCLOSE_FAILED', tareaOdooId, err);
  }
}
