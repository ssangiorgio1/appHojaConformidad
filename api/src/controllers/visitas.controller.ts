import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../middleware/error.middleware.js';
import { VisitaNotificacionModel } from '../models/VisitaNotificacion.js';
import { UsuarioModel } from '../models/Usuario.js';
import { notificarEstadoVisita, buildOptInLink } from '../services/telegram.service.js';
import { isTaskAssignedToTechnician } from '../services/calendarTask.service.js';
import { cerrarVisitasAjenasSiTodoResuelto } from '../services/loteVisita.service.js';
import type { TareaIdParam, EstadoVisitaInput, FechaQuery, FinalizarVisitaInput } from '../schemas/visita.schema.js';

// Cierra el hueco de autorización de setEstadoVisita/finalizarVisitaLote: sin
// esto, cualquier rol 'tecnico' autenticado podía pasar un tareaOdooId ajeno
// (adivinable, son ids secuenciales de Odoo) y mutar el estado de la visita
// de otro técnico, disparando un Telegram real al cliente equivocado.
//
// Hasta 2026-09-25 esto comparaba contra EL viaje abierto de la tarea (uno
// solo, compartido) y bloqueaba con 403 a un segundo técnico con subtarea
// propia en el mismo lote — "esta visita la abrió fulano". Ahora que
// VisitaNotificacion es único por (tarea, técnico), no por tarea a secas
// (ver VisitaNotificacion.ts), dos técnicos legítimos nunca compiten entre
// sí: cada uno tiene su propio viaje. Lo único que sigue haciendo falta
// confirmar es que ESTE técnico esté realmente asignado a la tarea en Odoo.
//
// Si este técnico ya tiene algún viaje (abierto o cerrado) para esta tarea,
// el chequeo es barato: ya pasó por acá antes y quedó registrado. Si no,
// Odoo es la única fuente de verdad de a quién está asignada la tarea, así
// que se paga ese round-trip una única vez por (tarea, técnico) — mismo
// criterio de "no repetir el round-trip" que ya usaba la versión anterior.
async function assertTecnicoOwnership(tareaOdooId: number, req: Request): Promise<void> {
  if (req.user!.role !== 'tecnico') return;

  const yaTuvoViaje = await VisitaNotificacionModel.exists({ tareaOdooId, tecnicoId: req.user!.usuarioId });
  if (yaTuvoViaje) return;

  const usuario = await UsuarioModel.findById(req.user!.usuarioId);
  if (!usuario?.odooUserId) {
    throw new HttpError(400, 'Tu cuenta no está vinculada a Field Service en Odoo. Pedile a un admin que la vincule.');
  }
  const assigned = await isTaskAssignedToTechnician(tareaOdooId, usuario.odooUserId);
  if (!assigned) {
    throw new HttpError(403, 'Esta tarea no está asignada a tu cuenta.');
  }
}

// Un técnico no puede tener dos viajes/trabajos en curso a la vez: si ya tiene
// una visita abierta (en_camino/en_sitio) de OTRA tarea, no puede arrancar esta.
// Solo aplica al abrir una visita nueva — si esta (tarea, fecha) ya está abierta
// es una transición normal (Salí -> Llegué) y no se toca. Un lote (varias
// unidades) es la misma tareaOdooId, así que nunca se bloquea a sí mismo.
// Las abiertas hace más de VISITA_VENCE_HORAS no cuentan: son huérfanas
// (navegador cerrado a mitad de viaje, tarea borrada en Odoo) y no deben dejar
// al técnico sin poder trabajar.
const VISITA_VENCE_HORAS = 12;

