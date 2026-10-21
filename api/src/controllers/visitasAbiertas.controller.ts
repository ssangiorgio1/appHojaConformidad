import type { Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../middleware/error.middleware.js';
import { VisitaNotificacionModel } from '../models/VisitaNotificacion.js';
import { ConformidadModel } from '../models/Conformidad.js';
import { UsuarioModel } from '../models/Usuario.js';

// Visitas "pegadas": un viaje abierto (en camino / en sitio) que nadie cerró — por ejemplo porque las unidades las
// terminó otro técnico de la misma tarea, y el cierre automático solo mira las unidades propias de quien termina.
// Coordinación las ve acá y las cierra sin tener que tocar la base.

// Desde cuándo se marca como sospechosa.
const HORAS_SOSPECHOSA = 12;

export const listVisitasAbiertas = asyncHandler(async (_req: Request, res: Response) => {
  const abiertas = await VisitaNotificacionModel.find({ abierta: true, estado: { $in: ['en_camino', 'en_sitio'] } }).sort({
    createdAt: 1,
  });

  const tareaIds = [...new Set(abiertas.map((v) => v.tareaOdooId))];
  const tecnicoIds = [...new Set(abiertas.map((v) => String(v.tecnicoId ?? '')).filter(Boolean))];

  const [tecnicos, completas, otrasCompletas] = await Promise.all([
    UsuarioModel.find({ _id: { $in: tecnicoIds } }).select('nombre email'),
    ConformidadModel.find({ 'tareaOdoo.id': { $in: tareaIds }, status: 'completo', deletedAt: null }).select('tareaOdoo.id cliente fecha'),
    VisitaNotificacionModel.find({ tareaOdooId: { $in: tareaIds }, estado: 'completo' }).select('tareaOdooId fecha tecnicoId'),
  ]);
  const tecnicoPorId = new Map(tecnicos.map((t) => [String(t._id), t]));

  const ahora = Date.now();
  const data = abiertas.map((v) => {
    const t = v.tecnicoId ? tecnicoPorId.get(String(v.tecnicoId)) : null;
    const hojas = completas.filter((c) => c.tareaOdoo?.id === v.tareaOdooId);
    // Otro técnico ya cerró su visita de esta misma tarea y fecha: lo más probable es que el trabajo esté terminado.
    const otroTermino = otrasCompletas.some(
      (o) => o.tareaOdooId === v.tareaOdooId && o.fecha === v.fecha && String(o.tecnicoId) !== String(v.tecnicoId),
    );
    const desde = v.enCaminoAt ?? v.createdAt;
    const horasAbierta = Math.round(((ahora - new Date(desde as Date).getTime()) / 3_600_000) * 10) / 10;
    return {
      _id: String(v._id),
      tareaOdooId: v.tareaOdooId,
      fecha: v.fecha,
      estado: v.estado,
      suspendida: v.suspendida === true,
      motivoSuspension: v.suspendida ? (v.suspensiones.at(-1)?.motivo ?? '') : '',
      tecnico: t ? { nombre: t.nombre, email: t.email } : null,
      cliente: hojas[0]?.cliente ?? '',
      enCaminoAt: v.enCaminoAt,
      enSitioAt: v.enSitioAt,
      horasAbierta,
      hojasCompletas: hojas.length,
      otroTecnicoTermino: otroTermino,
      sospechosa: horasAbierta >= HORAS_SOSPECHOSA || otroTermino,
    };
  });
  res.json({ data });
});

// Cierra el viaje igual que cancelarVisita: abierta:false, sin Telegram al cliente, sin marcarlo 'completo' y
// conservando Salió/Llegó para los reportes. No toca Odoo ni ninguna Conformidad.
export const cerrarVisitaAbierta = asyncHandler(async (req: Request, res: Response) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, 'Id inválido');
  const visita = await VisitaNotificacionModel.findOneAndUpdate({ _id: req.params.id, abierta: true }, { $set: { abierta: false } }, { new: true });
  if (!visita) throw new HttpError(404, 'La visita no existe o ya estaba cerrada');
  console.log('VISITA_CERRADA_MANUAL', { visita: String(visita._id), tarea: visita.tareaOdooId, por: req.user!.usuarioId });
  res.json({ ok: true });
});
