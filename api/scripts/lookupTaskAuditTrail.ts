// Diagnóstico manual, de SOLO LECTURA: trae el historial de mensajes/
// tracking (chatter) de una project.task puntual, para ver qué cambió y
// cuándo (útil para depurar por qué un state/stage_id quedó en un valor
// inesperado). No hace ningún create/write/unlink.
//
// Uso: pnpm --filter @wara/api exec tsx scripts/lookupTaskAuditTrail.ts <taskId>
import { executeKw } from '../src/config/odoo.js';

async function main() {
  const taskId = Number(process.argv[2]);
  if (!Number.isFinite(taskId)) {
    console.log('Uso: tsx scripts/lookupTaskAuditTrail.ts <taskId>');
    return;
  }

  console.log(`=== mail.message para project.task#${taskId} ===`);
  const messages = (await executeKw(
    'mail.message',
    'search_read',
    [
      [
        ['res_id', '=', taskId],
        ['model', '=', 'project.task'],
      ],
    ],
    { fields: ['id', 'date', 'author_id', 'subject', 'body', 'message_type'], order: 'date asc' },
  )) as Array<Record<string, unknown>>;

  for (const m of messages) {
    console.log(`\n--- msg ${m.id} | ${m.date} | ${JSON.stringify(m.author_id)} | type=${m.message_type} ---`);
    if (m.subject) console.log(`subject: ${m.subject}`);
    const body = String(m.body ?? '').replace(/<[^>]+>/g, ' ').trim();
    if (body) console.log(`body: ${body.slice(0, 300)}`);
  }

  console.log('\nListo. Ningún dato fue modificado en Odoo (solo read).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