async function assertSinOtraVisitaAbierta(tareaOdooId: number, fecha: string, req: Request): Promise<void> {
  if (req.user!.role !== 'tecnico') return;
  const tecnicoId = req.user!.usuarioId;

  const yaAbierta = await VisitaNotificacionModel.exists({ tareaOdooId, tecnicoId, fecha, abierta: true });
  if (yaAbierta) return;

  const desde = new Date(Date.now() - VISITA_VENCE_HORAS * 3_600_000);
  const otra = await VisitaNotificacionModel.findOne({
    tecnicoId,
    abierta: true,
    estado: { $in: ['en_camino', 'en_sitio'] },
    // Otra visita = distinta tarea, o la misma tarea en otra fecha (franja reprogramada/partida): el
    // mismo lote en la misma fecha no se bloquea a sí mismo.
    $nor: [{ tareaOdooId, fecha }],
    updatedAt: { $gte: desde },
  }).sort({ updatedAt: -1 });
  if (otra) {
    throw new HttpError(
      409,
      `Ya tenés un ${otra.estado === 'en_camino' ? 'viaje' : 'trabajo'} en curso (tarea #${otra.tareaOdooId}). Terminalo o cancelalo antes de empezar otro.`,
    );
  }
}

// Tarea compartida por 2+ técnicos: el viaje lo gestiona uno solo (el titular, el primero que salió). Si un
// compañero ya tiene el viaje abierto para esta (tarea, fecha), el otro no abre uno propio — con la ficha
// desactualizada la PWA todavía le puede ofrecer "Salir hacia destino" — y trabaja con la llegada del titular
// (ver getVisita.titular). Solo aplica a abrir un viaje nuevo ('en_camino'): un viaje propio ya abierto sigue su curso.
async function assertSinViajeDeCompanero(tareaOdooId: number, fecha: string, req: Request): Promise<void> {
  if (req.user!.role !== 'tecnico') return;
  const tecnicoId = req.user!.usuarioId;

  const yaAbierta = await VisitaNotificacionModel.exists({ tareaOdooId, tecnicoId, fecha, abierta: true });
  if (yaAbierta) return;

  const desde = new Date(Date.now() - VISITA_VENCE_HORAS * 3_600_000);
  const companero = await VisitaNotificacionModel.findOne({
    tareaOdooId,
    fecha,
    abierta: true,
    tecnicoId: { $ne: tecnicoId },
    estado: { $in: ['en_camino', 'en_sitio'] },
    updatedAt: { $gte: desde },
  })
    .sort({ enCaminoAt: 1 })
    .populate<{ tecnicoId: { nombre: string } | null }>('tecnicoId', 'nombre');
  if (companero) {
    const nombre = companero.tecnicoId?.nombre || 'Tu compañero';
    throw new HttpError(
      409,
      companero.estado === 'en_sitio'
        ? `${nombre} ya llegó al lugar: actualizá la ficha y trabajá desde ahí, sin registrar un viaje propio.`
        : `${nombre} ya salió hacia destino con esta tarea: actualizá la ficha, el viaje lo gestiona él.`,
    );
  }
}

// Compañero que NO inició el viaje: el titular salió y marcó "llegué" para una tarea compartida (los dos viajan
// juntos), así que el otro técnico ya está en el lugar sin haber tocado nada. Para que le aparezca el banner de
// "trabajo en progreso" y su ficha no dependa de que el titular siga abierto (si el titular cierra primero, antes
// le volvía "Salir hacia destino"), se le registra su propia visita en sitio, sin traslado (enCaminoAt vacío: no
// cuenta en los promedios) y sin chat (no manda otro aviso al cliente). Solo si no tiene visita propia para esa
// (tarea, fecha) y la tarea le está asignada en Odoo.
const ASIGNADA_TTL_MS = 5 * 60_000;
const asignadaCache = new Map<string, { ok: boolean; at: number }>();

async function tareaAsignada(tareaOdooId: number, odooUserId: number): Promise<boolean> {
  const key = `${tareaOdooId}|${odooUserId}`;
  const hit = asignadaCache.get(key);
  if (hit && Date.now() - hit.at < ASIGNADA_TTL_MS) return hit.ok;
  const ok = await isTaskAssignedToTechnician(tareaOdooId, odooUserId);
  asignadaCache.set(key, { ok, at: Date.now() });
  return ok;
}

