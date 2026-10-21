import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ConformidadModel } from '../models/Conformidad.js';
import { liquidarTrabajo } from '../services/liquidacion.service.js';
import { trabajoDeHoja } from '../services/liquidacionHoja.js';

export const liquidacionQuerySchema = z.object({
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tecnicoId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
});

// Puntos por técnico en un período, sobre las hojas completas y ya enviadas a Odoo. Por ahora sin montos: falta la
// base de Odoo, la zona de cada trabajo y los valores en pesos (ver docs-liquidacion-coeficientes.md).
export const liquidacion = asyncHandler(async (req: Request, res: Response) => {
  const { desde, hasta, tecnicoId } = req.query as z.infer<typeof liquidacionQuerySchema>;
  const hojas = await ConformidadModel.find({
    status: 'completo',
    'odooSync.status': 'SYNCED',
    deletedAt: null,
    fecha: { $gte: desde, $lte: hasta },
    ...(tecnicoId ? { tecnicoId } : {}),
  })
    .select('codigoActa numero cliente fecha matricula instalador tecnicoId tipoServicio equipo')
    .lean();

  const porTecnico = new Map<string, { tecnicoId: string; instalador: string; puntos: number; trabajos: unknown[] }>();
  for (const h of hojas) {
    const clave = String(h.tecnicoId ?? h.instalador ?? '');
    const liq = liquidarTrabajo(trabajoDeHoja({ tipoServicio: h.tipoServicio as never, equipo: h.equipo as never }));
    const t = porTecnico.get(clave) ?? { tecnicoId: String(h.tecnicoId ?? ''), instalador: h.instalador ?? '', puntos: 0, trabajos: [] };
    t.puntos = Math.round((t.puntos + liq.puntos) * 100) / 100;
    t.trabajos.push({
      id: String(h._id), codigoActa: h.codigoActa, numero: h.numero, cliente: h.cliente, fecha: h.fecha, matricula: h.matricula,
      tipoServicio: h.tipoServicio, lineas: liq.lineas, puntos: liq.puntos, sinCoeficiente: liq.sinCoeficiente,
    });
    porTecnico.set(clave, t);
  }
  res.json({ desde, hasta, tecnicos: [...porTecnico.values()].sort((a, b) => b.puntos - a.puntos) });
});
