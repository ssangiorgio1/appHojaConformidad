import { executeKw, executeKwAsCredentials, authenticateOdooCredentials } from '../config/odoo.js';
import { OdooError, classify, withTimeout, many2oneName, UPLOAD_TIMEOUT_MS } from './odooErrors.js';

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

// Adjunta al ticket el PDF de reprogramación de una unidad, con un comentario. Mismo mecanismo que
// pushConformidadToTicket pero `as` es opcional: si el técnico no vinculó su cuenta de Odoo se usa la cuenta de
// servicio (la reprogramación no debe quedar sin constancia por eso).
export async function pushReprogramacionToTicket(params: {
  ticketId: number;
  pdfBuffer: Buffer;
  fileName: string;
  resumenHtml: string;
  as?: { login: string; password: string };
}): Promise<void> {
  try {
    const call = (model: string, method: string, args: unknown[], kwargs: Record<string, unknown> = {}) =>
      params.as ? executeKwAsCredentials(params.as.login, params.as.password, model, method, args, kwargs) : executeKw(model, method, args, kwargs);
    const attachmentId = await withTimeout(
      call('ir.attachment', 'create', [
        { name: params.fileName, datas: params.pdfBuffer.toString('base64'), res_model: 'helpdesk.ticket', res_id: params.ticketId, mimetype: 'application/pdf' },
      ]),
      'pushReprogramacionToTicket:attachment',
      UPLOAD_TIMEOUT_MS,
    );
    await withTimeout(
      call('helpdesk.ticket', 'message_post', [[params.ticketId]], {
        body: params.resumenHtml,
        body_is_html: true,
        message_type: 'comment',
        subtype_xmlid: 'mail.mt_comment',
        attachment_ids: [attachmentId],
      }),
      'pushReprogramacionToTicket:message',
      UPLOAD_TIMEOUT_MS,
    );
  } catch (err) {
    throw classify(err);
  }
}

// Buscador genérico de res.users por nombre, para elegir a quién agregar
// como destinatario de scheduleSubtareaReprogramarActivity de más abajo —
// a diferencia de listTechnicians (calendarTask.service.ts, acotado a quien
// tiene tareas de Field Service asignadas), coordinación no necesariamente
// tiene tareas propias ahí, así que busca sobre TODO res.users interno
// (share=false descarta portal/cliente).
export async function searchOdooUsers(query: string): Promise<Array<{ id: number; name: string }>> {
  const rows = (await withTimeout(
    executeKw('res.users', 'search_read', [[['name', 'ilike', query], ['share', '=', false]]], {
      fields: ['id', 'name'],
      limit: 20,
      order: 'name',
    }),
    'searchOdooUsers',
  )) as Array<{ id: number; name: string }>;
  return rows;
}

// Deja un recordatorio (mail.activity, tipo "Por hacer") en la subtarea para
// que coordinación la reprograme — ver ALCANCE_BACKOFFICE.md §14.5. A
// diferencia de postSubtareaNoEncontrada de arriba, corre con la cuenta de
// servicio (executeKw), no la del técnico: tiene que llegar SIEMPRE que haya
// destinatarios configurados (ver IncidenciaDestinatario), sin depender de si
// el técnico vinculó su propia cuenta de Odoo. mail.activity solo admite un
// user_id por registro, así que una llamada de activity_schedule por
// destinatario (no una lista) — cada quien recibe su propio recordatorio.
export async function scheduleSubtareaReprogramarActivity(params: {
  subtareaOdooId: number;
  summary: string;
  note: string;
  userIds: number[];
}): Promise<void> {
  await Promise.all(
    params.userIds.map((userId) =>
      withTimeout(
        executeKw('project.task', 'activity_schedule', [[params.subtareaOdooId]], {
          act_type_xmlid: 'mail.mail_activity_data_todo',
          summary: params.summary,
          note: params.note,
          user_id: userId,
        }),
        'scheduleSubtareaReprogramarActivity',
      ),
    ),
  );
}

