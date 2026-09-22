import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../middleware/error.middleware.js';
import { VisitaNotificacionModel } from '../models/VisitaNotificacion.js';
import { UsuarioModel } from '../models/Usuario.js';
import { notificarEstadoVisita, buildOptInLink } from '../services/telegram.service.js';
import { isTaskAssignedToTechnician } from '../services/calendarTask.service.js';
import type { TareaIdParam, EstadoVisitaInput } from '../schemas/visita.schema.js';

// Cierra el hueco de autorización de setEstadoVisita/finalizarVisitaLote: sin
// esto, cualquier rol 'tecnico' autenticado podía pasar un tareaOdooId ajeno
// (adivinable, son ids secuenciales de Odoo) y mutar el estado de la visita
// de otro técnico, disparando un Telegram real al cliente equivocado.
//
// Si el viaje abierto ya tiene tecnicoId (alguien ya hizo el primer
// en_camino), el chequeo es barato: comparar contra Mongo. Si todavía no lo
// tiene, la única fuente de verdad de a quién pertenece la tarea es Odoo, así
// que se paga ese round-trip una única vez por viaje — las transiciones
// siguientes de la misma visita ya caen en la rama barata de arriba, mismo
// criterio de "no repetir el round-trip" que ya usa finalizarVisitaLote.
async function assertTecnicoOwnership(tareaOdooId: number, req: Request): Promise<void> {
  if (req.user!.role !== 'tecnico') return;

  const visita = await VisitaNotificacionModel.findOne({ tareaOdooId, abierta: true });
  if (visita?.tecnicoId) {
    if (String(visita.tecnicoId) !== String(req.user!.usuarioId)) {
      throw new HttpError(403, 'Esta visita pertenece a otro técnico.');
    }
    return;
  }

  const usuario = await UsuarioModel.findById(req.user!.usuarioId);
  if (!usuario?.odooUserId) {
    throw new HttpError(400, 'Tu cuenta no está vinculada a Field Service en Odoo. Pedile a un admin que la vincule.');
  }
  const assigned = await isTaskAssignedToTechnician(tareaOdooId, usuario.odooUserId);
  if (!assigned) {
    throw new HttpError(403, 'Esta tarea no está asignada a tu cuenta.');
  }
}

export const setEstadoVisita = asyncHandler(async (req: Request, res: Response) => {
  const { tareaOdooId } = req.params as unknown as TareaIdParam;
  const { estado } = req.body as EstadoVisitaInput;

  await assertTecnicoOwnership(tareaOdooId, req);
  const visita = await notificarEstadoVisita(tareaOdooId, estado, req.user!.usuarioId);
  res.json(visita);
});

export const getVisita = asyncHandler(async (req: Request, res: Response) => {
  const { tareaOdooId } = req.params as unknown as TareaIdParam;

  // Una tarea puede tener más de un viaje en el tiempo (ver
  // VisitaNotificacion.ts) — el más reciente es siempre el vigente: si hay
  // uno abierto es ese (a lo sumo uno abierto por tarea), y si no hay
  // ninguno abierto es el último cerrado (para que la agenda siga mostrando
  // 'completo' de una visita ya terminada en vez de volver a 'pendiente').
  const visita = await VisitaNotificacionModel.findOne({ tareaOdooId }).sort({ createdAt: -1 });
  res.json({
    tareaOdooId,
    estado: visita?.estado ?? 'pendiente',
    // Si el viaje devuelto ya está cerrado (abierta:false) y no llegó a
    // 'completo' — se canceló a mitad de camino, ver cancelarVisita — el
    // front lo trata como si no hubiera pasado nada (vuelve a "Salir hacia
    // destino") en vez de mostrar el estado viejo del viaje cortado. Default
    // true cuando no hay visita para que ese caso ('pendiente' de verdad)
    // no dispare esa lógica.
    abierta: visita?.abierta ?? true,
    optedIn: Boolean(visita?.chatId),
    optInLink: buildOptInLink(tareaOdooId),
  });
});