async function adoptarViajeDeCompanero(
  usuarioId: string,
  acotar?: { tareaOdooId: number; fecha: string },
): Promise<InstanceType<typeof VisitaNotificacionModel> | null> {
  try {
    const usuario = await UsuarioModel.findById(usuarioId).select('odooUserId');
    if (!usuario?.odooUserId) return null;
    const desde = new Date(Date.now() - VISITA_VENCE_HORAS * 3_600_000);
    const candidatas = await VisitaNotificacionModel.find({
      ...(acotar ?? {}),
      tecnicoId: { $ne: usuarioId },
      abierta: true,
      estado: 'en_sitio',
      updatedAt: { $gte: desde },
    })
      .sort({ enSitioAt: 1 })
      .limit(10);
    for (const c of candidatas) {
      // Ya tiene visita propia (abierta, cerrada o cancelada) para esa tarea y fecha: no se le inventa otra.
      if (await VisitaNotificacionModel.exists({ tareaOdooId: c.tareaOdooId, fecha: c.fecha, tecnicoId: usuarioId })) continue;
      if (!(await tareaAsignada(c.tareaOdooId, usuario.odooUserId))) continue;
      try {
        return await VisitaNotificacionModel.create({
          tareaOdooId: c.tareaOdooId,
          fecha: c.fecha,
          tecnicoId: usuarioId,
          estado: 'en_sitio',
          abierta: true,
          enSitioAt: c.enSitioAt ?? new Date(),
        });
      } catch (err) {
        // Carrera con otra consulta del mismo técnico: el doc ya existe.
        if (err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 11000) {
          return await VisitaNotificacionModel.findOne({ tareaOdooId: c.tareaOdooId, fecha: c.fecha, tecnicoId: usuarioId, abierta: true });
        }
        throw err;
      }
    }
  } catch (err) {
    // Best-effort (Odoo caído, etc.): el técnico sigue pudiendo marcar su propia llegada a mano.
    console.error('VISITA_ADOPTAR_COMPANERO_FAILED', err);
  }
  return null;
}

export const setEstadoVisita = asyncHandler(async (req: Request, res: Response) => {
  const { tareaOdooId } = req.params as unknown as TareaIdParam;
  const { estado, fecha, ocurrioAt } = req.body as EstadoVisitaInput;

  await assertTecnicoOwnership(tareaOdooId, req);
  if (estado === 'en_camino') await assertSinViajeDeCompanero(tareaOdooId, fecha, req);
  await assertSinOtraVisitaAbierta(tareaOdooId, fecha, req);
  const visita = await notificarEstadoVisita(tareaOdooId, estado, req.user!.usuarioId, fecha, ocurrioAt);
  res.json(visita);
});

