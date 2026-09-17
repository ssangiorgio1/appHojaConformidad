// Escritura puntual y acotada en Odoo — crea UNA project.task (lote) vinculada
// exclusivamente al helpdesk.ticket #37739 ("Ticket De Prueba", interno), con
// 3 subtareas (unidades) asignadas a un solo técnico. No toca ningún otro
// ticket/tarea. Deliberadamente sin user_ids en la tarea padre (solo en las
// subtareas) — es justo el caso que se está probando: técnico asignado solo
// a la subtarea, no a la tarea padre (ver ALCANCE_BACKOFFICE.md §14).
//
// Uso: pnpm --filter @wara/api exec tsx scripts/createTestLoteTask.ts
import { executeKw } from '../src/config/odoo.js';

const TICKET_ID = 37739;
const TECNICO_ODOO_USER_ID = 295; // Joaquin Sangiorgio
const PARTNER_ID = 5408; // Wara Interno — mismo partner que ya tiene el ticket

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function fmt(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`;
}

async function main() {
  const projects = (await executeKw('project.project', 'search_read', [[['is_fsm', '=', true]]], {
    fields: ['id', 'name'],
  })) as Array<{ id: number; name: string }>;
  console.log('Proyectos FSM encontrados:', projects);
  if (!projects.length) throw new Error('No hay ningún project.project con is_fsm=true — no se puede continuar.');
  const projectId = projects[0].id;
  console.log(`Usando proyecto FSM: ${projects[0].name} (id=${projectId})`);

  const start = new Date(Date.now() + 60 * 60 * 1000); // en 1 hora
  const end = new Date(start.getTime() + 3 * 60 * 60 * 1000); // +3h de ventana

  const parentId = (await executeKw('project.task', 'create', [
    {
      name: 'Instalar 3 unidades (PRUEBA — no operativo)',
      project_id: projectId,
      partner_id: PARTNER_ID,
      helpdesk_ticket_id: TICKET_ID,
      planned_date_begin: fmt(start),
      date_deadline: fmt(end),
      // A propósito SIN user_ids acá — el técnico solo va asignado a las
      // subtareas, para probar el fix de child_ids.user_ids.
    },
  ])) as number;
  console.log(`Tarea padre creada: id=${parentId}`);

  const subtaskIds: number[] = [];
  for (const nombre of ['TEST001', 'TEST002', 'TEST003']) {
    const id = (await executeKw('project.task', 'create', [
      {
        name: nombre,
        project_id: projectId,
        parent_id: parentId,
        user_ids: [[6, 0, [TECNICO_ODOO_USER_ID]]],
      },
    ])) as number;
    subtaskIds.push(id);
    console.log(`  Subtarea creada: ${nombre} → id=${id}`);
  }

  console.log('\nListo. Creado solo contra el ticket #37739:');
  console.log(`  Tarea padre: ${parentId}`);
  console.log(`  Subtareas: ${subtaskIds.join(', ')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
