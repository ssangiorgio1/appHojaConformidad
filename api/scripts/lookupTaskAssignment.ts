// Diagnóstico manual, de SOLO LECTURA — user_ids/child_ids de una tarea Odoo
// (para ver si un lote tiene subtareas asignadas a más de un técnico).
// Uso: tsx scripts/lookupTaskAssignment.ts <taskId>
import { executeKw } from '../src/config/odoo.js';

async function main() {
  const taskId = Number(process.argv[2]);
  if (!taskId) {
    console.error('Uso: tsx scripts/lookupTaskAssignment.ts <taskId>');
    process.exit(1);
  }

  const rows = (await executeKw('project.task', 'read', [[taskId]], {
    fields: ['id', 'name', 'user_ids', 'child_ids', 'stage_id'],
  })) as Array<Record<string, unknown>>;
  console.log('Tarea padre:', JSON.stringify(rows, null, 2));

  const parent = rows[0] as { child_ids?: number[] } | undefined;
  if (parent?.child_ids?.length) {
    const children = (await executeKw('project.task', 'read', [parent.child_ids], {
      fields: ['id', 'name', 'user_ids', 'stage_id'],
    })) as Array<Record<string, unknown>>;
    console.log('Subtareas:', JSON.stringify(children, null, 2));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
