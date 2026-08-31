import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../middleware/error.middleware.js';
import { searchTickets, verifyOdooLogin, OdooError } from '../services/odoo.service.js';
import { UsuarioModel } from '../models/Usuario.js';
import { encryptSecret } from '../utils/secretBox.js';
import { serializeUsuario } from '../services/usuario.service.js';
import type { SearchTicketsQuery, LinkOdooAccountInput } from '../schemas/odoo.schema.js';

export const searchOdooTickets = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as SearchTicketsQuery;
  const results = await searchTickets(query.q);
  res.json({ data: results });
});

export const linkOdooAccount = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as LinkOdooAccountInput;

  let displayName: string;
  try {
    ({ displayName } = await verifyOdooLogin(body.login, body.password));
  } catch (err) {
    const message = err instanceof OdooError ? err.message : 'No se pudo verificar la cuenta de Odoo.';
    throw new HttpError(400, message);
  }

  const usuario = await UsuarioModel.findByIdAndUpdate(
    req.user!.usuarioId,
    {
      $set: {
        odoo: { login: body.login, passwordEnc: encryptSecret(body.password), displayName, linkedAt: new Date() },
      },
    },
    { new: true },
  );
  if (!usuario) throw new HttpError(404, 'Usuario not found');
  res.json(serializeUsuario(usuario));
});

export const unlinkOdooAccount = asyncHandler(async (req: Request, res: Response) => {
  const usuario = await UsuarioModel.findByIdAndUpdate(req.user!.usuarioId, { $unset: { odoo: 1 } }, { new: true });
  if (!usuario) throw new HttpError(404, 'Usuario not found');
  res.json(serializeUsuario(usuario));
});
