// Diagnóstico manual, de SOLO LECTURA: confirma los valores reales de
// project.task.state (fields_get) y busca tareas que ya tengan
// '04_waiting_normal' para ver si ese valor efectivamente se usa/persiste.
import { executeKw } from '../src/config/odoo.js';

async function main() {
  console.log('=== project.task.state fields_get (selection) ===');
  const fields = (await executeKw('project.task', 'fields_get', ['state'], {
    attributes: ['string', 'type', 'selection'],
  })) as Record<string, { string: string; type: string; selection?: [string, string][] }>;
  console.log(JSON.stringify(fields.state, null, 2));

  console.log("\n=== Tareas con state = '04_waiting_normal' ===");
  const waiting = (await executeKw('project.task', 'search_read', [[['state', '=', '04_waiting_normal']]], {
    fields: ['id', 'name', 'state', 'stage_id'],
    limit: 20,
  })) as Array<Record<string, unknown>>;
  console.log(JSON.stringify(waiting, null, 2));

  console.log('\nListo. Ningún dato fue modificado en Odoo (solo read).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
