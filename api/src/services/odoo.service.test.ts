import { beforeEach, describe, expect, it, vi } from 'vitest';

const executeKwAsCredentials = vi.fn();
const executeKw = vi.fn();

vi.mock('../config/odoo.js', () => ({
  executeKw,
  executeKwAsCredentials,
  authenticateOdooCredentials: vi.fn(),
}));

const { pushConformidadToTicket, postNotaInternaTarea } = await import('./odoo.service.js');

describe('pushConformidadToTicket', () => {
  const pdfBytes = Buffer.from('%PDF-1.4 fake pdf content', 'utf-8');

  beforeEach(() => {
    executeKwAsCredentials.mockReset();
    // fetch ya no se usa — pushConformidadToTicket recibe el Buffer directo.
  });

  it('creates the attachment with single-base64-encoded PDF bytes, then links it by id', async () => {
    executeKwAsCredentials.mockResolvedValueOnce([]); // ir.attachment.search (ya enviado antes?) -> no
    executeKwAsCredentials.mockResolvedValueOnce(4321); // ir.attachment.create -> new id
    executeKwAsCredentials.mockResolvedValueOnce(true); // message_post

    await pushConformidadToTicket({
      ticketId: 99,
      pdfBuffer: pdfBytes,
      fileName: 'hoja_conformidad_X.pdf',
      resumenHtml: '<p><b>Hola</b></p>',
      as: { login: 'tecnico@wara.com', password: 'secret' },
    });

    expect(executeKwAsCredentials).toHaveBeenCalledTimes(3);

    const [, , attachModel, attachMethod, attachArgs] = executeKwAsCredentials.mock.calls[1];
    expect(attachModel).toBe('ir.attachment');
    expect(attachMethod).toBe('create');
    const attachmentPayload = attachArgs[0];
    expect(attachmentPayload.res_model).toBe('helpdesk.ticket');
    expect(attachmentPayload.res_id).toBe(99);
    expect(attachmentPayload.mimetype).toBe('application/pdf');
    // `datas` must decode back to the original PDF bytes in a single pass —
    // this is exactly what regresses if the payload gets base64-encoded twice.
    expect(Buffer.from(attachmentPayload.datas, 'base64').equals(pdfBytes)).toBe(true);

    const [, , postModel, postMethod, postArgs, postKwargs] = executeKwAsCredentials.mock.calls[2];
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

  it('adjunta el buffer correctamente aunque el PDF tenga contenido vacío', async () => {
    const emptyBuffer = Buffer.alloc(0);
    executeKwAsCredentials.mockResolvedValueOnce([]);
    executeKwAsCredentials.mockResolvedValueOnce(1);
    executeKwAsCredentials.mockResolvedValueOnce(true);

    await pushConformidadToTicket({
      ticketId: 1,
      pdfBuffer: emptyBuffer,
      fileName: 'x.pdf',
      resumenHtml: '<p>x</p>',
      as: { login: 'a', password: 'b' },
    });

    const [, , , , attachArgs] = executeKwAsCredentials.mock.calls[1];
    expect(attachArgs[0].datas).toBe('');
  });

  const base = {
    ticketId: 7,
    pdfBuffer: pdfBytes,
    fileName: 'pre_conformidad_X.pdf',
    resumenHtml: '<p>x</p>',
    as: { login: 'a', password: 'b' },
    esperaVerificacionMs: 0,
  };
  const timeoutOdoo = () => new Promise((_, reject) => setTimeout(() => reject(new Error('Tiempo de espera agotado hablando con Odoo (x)')), 0));

  it('no vuelve a publicar si el PDF ya está en el ticket colgado de un mensaje', async () => {
    executeKwAsCredentials.mockResolvedValueOnce([55]); // search: ya hay un adjunto con ese nombre
    executeKwAsCredentials.mockResolvedValueOnce(1); // search_count: y está en un mensaje

    await pushConformidadToTicket(base);

    expect(executeKwAsCredentials).toHaveBeenCalledTimes(2);
    expect(executeKwAsCredentials.mock.calls.some((c) => c[3] === 'message_post' || c[3] === 'create')).toBe(false);
  });

  it('si message_post da timeout pero Odoo igual lo publicó, no lo informa como fallido', async () => {
    executeKwAsCredentials.mockResolvedValueOnce([]); // search inicial: no está
    executeKwAsCredentials.mockResolvedValueOnce(900); // create
    executeKwAsCredentials.mockImplementationOnce(timeoutOdoo); // message_post: se corta por tiempo
    executeKwAsCredentials.mockResolvedValueOnce([900]); // re-consulta: el adjunto está
    executeKwAsCredentials.mockResolvedValueOnce(1); // y colgado de un mensaje

    await expect(pushConformidadToTicket(base)).resolves.toBeUndefined();
  });

  it('si message_post da timeout y de verdad no se publicó, informa el error', async () => {
    executeKwAsCredentials.mockResolvedValueOnce([]);
    executeKwAsCredentials.mockResolvedValueOnce(900);
    executeKwAsCredentials.mockImplementationOnce(timeoutOdoo);
    executeKwAsCredentials.mockResolvedValueOnce([900]); // re-consulta: hay adjunto...
    executeKwAsCredentials.mockResolvedValueOnce(0); // ...pero ningún mensaje lo tiene

    await expect(pushConformidadToTicket(base)).rejects.toThrow(/Tiempo de espera agotado/);
  });
});

describe('postNotaInternaTarea', () => {
  beforeEach(() => {
    executeKw.mockReset();
    executeKwAsCredentials.mockReset();
  });

  it('publica una nota interna (mail.mt_note), nunca un comentario que le llegue al cliente', async () => {
    executeKwAsCredentials.mockResolvedValueOnce(true);
    await postNotaInternaTarea({ taskId: 77, bodyHtml: '<p>Suspendida</p>', as: { login: 'tec@wara.com', password: 'x' } });

    const [, , model, method, args, kwargs] = executeKwAsCredentials.mock.calls[0];
    expect(model).toBe('project.task');
    expect(method).toBe('message_post');
    expect(args).toEqual([[77]]);
    expect(kwargs.subtype_xmlid).toBe('mail.mt_note');
    expect(kwargs.subtype_xmlid).not.toBe('mail.mt_comment');
    expect(kwargs.body).toBe('<p>Suspendida</p>');
  });

  it('sin cuenta propia del técnico usa la de servicio', async () => {
    executeKw.mockResolvedValueOnce(true);
    await postNotaInternaTarea({ taskId: 5, bodyHtml: '<p>x</p>' });
    expect(executeKwAsCredentials).not.toHaveBeenCalled();
    expect(executeKw).toHaveBeenCalledWith('project.task', 'message_post', [[5]], expect.objectContaining({ subtype_xmlid: 'mail.mt_note' }));
  });
});
