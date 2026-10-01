// Diagnóstico manual, de SOLO LECTURA — investiga por qué getTaskNotes()
// (src/services/taskNotes.service.ts) puede no estar devolviendo notas: mira
// qué subtype_id/message_type usan en la práctica los mensajes de tipo
// 'comment' en project.task y helpdesk.ticket, para confirmar si el filtro
// por 'mail.mt_note' es el correcto.
// Uso: tsx scripts/debugTaskNotesSubtypes.ts [taskId] [ticketId]
import { executeKw } from '../src/config/odoo.js';

async function main() {
  const taskId = process.argv[2] ? Number(process.argv[2]) : null;
  const ticketId = process.argv[3] ? Number(process.argv[3]) : null;

  const subtypes = (await executeKw('mail.message.subtype', 'search_read', [[]], {
    fields: ['id', 'name', 'internal', 'res_model'],
  })) as Array<Record<string, unknown>>;
  console.log('\nTodos los mail.message.subtype:', JSON.stringify(subtypes, null, 2));

  async function dump(model: 'project.task' | 'helpdesk.ticket', resId: number) {
    const rows = (await executeKw(
      'mail.message',
      'search_read',
      [[['model', '=', model], ['res_id', '=', resId]]],
      { fields: ['id', 'message_type', 'subtype_id', 'author_id', 'date', 'body'], order: 'date desc', limit: 30 },
    )) as Array<Record<string, unknown>>;
    console.log(`\nmail.message para ${model}#${resId} (${rows.length}):`);
    for (const r of rows) {
      const bodyPreview = typeof r.body === 'string' ? r.body.replace(/<[^>]*>/g, '').slice(0, 60) : r.body;
      console.log({ id: r.id, message_type: r.message_type, subtype_id: r.subtype_id, author_id: r.author_id, date: r.date, body: bodyPreview });
    }
  }

  if (taskId) await dump('project.task', taskId);
  if (ticketId) await dump('helpdesk.ticket', ticketId);

  if (!taskId && !ticketId) {
    console.log('\n(sin taskId/ticketId — pasá alguno para ver sus mensajes reales)');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
