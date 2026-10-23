import { ConformidadModel } from '../models/Conformidad.js';
import { SubtareaIncidenciaModel } from '../models/SubtareaIncidencia.js';
import { UsuarioModel } from '../models/Usuario.js';
import { RetiroEquipoModel } from '../models/RetiroEquipo.js';
import { VisitaNotificacionModel } from '../models/VisitaNotificacion.js';
import { getAllSubtaskIds, getOwnSubtaskIds } from './calendarTask.service.js';
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
// Cuando TODAS las unidades de la tarea ya están resueltas (hoja completa, acta de retiro/entrega o "no encontrada"),
// sin importar quién las resolvió, las visitas que otros técnicos dejaron abiertas en esa tarea ya no tienen nada
// que esperar: se cierran en silencio (abierta:false — sin Telegram, sin marcarlas 'completo', conservando Salió/Llegó).
// Es el caso de dos técnicos asignados a la misma tarea donde uno hace todo: al otro le quedaba el banner pegado.
// No cierra la del técnico `exceptoTecnicoId` (esa la cierra su propio flujo, con aviso al cliente).
export async function cerrarVisitasAjenasSiTodoResuelto(
  tareaOdooId: number,
  exceptoTecnicoId: Types.ObjectId | string | null | undefined,
): Promise<number> {
  try {
    const ajenas = await VisitaNotificacionModel.find({
      tareaOdooId,
      abierta: true,
      ...(exceptoTecnicoId ? { tecnicoId: { $ne: exceptoTecnicoId } } : {}),
    }).select('_id');
    if (!ajenas.length) return 0;

    const unidades = await getAllSubtaskIds(tareaOdooId);
    // Odoo no encontró la tarea: sin saber cuántas unidades tiene, no se cierra nada.
    if (!unidades) return 0;
    const conSubtarea = unidades.length > 0;
    const [completadas, reportadas, retiradas] = await Promise.all([
      ConformidadModel.find({
        'tareaOdoo.id': tareaOdooId,
        status: 'completo',
        ...(conSubtarea ? { 'subtareaOdoo.id': { $in: unidades } } : {}),
      }).distinct(conSubtarea ? 'subtareaOdoo.id' : '_id'),
      SubtareaIncidenciaModel.find({ tareaOdooId, ...(conSubtarea ? { subtareaOdooId: { $in: unidades } } : {}) }).distinct('subtareaOdooId'),
      RetiroEquipoModel.find({ tareaOdooId, ...(conSubtarea ? { subtareaOdooId: { $in: unidades } } : { subtareaOdooId: null }) }).distinct(
        conSubtarea ? 'subtareaOdooId' : '_id',
      ),
    ]);

    if (conSubtarea) {
      const resueltas = new Set([...completadas, ...reportadas, ...retiradas]);
      if (!unidades.every((id) => resueltas.has(id))) return 0;
    } else if (!completadas.length && !retiradas.length) {
      return 0;
    }

    const res = await VisitaNotificacionModel.updateMany({ _id: { $in: ajenas.map((v) => v._id) }, abierta: true }, { $set: { abierta: false } });
    if (res.modifiedCount) console.log('VISITAS_AJENAS_CERRADAS', { tareaOdooId, cerradas: res.modifiedCount });
    return res.modifiedCount;
  } catch (err) {
    console.error('LOTE_VISITAS_AJENAS_CLOSE_FAILED', tareaOdooId, err);
    return 0;
  }
}

export async function cerrarVisitaLoteSiTodoResuelto(
  tareaOdooId: number,
  tecnicoId: Types.ObjectId | string | null | undefined,
  fecha: string,
  ocurrioAt?: string,
): Promise<void> {
  if (!tecnicoId) return;
  await cerrarVisitasAjenasSiTodoResuelto(tareaOdooId, tecnicoId);
  try {
    const usuario = await UsuarioModel.findById(tecnicoId).select('odooUserId');
    if (!usuario?.odooUserId) return; // sin vínculo a Odoo, no hay forma de scopear "propias"

    const { asignadas, visibles } = await getOwnSubtaskIds(tareaOdooId, usuario.odooUserId);
    if (asignadas.length === 0) return; // no es un lote, o no tiene ninguna unidad asignada a él: el cierre es manual
    // El cierre automático espera a TODAS las unidades que le muestra la pantalla (asignadas a él o sin asignar), no solo a las
    // asignadas: si no, la visita se cerraba con unidades sin hacer a la vista y la ficha lo mandaba a "Salir hacia destino".
    const propias = visibles;

    const [completadas, reportadas, retiradas] = await Promise.all([
      ConformidadModel.find({
        'tareaOdoo.id': tareaOdooId,
        'subtareaOdoo.id': { $in: propias },
        status: 'completo',
      }).distinct('subtareaOdoo.id'),
      SubtareaIncidenciaModel.find({
        tareaOdooId,
        subtareaOdooId: { $in: propias },
      }).distinct('subtareaOdooId'),
      // Una unidad resuelta con acta de retiro/entrega también cuenta (antes quedaba sin cerrar la visita).
      RetiroEquipoModel.find({ tareaOdooId, subtareaOdooId: { $in: propias } }).distinct('subtareaOdooId'),
    ]);

    const resueltas = new Set([...completadas, ...reportadas, ...retiradas]);
    const todasResueltas = propias.every((id) => resueltas.has(id));
    if (!todasResueltas) return;

    await notificarEstadoVisita(tareaOdooId, 'completo', tecnicoId, fecha, ocurrioAt);
  } catch (err) {
    // Best-effort: si Odoo no responde a tiempo o falla la consulta, el
    // técnico sigue teniendo el botón manual "Finalizar visita" como red de
    // contención — no hay que romper el PATCH/incidencia que disparó esto.
    console.error('LOTE_VISITA_AUTOCLOSE_FAILED', tareaOdooId, err);
  }
}
