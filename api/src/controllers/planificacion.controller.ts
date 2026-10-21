import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../middleware/error.middleware.js';
import { RutaAccesoModel } from '../models/RutaAcceso.js';
import { TerritorioTecnicoModel } from '../models/TerritorioTecnico.js';
import { RuteoError, trazoPorPuntos } from '../services/ruteo.service.js';
import type { RutaAccesoBody, TerritorioBody } from '../schemas/planificacion.schema.js';

// ---- Rutas de acceso rápido ----

export const listRutas = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ data: await RutaAccesoModel.find().sort({ nombre: 1 }) });
});

// El trazo por las calles sale de rutear entre los puntos marcados.
async function calcularTrazo(puntos: Array<[number, number]>) {
  try {
    return await trazoPorPuntos(puntos);
  } catch (err) {
    if (err instanceof RuteoError) throw new HttpError(err.code === 'SIN_RUTA' ? 422 : 502, err.message);
    throw err;
  }
}

// Vista previa mientras se marcan los puntos: el trazo y su largo, sin guardar nada.
export const previsualizarRuta = asyncHandler(async (req: Request, res: Response) => {
  const { puntos } = req.body as { puntos: Array<[number, number]> };
  res.json(await calcularTrazo(puntos));
});

export const createRuta = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as RutaAccesoBody;
  if (await RutaAccesoModel.exists({ nombre: body.nombre })) throw new HttpError(409, 'Ya hay una ruta con ese nombre.');
  const { trazo } = await calcularTrazo(body.puntos);
  res.status(201).json(await RutaAccesoModel.create({ ...body, trazo }));
});

export const updateRuta = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as RutaAccesoBody;
  const repetida = await RutaAccesoModel.exists({ nombre: body.nombre, _id: { $ne: req.params.id } });
  if (repetida) throw new HttpError(409, 'Ya hay una ruta con ese nombre.');
  const { trazo } = await calcularTrazo(body.puntos);
  const ruta = await RutaAccesoModel.findByIdAndUpdate(req.params.id, { ...body, trazo }, { new: true, runValidators: true });
  if (!ruta) throw new HttpError(404, 'Ruta no encontrada');
  res.json(ruta);
});

export const deleteRuta = asyncHandler(async (req: Request, res: Response) => {
  const ruta = await RutaAccesoModel.findByIdAndDelete(req.params.id);
  if (!ruta) throw new HttpError(404, 'Ruta no encontrada');
  // Una ruta borrada deja de estar en los territorios que la tenían.
  await TerritorioTecnicoModel.updateMany({ rutas: ruta._id }, { $pull: { rutas: ruta._id } });
  res.status(204).send();
});

// ---- Territorios por técnico ----

export const listTerritorios = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ data: await TerritorioTecnicoModel.find().sort({ tecnicoNombre: 1 }) });
});

export const saveTerritorio = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as TerritorioBody;
  const tecnicoId = req.params.id;
  // Si no queda nada asignado el territorio se borra (el técnico vuelve a repartirse con los demás).
  if (body.rutas.length + body.departamentos.length + body.distritos.length === 0) {
    await TerritorioTecnicoModel.deleteOne({ tecnicoId });
    res.status(204).send();
    return;
  }
  const territorio = await TerritorioTecnicoModel.findOneAndUpdate({ tecnicoId }, { ...body, tecnicoId }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true });
  res.json(territorio);
});

export const deleteTerritorio = asyncHandler(async (req: Request, res: Response) => {
  await TerritorioTecnicoModel.deleteOne({ tecnicoId: req.params.id });
  res.status(204).send();
});
