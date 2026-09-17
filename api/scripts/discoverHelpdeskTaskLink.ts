// Diagnóstico manual, de SOLO LECTURA — averigua si project.task (FSM,
// usado por el calendario) y helpdesk.ticket (usado hoy por la PWA para
// vincular y postear la conformidad) están enlazados por algún campo, antes
// de decidir si la agenda de la PWA puede reusar el mismo id que ya usa
// ticketOdoo o si son dos entidades independientes. No hace ningún
// create/write/unlink.
//
// Uso: pnpm --filter @wara/api exec tsx scripts/discoverHelpdeskTaskLink.ts
import { executeKw } from '../src/config/odoo.js';

interface FieldInfo {
  string: string;
  type: string;
  relation?: string;
}

async function main() {
  console.log('=== 1. Campos de project.task relacionados con helpdesk/ticket ===');
  const taskFields = (await executeKw('project.task', 'fields_get', [], {
    attributes: ['string', 'type', 'relation'],
  })) as Record<string, FieldInfo>;
  const taskHelpdeskFields = Object.keys(taskFields).filter((k) => /helpdesk|ticket/i.test(k));
  for (const name of taskHelpdeskFields) {
    const f = taskFields[name];
    console.log(`  ${name}: type=${f.type}${f.relation ? ` relation=${f.relation}` : ''} (${f.string})`);
  }
  if (!taskHelpdeskFields.length) console.log('  (ninguno)');

  console.log('\n=== 2. Campos de helpdesk.ticket relacionados con project/task/fsm ===');
  const ticketFields = (await executeKw('helpdesk.ticket', 'fields_get', [], {
    attributes: ['string', 'type', 'relation'],
  })) as Record<string, FieldInfo>;
  const ticketTaskFields = Object.keys(ticketFields).filter((k) => /project|task|fsm/i.test(k));
  for (const name of ticketTaskFields) {
    const f = ticketFields[name];
    console.log(`  ${name}: type=${f.type}${f.relation ? ` relation=${f.relation}` : ''} (${f.string})`);
  }
  if (!ticketTaskFields.length) console.log('  (ninguno)');

  console.log('\n=== 3. Muestra de tareas FSM recientes con esos campos (si existen) ===');
  const projects = (await executeKw('project.project', 'search_read', [[['is_fsm', '=', true]]], {
    fields: ['id', 'name'],
  })) as Array<{ id: number; name: string }>;
  const projectIds = projects.map((p) => p.id);
  const sampleFields = Array.from(new Set(['id', 'name', 'partner_id', ...taskHelpdeskFields]));
  const tasks = (await executeKw('project.task', 'search_read', [[['project_id', 'in', projectIds], ['parent_id', '=', false]]], {
    fields: sampleFields,
    limit: 10,
    order: 'write_date desc',
  })) as Array<Record<string, unknown>>;
  console.log(JSON.stringify(tasks, null, 2));

  console.log('\nListo. Ningún dato fue modificado en Odoo (solo fields_get/search_read).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
