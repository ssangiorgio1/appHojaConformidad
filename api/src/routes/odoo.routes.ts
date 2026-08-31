import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { searchTicketsQuerySchema, linkOdooAccountSchema } from '../schemas/odoo.schema.js';
import { searchOdooTickets, linkOdooAccount, unlinkOdooAccount } from '../controllers/odoo.controller.js';

export const odooRouter = Router();

odooRouter.use(requireAuth);

odooRouter.get('/tickets/search', validate(searchTicketsQuerySchema, 'query'), searchOdooTickets);
odooRouter.post('/account/link', validate(linkOdooAccountSchema), linkOdooAccount);
odooRouter.delete('/account/link', unlinkOdooAccount);
