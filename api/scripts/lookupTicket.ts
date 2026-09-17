// Diagnóstico manual, de SOLO LECTURA — mira un helpdesk.ticket puntual y
// busca si ya tiene una project.task (Field Service) vinculada, con sus
// subtareas si las tiene. No hace ningún create/write/unlink.
//
// Uso: pnpm --filter @wara/api exec tsx scripts/lookupTicket.ts <ticketId>
import { executeKw } from '../src/config/odoo.js';

async function main() {
  const ticketId = Number(process.argv[2]);
  if (!ticketId) {
    console.error('Uso: tsx scripts/lookupTicket.ts <ticketId>');
    process.exit(1);
  }

  console.log(`=== helpdesk.ticket #${ticketId} ===`);
  const tickets = (await executeKw('helpdesk.ticket', 'search_read', [[['id', '=', ticketId]]], {
    fields: ['id', 'name', 'partner_id', 'partner_email', 'stage_id', 'team_id', 'description'],
  })) as Array<Record<string, unknown>>;
  console.log(JSON.stringify(tickets, null, 2));
  if (!tickets.length) {
    console.log('No existe ese ticket (o no es visible con esta cuenta de servicio).');
    return;
  }

  console.log(`\n=== project.task vinculada a este ticket (helpdesk_ticket_id = ${ticketId}) ===`);
  const tasks = (await executeKw('project.task', 'search_read', [[['helpdesk_ticket_id', '=', ticketId]]], {
    fields: ['id', 'name', 'user_ids', 'user_names', 'partner_id', 'stage_id', 'child_ids', 'subtask_count', 'planned_date_begin', 'date_deadline'],
  })) as Array<Record<string, unknown>>;
  console.log(JSON.stringify(tasks, null, 2));

  const childIds = tasks.flatMap((t) => t.child_ids as number[]);
  if (childIds.length) {
    console.log(`\n=== subtareas existentes de esa tarea ===`);
    const subtasks = await executeKw('project.task', 'read', [childIds], {
      fields: ['id', 'name', 'user_ids', 'user_names', 'is_closed'],
    });
    console.log(JSON.stringify(subtasks, null, 2));
  } else if (tasks.length) {
    console.log('\nLa tarea existe pero no tiene subtareas todavía.');
  } else {
    console.log('\nEste ticket todavía no tiene ninguna project.task (Field Service) vinculada.');
  }

  console.log('\nListo. Ningún dato fue modificado en Odoo (solo search_read/read).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