// ¿Ya está publicado este PDF en el ticket? Es la huella del envío único: el nombre del archivo lleva el codigoActa (único
// por hoja/fase), así que un adjunto con ese nombre colgado de un mensaje del ticket significa que ya se envió. Devuelve
// además los adjuntos que haya con ese nombre (uno huérfano de un intento que murió entre el create y el message_post se
// reutiliza en vez de crear otro).
async function consultarPublicado(params: {
  ticketId: number;
  fileName: string;
  as: { login: string; password: string };
}): Promise<{ existingIds: number[]; posted: boolean }> {
  const existingIds = (await withTimeout(
    executeKwAsCredentials(params.as.login, params.as.password, 'ir.attachment', 'search', [
      [
        ['res_model', '=', 'helpdesk.ticket'],
        ['res_id', '=', params.ticketId],
        ['name', '=', params.fileName],
      ],
    ]),
    'pushConformidadToTicket:check-attachment',
    UPLOAD_TIMEOUT_MS,
  )) as number[];
  if (!existingIds.length) return { existingIds, posted: false };
  const posted = (await withTimeout(
    executeKwAsCredentials(params.as.login, params.as.password, 'mail.message', 'search_count', [
      [
        ['model', '=', 'helpdesk.ticket'],
        ['res_id', '=', params.ticketId],
        ['attachment_ids', 'in', existingIds],
      ],
    ]),
    'pushConformidadToTicket:check-message',
    UPLOAD_TIMEOUT_MS,
  )) as number;
  return { existingIds, posted: posted > 0 };
}

const esperar = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const esTimeout = (err: unknown) => err instanceof Error && /Tiempo de espera agotado/i.test(err.message);

// Posts a chatter note with the finished hoja de conformidad PDF attached to
// the ticket. Uses message_post (core mail.thread) so nothing needs to be
// configured on the Odoo side first — no custom fields to coordinate.
// `as` is the técnico's own linked Odoo credentials — the message is posted
// under their Odoo identity, not the shared service account.
//
// Envío único: message_post manda el correo a los seguidores del ticket (incluido el cliente), así que un segundo post
// ensucia el ticket y le llega duplicado. Por eso (1) antes de publicar se verifica que no esté ya, y (2) si Odoo tarda más
// que el tiempo de espera, el envío NO se da por fallido a ciegas: Odoo suele terminar de publicar igual, así que se
// vuelve a consultar el ticket y solo si de verdad no está se informa el error. Un falso "fallido" disparaba reintentos que
// publicaban el mismo PDF (y el mismo correo) una y otra vez. Si el chequeo mismo falla, tira error (queda FAILED) en vez de
// arriesgar un duplicado.
export async function pushConformidadToTicket(params: {
  ticketId: number;
  pdfBuffer: Buffer;
  fileName: string;
  resumenHtml: string;
  as: { login: string; password: string };
  // Espera antes de re-consultar tras un timeout (Odoo puede estar terminando de publicar). Configurable para los tests.
  esperaVerificacionMs?: number;
}): Promise<void> {
  try {
    const previo = await consultarPublicado(params);
    if (previo.posted) return;
    const existingIds = previo.existingIds;

    try {
      const base64 = params.pdfBuffer.toString('base64');
      // Adjunto huérfano de un intento anterior que murió entre el create y el message_post: se reutiliza en vez
      // de crear otro.
      const reuseAttachmentId = existingIds[0];

      // message_post's `attachments` kwarg expects raw content and
      // base64-encodes it itself — feeding it an already-base64 string double
      // encodes the PDF into a file that no reader can open. `datas` on
      // ir.attachment, by contrast, IS the base64 payload directly, so we
      // create the attachment ourselves and only hand message_post its id.
      const attachmentId = reuseAttachmentId ?? await withTimeout(
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
        UPLOAD_TIMEOUT_MS,
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
        UPLOAD_TIMEOUT_MS,
      );
    } catch (err) {
      if (!esTimeout(err)) throw err;
      await esperar(params.esperaVerificacionMs ?? 5000);
      if ((await consultarPublicado(params)).posted) return;
      throw err;
    }
  } catch (err) {
    const classified = classify(err);
    if (/does not exist|no access|not found/i.test(classified.message)) {
      throw new OdooError('TICKET_NOT_FOUND', classified.message);
    }
    throw classified;
  }
}
