import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { searchTickets } from '../services/odoo.service.js';
import type { SearchTicketsQuery } from '../schemas/odoo.schema.js';

export const searchOdooTickets = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as SearchTicketsQuery;
  const results = await searchTickets(query.q);
  res.json({ data: results });
});
