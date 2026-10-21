import type { Request, Response } from 'express';
import { nanoid } from 'nanoid';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../middleware/error.middleware.js';
import { FirmaTransferenciaModel } from '../models/FirmaTransferencia.js';
import type { CreateFirmaTransferenciaInput, FirmarTransferenciaInput } from '../schemas/firmaTransferencia.schema.js';

const VIGENCIA_MS = 12 * 3_600_000;

// El panel pide el link para que el técnico firme desde su celular.
export const crearPedidoFirma = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as CreateFirmaTransferenciaInput;
  const pedido = await FirmaTransferenciaModel.create({
    ...body,
    token: nanoid(32),
    creadaPor: req.user!.usuarioId,
    expiresAt: new Date(Date.now() + VIGENCIA_MS),
  });
  res.status(201).json({ token: pedido.token, expiresAt: pedido.expiresAt });
});

// El panel consulta si ya firmaron; devuelve la firma recién cuando existe.
export const estadoPedidoFirma = asyncHandler(async (req: Request, res: Response) => {
  const pedido = await FirmaTransferenciaModel.findOne({ token: String(req.params.token), creadaPor: req.user!.usuarioId });
  if (!pedido) throw new HttpError(404, 'Pedido de firma no encontrado o vencido');
  res.json({ firmada: !!pedido.firma, firma: pedido.firma, firmedAt: pedido.firmedAt });
});

// Público (sin login): el celular del técnico abre el link y ve qué va a firmar. Nunca devuelve la firma.
export const verPedidoFirma = asyncHandler(async (req: Request, res: Response) => {
  const pedido = await FirmaTransferenciaModel.findOne({ token: String(req.params.token) });
  if (!pedido) throw new HttpError(404, 'El link venció o no existe');
  res.json({
    transferenciaId: pedido.transferenciaId,
    tecnicoNombre: pedido.tecnicoNombre,
    sentido: pedido.sentido,
    lineas: pedido.lineas,
    firmada: !!pedido.firma,
  });
});

// Público: se firma una sola vez; el update condicional evita que dos envíos simultáneos pisen la firma.
export const firmarPedido = asyncHandler(async (req: Request, res: Response) => {
  const { firma } = req.body as FirmarTransferenciaInput;
  const token = String(req.params.token);
  const pedido = await FirmaTransferenciaModel.findOneAndUpdate({ token, firma: null }, { $set: { firma, firmedAt: new Date() } }, { new: true });
  if (!pedido) {
    const existe = await FirmaTransferenciaModel.exists({ token });
    throw new HttpError(existe ? 409 : 404, existe ? 'Esta hoja ya fue firmada' : 'El link venció o no existe');
  }
  res.json({ ok: true });
});
