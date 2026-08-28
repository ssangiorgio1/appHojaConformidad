import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { searchTicketsQuerySchema } from '../schemas/odoo.schema.js';
import { searchOdooTickets } from '../controllers/odoo.controller.js';

export const odooRouter = Router();

odooRouter.use(requireAuth);

odooRouter.get('/tickets/search', validate(searchTicketsQuerySchema, 'query'), searchOdooTickets);
