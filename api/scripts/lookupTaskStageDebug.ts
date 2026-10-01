// Diagnóstico manual, de SOLO LECTURA, para depurar por qué una tarea/
// subtarea puntual quedó sin mover de etapa en Odoo tras completarse su hoja
// de Conformidad. No hace ningún create/write/unlink.
//
// Uso: pnpm --filter @wara/api exec tsx scripts/lookupTaskStageDebug.ts <taskId> [taskId2 ...]
import { executeKw } from '../src/config/odoo.js';

async function main() {
  const ids = process.argv.slice(2).map(Number).filter((n) => Number.isFinite(n));
  if (!ids.length) {
    console.log('Uso: tsx scripts/lookupTaskStageDebug.ts <taskId> [taskId2 ...]');
    return;
  }

  console.log(`=== project.task read (${ids.join(', ')}) ===`);
  const tasks = (await executeKw('project.task', 'read', [ids], {
    fields: ['id', 'name', 'stage_id', 'state', 'parent_id', 'child_ids', 'project_id', 'sale_line_id', 'write_date'],
  })) as Array<Record<string, unknown>>;
  console.log(JSON.stringify(tasks, null, 2));

  const parentIds = Array.from(new Set(tasks.map((t) => (Array.isArray(t.parent_id) ? t.parent_id[0] : null)).filter((x): x is number => x !== null)));
  const childIdsFlat = Array.from(new Set(tasks.flatMap((t) => (Array.isArray(t.child_ids) ? (t.child_ids as number[]) : []))));

  if (parentIds.length) {
    console.log(`\n=== Tarea padre (${parentIds.join(', ')}) ===`);
    const parents = (await executeKw('project.task', 'read', [parentIds], {
      fields: ['id', 'name', 'stage_id', 'state', 'child_ids'],
    })) as Array<Record<string, unknown>>;
    console.log(JSON.stringify(parents, null, 2));

    console.log('\n=== TODOS los hijos de esa tarea padre (para ver si el lote sigue con otras unidades pendientes) ===');
    const allChildIds = Array.from(new Set(parents.flatMap((p) => (Array.isArray(p.child_ids) ? (p.child_ids as number[]) : []))));
    const children = (await executeKw('project.task', 'read', [allChildIds], {
      fields: ['id', 'name', 'stage_id', 'state'],
    })) as Array<Record<string, unknown>>;
    console.log(JSON.stringify(children, null, 2));
  }

  if (childIdsFlat.length) {
    console.log(`\n=== Hijos directos de la tarea consultada (${childIdsFlat.join(', ')}) ===`);
    const children2 = (await executeKw('project.task', 'read', [childIdsFlat], {
      fields: ['id', 'name', 'stage_id', 'state'],
    })) as Array<Record<string, unknown>>;
    console.log(JSON.stringify(children2, null, 2));
  }

  console.log('\nListo. Ningún dato fue modificado en Odoo (solo read).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
