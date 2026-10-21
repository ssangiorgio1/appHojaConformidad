import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createFirmaTransferenciaSchema, firmarTransferenciaSchema } from '../schemas/firmaTransferencia.schema.js';
import { crearPedidoFirma, estadoPedidoFirma, firmarPedido, verPedidoFirma } from '../controllers/firmaTransferencia.controller.js';

// Panel (depósito): crea el pedido y consulta si ya se firmó.
export const firmaTransferenciaRouter = Router();
firmaTransferenciaRouter.use(requireAuth, requireRole(['coordinacion', 'admin', 'superadmin', 'mesa_ayuda']));
firmaTransferenciaRouter.post('/', validate(createFirmaTransferenciaSchema, 'body'), crearPedidoFirma);
firmaTransferenciaRouter.get('/:token', estadoPedidoFirma);

// Celular del técnico: sin login, el acceso es el token del link (32 caracteres al azar, un solo uso, vence en 12 h).
export const firmaTransferenciaPublicaRouter = Router();
firmaTransferenciaPublicaRouter.get('/:token', verPedidoFirma);
firmaTransferenciaPublicaRouter.post('/:token', validate(firmarTransferenciaSchema, 'body'), firmarPedido);
