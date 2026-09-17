// Escritura puntual y acotada en Odoo — crea UNA project.task simple (sin
// subtareas) vinculada exclusivamente al helpdesk.ticket #37739 ("Ticket De
// Prueba", interno), asignada directo al técnico de prueba. No toca ningún
// otro ticket/tarea. Contraparte de createTestLoteTask.ts para probar el
// flujo de una sola unidad (viaje simple, cancelar/retomar, etc.).
//
// Uso: pnpm --filter @wara/api exec tsx scripts/createTestSimpleTask.ts
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
  if (!projects.length) throw new Error('No hay ningún project.project con is_fsm=true — no se puede continuar.');
  const projectId = projects[0].id;
  console.log(`Usando proyecto FSM: ${projects[0].name} (id=${projectId})`);

  const start = new Date(Date.now() + 60 * 60 * 1000); // en 1 hora
  const end = new Date(start.getTime() + 3 * 60 * 60 * 1000); // +3h de ventana

  const id = (await executeKw('project.task', 'create', [
    {
      name: 'Servicio simple (PRUEBA — no operativo)',
      project_id: projectId,
      partner_id: PARTNER_ID,
      helpdesk_ticket_id: TICKET_ID,
      planned_date_begin: fmt(start),
      date_deadline: fmt(end),
      user_ids: [[6, 0, [TECNICO_ODOO_USER_ID]]],
    },
  ])) as number;

  console.log(`\nListo. Creada solo contra el ticket #37739:`);
  console.log(`  Tarea: ${id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
