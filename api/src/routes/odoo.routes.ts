import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { authMutationLimiter } from '../middleware/rateLimit.middleware.js';
import { searchTicketsQuerySchema, linkOdooAccountSchema } from '../schemas/odoo.schema.js';
import { searchOdooTickets, linkOdooAccount, unlinkOdooAccount } from '../controllers/odoo.controller.js';

export const odooRouter = Router();

odooRouter.use(requireAuth);

odooRouter.get('/tickets/search', validate(searchTicketsQuerySchema, 'query'), searchOdooTickets);
// Este endpoint verifica login/password de Odoo contra Odoo de verdad — sin
// un límite propio, cualquier cuenta wara logueada podría usarlo para probar
// muchas contraseñas contra una cuenta de Odoo conocida (el apiLimiter
// genérico de /api es demasiado amplio, compartido con todo el resto del
// tráfico). Mismo límite que alta/reset de usuarios.
odooRouter.post('/account/link', authMutationLimiter, validate(linkOdooAccountSchema), linkOdooAccount);
odooRouter.delete('/account/link', unlinkOdooAccount);
