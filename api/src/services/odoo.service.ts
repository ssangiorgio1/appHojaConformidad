import { executeKw } from '../config/odoo.js';

export class OdooError extends Error {
  constructor(
    public code: 'TICKET_NOT_FOUND' | 'AUTH_FAILED' | 'UNKNOWN',
    message: string,
  ) {
    super(message);
  }
}

const CALL_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new OdooError('UNKNOWN', `Tiempo de espera agotado hablando con Odoo (${label})`)), CALL_TIMEOUT_MS);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function classify(err: unknown): OdooError {
  if (err instanceof OdooError) return err;
  const message = err instanceof Error ? err.message : String(err);
  if (/rechaz.*autenticaci|access denied/i.test(message)) return new OdooError('AUTH_FAILED', message);
  return new OdooError('UNKNOWN', message);
}

export interface OdooTicketResult {
  id: number;
  label: string;
  partnerName: string | null;
  stage: string | null;
}

function many2oneName(v: unknown): string | null {
  return Array.isArray(v) && v.length > 1 ? String(v[1]) : null;
}

// Tickets don't always have partner_id set (it can be added after creation
// in Odoo), so search covers ticket id / subject / partner name — never
// only partner_id, or a chunk of real tickets would be unfindable.
export async function searchTickets(query: string): Promise<OdooTicketResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const orTerms: unknown[] = [['name', 'ilike', trimmed], ['partner_id.name', 'ilike', trimmed]];
  if (/^\d+$/.test(trimmed)) orTerms.push(['id', '=', Number(trimmed)]);

  // Odoo domains are flat prefix ("Polish") notation — combining N leaf
  // terms with OR needs exactly (N-1) '|' operators prepended, e.g.
  // ['|', '|', t1, t2, t3], never a leaf wrapped in its own sub-list.
  const domain = [...Array(orTerms.length - 1).fill('|'), ...orTerms];

  try {
    const rows = (await withTimeout(
      executeKw('helpdesk.ticket', 'search_read', [domain], {
        fields: ['id', 'name', 'partner_id', 'stage_id'],
        limit: 20,
        order: 'id desc',
      }),
      'searchTickets',
    )) as Array<{ id: number; name: string; partner_id: unknown; stage_id: unknown }>;

    return rows.map((r) => ({
      id: r.id,
      label: r.name,
      partnerName: many2oneName(r.partner_id),
      stage: many2oneName(r.stage_id),
    }));
  } catch (err) {
    throw classify(err);
  }
}

export async function verifyTicketExists(ticketId: number): Promise<OdooTicketResult | null> {
  try {
    const rows = (await withTimeout(
      executeKw('helpdesk.ticket', 'search_read', [[['id', '=', ticketId]]], {
        fields: ['id', 'name', 'partner_id', 'stage_id'],
        limit: 1,
      }),
      'verifyTicketExists',
    )) as Array<{ id: number; name: string; partner_id: unknown; stage_id: unknown }>;
    const r = rows[0];
    if (!r) return null;
    return { id: r.id, label: r.name, partnerName: many2oneName(r.partner_id), stage: many2oneName(r.stage_id) };
  } catch (err) {
    throw classify(err);
  }
}

// Posts a chatter note with the finished hoja de conformidad PDF attached to
// the ticket. Uses message_post (core mail.thread) so nothing needs to be
// configured on the Odoo side first — no custom fields to coordinate.
export async function pushConformidadToTicket(params: {
  ticketId: number;
  pdfUrl: string;
  fileName: string;
  resumenHtml: string;
}): Promise<void> {
  try {
    const pdfRes = await fetch(params.pdfUrl);
    if (!pdfRes.ok) throw new OdooError('UNKNOWN', `No se pudo descargar el PDF (${pdfRes.status})`);
    const buffer = Buffer.from(await pdfRes.arrayBuffer());
    const base64 = buffer.toString('base64');

    await withTimeout(
      executeKw('helpdesk.ticket', 'message_post', [[params.ticketId]], {
        body: params.resumenHtml,
        attachments: [[params.fileName, base64]],
      }),
      'pushConformidadToTicket',
    );
  } catch (err) {
    const classified = classify(err);
    if (/does not exist|no access|not found/i.test(classified.message)) {
      throw new OdooError('TICKET_NOT_FOUND', classified.message);
    }
    throw classified;
  }
}
