import type { ConformidadRecord, TicketOdooRef } from '@wara/shared';
import type { OdooTicketResult } from '../api/client';

// Tickets without partner_id fall back to the ticket subject, which for
// email-to-ticket tickets is often "Nombre <correo>" — strip the <email>
// so "Cliente" only ever shows the name, and recover it as the email
// fallback when Odoo didn't give us partner_email directly.
export function parseNameEmail(label: string): { name: string; email?: string } | null {
  const match = label.match(/^(.*?)\s*<([^<>\s]+@[^<>\s]+)>\s*$/);
  if (!match) return null;
  const name = match[1].trim();
  return { name: name || label, email: match[2] };
}

export function buildTicketOdooRef(ticket: OdooTicketResult): TicketOdooRef {
  const fallback = ticket.partnerName ? null : parseNameEmail(ticket.label);
  return {
    numero: String(ticket.id),
    odooId: ticket.id,
    clienteOdoo: ticket.partnerName ?? fallback?.name ?? ticket.label,
    clienteEmailOdoo: ticket.partnerEmail ?? fallback?.email ?? undefined,
    asunto: ticket.label,
    etapa: ticket.stage ?? undefined,
    verified: true,
  };
}

// Persist ticketOdoo, cliente and responsableEmpresa atomically in one call —
// separate set() calls would race because each would still see the old
// record and drop the others' changes. Never overwrites what the técnico
// already typed.
export function mergeTicketOdooIntoRecord(
  record: ConformidadRecord,
  ticketOdoo: TicketOdooRef | null,
): ConformidadRecord {
  let next: ConformidadRecord = { ...record, ticketOdoo };
  if (ticketOdoo?.clienteOdoo && !record.cliente.trim()) {
    next = { ...next, cliente: ticketOdoo.clienteOdoo };
  }
  if (ticketOdoo?.clienteEmailOdoo && !record.responsableEmpresa.trim()) {
    next = { ...next, responsableEmpresa: ticketOdoo.clienteEmailOdoo };
  }
  return next;
}
