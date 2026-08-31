import { beforeEach, describe, expect, it, vi } from 'vitest';

const executeKwAsCredentials = vi.fn();

vi.mock('../config/odoo.js', () => ({
  executeKw: vi.fn(),
  executeKwAsCredentials,
  authenticateOdooCredentials: vi.fn(),
}));

const { pushConformidadToTicket } = await import('./odoo.service.js');

describe('pushConformidadToTicket', () => {
  const pdfBytes = Buffer.from('%PDF-1.4 fake pdf content', 'utf-8');

  beforeEach(() => {
    executeKwAsCredentials.mockReset();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength),
      }),
    );
  });

  it('creates the attachment with single-base64-encoded PDF bytes, then links it by id', async () => {
    executeKwAsCredentials.mockResolvedValueOnce(4321); // ir.attachment.create -> new id
    executeKwAsCredentials.mockResolvedValueOnce(true); // message_post

    await pushConformidadToTicket({
      ticketId: 99,
      pdfUrl: 'https://r2.example.com/reportes/x.pdf',
      fileName: 'hoja_conformidad_X.pdf',
      resumenHtml: '<p><b>Hola</b></p>',
      as: { login: 'tecnico@wara.com', password: 'secret' },
    });

    expect(executeKwAsCredentials).toHaveBeenCalledTimes(2);

    const [, , attachModel, attachMethod, attachArgs] = executeKwAsCredentials.mock.calls[0];
    expect(attachModel).toBe('ir.attachment');
    expect(attachMethod).toBe('create');
    const attachmentPayload = attachArgs[0];
    expect(attachmentPayload.res_model).toBe('helpdesk.ticket');
    expect(attachmentPayload.res_id).toBe(99);
    expect(attachmentPayload.mimetype).toBe('application/pdf');
    // `datas` must decode back to the original PDF bytes in a single pass —
    // this is exactly what regresses if the payload gets base64-encoded twice.
    expect(Buffer.from(attachmentPayload.datas, 'base64').equals(pdfBytes)).toBe(true);

    const [, , postModel, postMethod, postArgs, postKwargs] = executeKwAsCredentials.mock.calls[1];
    expect(postModel).toBe('helpdesk.ticket');
    expect(postMethod).toBe('message_post');
    expect(postArgs).toEqual([[99]]);
    expect(postKwargs.body_is_html).toBe(true);
    expect(postKwargs.message_type).toBe('comment');
    expect(postKwargs.subtype_xmlid).toBe('mail.mt_comment');
    expect(postKwargs.attachment_ids).toEqual([4321]);
    expect(postKwargs.body).toBe('<p><b>Hola</b></p>');
    // The old `attachments` kwarg re-encodes whatever it's given — must stay gone.
    expect(postKwargs.attachments).toBeUndefined();
  });

  it('wraps a download failure as an OdooError instead of posting a broken attachment', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    await expect(
      pushConformidadToTicket({
        ticketId: 1,
        pdfUrl: 'https://r2.example.com/missing.pdf',
        fileName: 'x.pdf',
        resumenHtml: '<p>x</p>',
        as: { login: 'a', password: 'b' },
      }),
    ).rejects.toThrow(/404/);

    expect(executeKwAsCredentials).not.toHaveBeenCalled();
  });
});
