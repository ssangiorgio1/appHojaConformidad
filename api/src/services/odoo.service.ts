import { executeKw, executeKwAsCredentials, authenticateOdooCredentials } from '../config/odoo.js';
import { OdooError, classify, withTimeout, many2oneName } from './odooErrors.js';

// Re-exportado para no romper los imports existentes (odoo.controller.ts
// importa OdooError desde acá) — la clase en sí vive en odooErrors.ts,
// compartida con calendarTask.service.ts.
export { OdooError };

export interface OdooTicketResult {
  id: number;
  label: string;
  partnerName: string | null;
  partnerEmail: string | null;
  stage: string | null;
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
        fields: ['id', 'name', 'partner_id', 'partner_email', 'stage_id'],
        limit: 20,
        order: 'id desc',
      }),
      'searchTickets',
    )) as Array<{ id: number; name: string; partner_id: unknown; partner_email: string | false; stage_id: unknown }>;

    return rows.map((r) => ({
      id: r.id,
      label: r.name,
      partnerName: many2oneName(r.partner_id),
      partnerEmail: r.partner_email || null,
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
        fields: ['id', 'name', 'partner_id', 'partner_email', 'stage_id'],
        limit: 1,
      }),
      'verifyTicketExists',
    )) as Array<{ id: number; name: string; partner_id: unknown; partner_email: string | false; stage_id: unknown }>;
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      label: r.name,
      partnerName: many2oneName(r.partner_id),
      partnerEmail: r.partner_email || null,
      stage: many2oneName(r.stage_id),
    };
  } catch (err) {
    throw classify(err);
  }
}

// Verifies a técnico's personal Odoo login/password and returns the display
// name to show in their profile once linked. Kept separate from the shared
// service account entirely — this never touches env.ODOO_EMAIL/API_KEY.
export async function verifyOdooLogin(login: string, password: string): Promise<{ displayName: string }> {
  try {
    const uid = await authenticateOdooCredentials(login, password);
    const rows = (await withTimeout(
      executeKwAsCredentials(login, password, 'res.users', 'read', [[uid]], { fields: ['name'] }),
      'verifyOdooLogin',
    )) as Array<{ name: string }>;
    return { displayName: rows[0]?.name ?? login };
  } catch (err) {
    throw classify(err);
  }
}

// Deja un comentario en la subtarea (project.task) de Odoo cuando el técnico
// marca una unidad como "no encontrada" al llegar al lugar — ver
// ALCANCE_BACKOFFICE.md §14. Mismo message_post que pushConformidadToTicket
// de abajo, sin adjunto y sobre otro modelo: message_post es genérico, corre
// igual sobre cualquier modelo que herede mail.thread (project.task lo hace).
// Best-effort a propósito — si esto falla, el caller igual guarda la
// incidencia en Mongo (ver subtareaIncidencia.controller.ts), que es la
// fuente de verdad para el panel web.
export async function postSubtareaNoEncontrada(params: {
  subtareaOdooId: number;
  bodyHtml: string;
  as: { login: string; password: string };
}): Promise<void> {
  await withTimeout(
    executeKwAsCredentials(params.as.login, params.as.password, 'project.task', 'message_post', [[params.subtareaOdooId]], {
      body: params.bodyHtml,
      body_is_html: true,
      message_type: 'comment',
      subtype_xmlid: 'mail.mt_comment',
    }),
    'postSubtareaNoEncontrada',
  );
}

// Posts a chatter note with the finished hoja de conformidad PDF attached to
// the ticket. Uses message_post (core mail.thread) so nothing needs to be
// configured on the Odoo side first — no custom fields to coordinate.
// `as` is the técnico's own linked Odoo credentials — the message is posted
// under their Odoo identity, not the shared service account.
export async function pushConformidadToTicket(params: {
  ticketId: number;
  pdfBuffer: Buffer;
  fileName: string;
  resumenHtml: string;
  as: { login: string; password: string };
}): Promise<void> {
  try {
    const base64 = params.pdfBuffer.toString('base64');

    // message_post's `attachments` kwarg expects raw content and
    // base64-encodes it itself — feeding it an already-base64 string double
    // encodes the PDF into a file that no reader can open. `datas` on
    // ir.attachment, by contrast, IS the base64 payload directly, so we
    // create the attachment ourselves and only hand message_post its id.
    const attachmentId = await withTimeout(
      executeKwAsCredentials(params.as.login, params.as.password, 'ir.attachment', 'create', [
        {
          name: params.fileName,
          datas: base64,
          res_model: 'helpdesk.ticket',
          res_id: params.ticketId,
          mimetype: 'application/pdf',
        },
      ]),
      'pushConformidadToTicket:attachment',
    );

    await withTimeout(
      executeKwAsCredentials(params.as.login, params.as.password, 'helpdesk.ticket', 'message_post', [[params.ticketId]], {
        body: params.resumenHtml,
        // mail.thread.message_post runs `body = escape(body)` (markupsafe) on
        // any plain string — only a Markup instance (which JSON-RPC can't
        // carry) or body_is_html=True skips that and keeps our tags as tags.
        body_is_html: true,
        message_type: 'comment',
        subtype_xmlid: 'mail.mt_comment',
        attachment_ids: [attachmentId],
      }),
      'pushConformidadToTicket:message',
    );
  } catch (err) {
    const classified = classify(err);
    if (/does not exist|no access|not found/i.test(classified.message)) {
      throw new OdooError('TICKET_NOT_FOUND', classified.message);
    }
    throw classified;
  }
}