// La visita "en curso" del técnico logueado, si tiene una — para el banner
// persistente de la PWA (viaje/trabajo en progreso), que necesita saberlo
// desde cualquier pantalla, no solo desde /agenda donde vive AgendaTaskSheet.
// `tecnicoId` es quien disparó el primer en_camino (ver notificarEstadoVisita),
// así que dos técnicos nunca pisan la visita en curso del otro acá.
//
// En teoría un técnico tiene a lo sumo una visita activa a la vez, pero nada
// impide en la práctica que quede más de una en en_camino/en_sitio sin cerrar
// (una tarea que se borró o reprogramó en Odoo sin pasar por cancelarVisita,
// el navegador se cerró a mitad del viaje, etc.) — sin ordenar, un `findOne`
// puede devolver una vieja/abandonada en vez de la real, dejando el banner
// pegado a un trabajo que ya no importa. Se ordena por la transición más
// reciente para siempre mostrar la visita vigente.
export const getVisitaActiva = asyncHandler(async (req: Request, res: Response) => {
  const visita = await VisitaNotificacionModel.findOne({
    tecnicoId: req.user!.usuarioId,
    abierta: true,
    estado: { $in: ['en_camino', 'en_sitio'] },
  }).sort({ updatedAt: -1 });

  if (!visita) {
    res.json({ visita: null });
    return;
  }

  res.json({
    visita: {
      tareaOdooId: visita.tareaOdooId,
      estado: visita.estado,
      enCaminoAt: visita.enCaminoAt,
    },
  });
});

// Cierre explícito de la visita de un LOTE (varias unidades) cuando ya no
// queda ninguna por empezar — cada unidad completa su POST por separado y
// patchConformidad ya no dispara 'completo' a nivel tarea por eso (ver
// comentario ahí), así que sin esta acción el banner de "trabajo en
// progreso" quedaría pegado para siempre una vez resueltas todas las
// unidades. El front solo la ofrece cuando cada subtarea propia ya tiene
// hoja completa o incidencia de "no encontrada" — no se re-valida acá contra
// Odoo para no pagar ese round-trip en una acción de baja criticidad e
// iniciada a mano por el propio técnico.
export const finalizarVisitaLote = asyncHandler(async (req: Request, res: Response) => {
  const { tareaOdooId } = req.params as unknown as TareaIdParam;
  await assertTecnicoOwnership(tareaOdooId, req);
  const visita = await notificarEstadoVisita(tareaOdooId, 'completo', req.user!.usuarioId);
  res.json(visita);
});

// Se llama cuando el técnico borra localmente la hoja recién creada al tocar
// "Llegué" (solo posible en 'borrador_pre' paso 1, ver canDelete en
// page.tsx) — sin esto, la visita quedaba en_camino/en_sitio en el servidor
// para siempre, y el banner persistente de "trabajo en progreso" no
// desaparecía nunca aunque el técnico ya hubiera abandonado esa hoja.
// Restringido a la propia visita del técnico (tecnicoId) — no puede resetear
// la de otro.
//
// CIERRA el viaje (abierta:false) en vez de borrarlo — antes se borraba del
// todo, lo que hacía desaparecer sin dejar rastro un viaje real (salió,
// llegó, y ahí cortó) del reporte de /reportes/tecnicos. Cerrarlo alcanza
// para que el banner deje de mostrarlo (getVisitaActiva filtra por
// abierta:true) y libera el índice único parcial para que un "Salir hacia
// destino" posterior a la misma tarea abra un viaje nuevo — pero conserva
// Salió/Llegó de este para que coordinación vea que existió.
export const cancelarVisita = asyncHandler(async (req: Request, res: Response) => {
  const { tareaOdooId } = req.params as unknown as TareaIdParam;
  await VisitaNotificacionModel.updateOne(
    { tareaOdooId, tecnicoId: req.user!.usuarioId, abierta: true },
    { $set: { abierta: false } },
  );
  res.status(204).send();
});