export const getVisita = asyncHandler(async (req: Request, res: Response) => {
  const { tareaOdooId } = req.params as unknown as TareaIdParam;
  const { fecha } = req.query as unknown as FechaQuery;

  // Una tarea puede tener más de un viaje en el tiempo (ver
  // VisitaNotificacion.ts) — el más reciente por (tarea, fecha) es siempre
  // el vigente: si hay uno abierto es ese (a lo sumo uno abierto por (tarea,
  // técnico, fecha)), y si no hay ninguno abierto es el último cerrado de esa
  // fecha (para que la agenda siga mostrando 'completo' de una visita ya
  // terminada en vez de volver a 'pendiente'). `fecha` siempre se exige, sea
  // cual sea el rol — sin esto, la misma tareaOdooId en 2 entradas de
  // calendario en fechas distintas (ver calendarTask.service.ts) mezclaría
  // el viaje de una con el de la otra. Un técnico ve SU PROPIO viaje, no el
  // de un compañero con subtarea distinta en el mismo lote (ver
  // assertTecnicoOwnership) — sin este filtro, el viaje de otro técnico
  // "ganaba" por ser más reciente y la ficha mostraba un estado que no
  // correspondía al técnico logueado. Otros roles (coordinación/admin viendo
  // el panel) no tienen "su" viaje, así que siguen viendo el más reciente de
  // cualquiera — hoy nada del panel llama este endpoint, pero no hay motivo
  // para restringirlo de más.
  const filter: Record<string, unknown> = { tareaOdooId, fecha };
  if (req.user!.role === 'tecnico') filter.tecnicoId = req.user!.usuarioId;
  let visita = await VisitaNotificacionModel.findOne(filter).sort({ createdAt: -1 });
  // El titular ya llegó y yo (que viajo con él) todavía no tengo visita propia: se me registra en sitio.
  if (!visita && req.user!.role === 'tecnico') visita = await adoptarViajeDeCompanero(String(req.user!.usuarioId), { tareaOdooId, fecha });

  // "Titular" = el técnico que primero marcó salida hacia destino para este
  // (tarea, fecha), sin importar de quién es `visita` de arriba (que sigue
  // scopeada a mí solo). Con un lote de 2+ técnicos con subtareas distintas,
  // cada uno sigue con su propio documento — esto es puramente informativo,
  // para que el que no es titular (a) vea que su compañero ya salió/llegó, y
  // (b) confirme antes de "Finalizar visita" (ver AgendaTaskSheet), porque el
  // hilo de Telegram al cliente es uno solo por tareaOdooId (ver
  // registrarOptIn) y un "completo" del técnico equivocado le puede avisar al
  // cliente que la visita terminó cuando el titular todavía sigue ahí. Se
  // excluyen los viajes cancelados a mitad de camino (abierta:false y nunca
  // llegaron a 'completo', ver cancelarVisita) para no dejar a alguien que
  // canceló su intento marcado como titular para siempre.
  let titular = null;
  if (req.user!.role === 'tecnico') {
    const titularDoc = await VisitaNotificacionModel.findOne({
      tareaOdooId,
      fecha,
      enCaminoAt: { $ne: null },
      $or: [{ abierta: true }, { estado: 'completo' }],
    })
      .sort({ enCaminoAt: 1 })
      .populate<{ tecnicoId: { _id: unknown; nombre: string } | null }>('tecnicoId', 'nombre');
    if (titularDoc?.tecnicoId) {
      titular = {
        tecnicoId: String(titularDoc.tecnicoId._id),
        nombre: titularDoc.tecnicoId.nombre,
        esUnoMismo: String(titularDoc.tecnicoId._id) === String(req.user!.usuarioId),
        estado: titularDoc.estado,
        enCaminoAt: titularDoc.enCaminoAt,
        enSitioAt: titularDoc.enSitioAt,
      };
    }
  }

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
    titular,
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
  let visita = await VisitaNotificacionModel.findOne({
    tecnicoId: req.user!.usuarioId,
    abierta: true,
    estado: { $in: ['en_camino', 'en_sitio'] },
  }).sort({ updatedAt: -1 });
  // Sin visita propia pero viajando con un titular que ya llegó: banner de trabajo en progreso para él también.
  if (!visita && req.user!.role === 'tecnico') visita = await adoptarViajeDeCompanero(String(req.user!.usuarioId));

  if (!visita) {
    res.json({ visita: null });
    return;
  }

  res.json({
    visita: {
      tareaOdooId: visita.tareaOdooId,
      // El front la necesita para poder cancelar/cerrar ESTE viaje puntual
      // (ver cancelarVisita) — sin esto no sabría a cuál de las posibles
      // entradas de calendario de esta tareaOdooId corresponde.
      fecha: visita.fecha,
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
  const { fecha, ocurrioAt } = req.body as FinalizarVisitaInput;
  await assertTecnicoOwnership(tareaOdooId, req);
  const visita = await notificarEstadoVisita(tareaOdooId, 'completo', req.user!.usuarioId, fecha, ocurrioAt);
  // Si con esto no queda ninguna unidad sin resolver, las visitas que otros técnicos dejaron abiertas en la tarea se cierran.
  await cerrarVisitasAjenasSiTodoResuelto(tareaOdooId, req.user!.usuarioId);
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
  const { fecha } = req.query as unknown as FechaQuery;
  await VisitaNotificacionModel.updateOne(
    { tareaOdooId, tecnicoId: req.user!.usuarioId, fecha, abierta: true },
    { $set: { abierta: false } },
  );
  res.status(204).send();
});
