import type { Request } from 'express';
import { AuditLogModel } from '../models/AuditLog.js';

// Nunca tira: una falla del log no debe tumbar la acción que se está auditando,
// pero queda en consola para que se note.
export async function audit(req: Request, accion: string, objetivo?: string, detalle?: Record<string, unknown>) {
  try {
    await AuditLogModel.create({
      accion,
      actorId: req.user!.usuarioId,
      actorEmail: req.user!.email,
      objetivo,
      detalle,
      ip: req.ip,
    });
  } catch (err) {
    console.error('AUDIT_LOG_FAILED', accion, err);
  }
}
