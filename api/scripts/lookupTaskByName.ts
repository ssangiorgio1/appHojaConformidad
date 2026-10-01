// Diagnóstico manual, de SOLO LECTURA: busca project.task por nombre (ilike)
// para encontrar el id cuando solo se tiene la patente/referencia visible en
// Odoo (ej. una captura de pantalla), y lo alimenta con stage_id/state de la
// tarea, su padre (si tiene) y todos los hermanos. No hace ningún
// create/write/unlink.
//
// Uso: pnpm --filter @wara/api exec tsx scripts/lookupTaskByName.ts <texto>
import { executeKw } from '../src/config/odoo.js';

async function main() {
  const q = process.argv.slice(2).join(' ').trim();
  if (!q) {
    console.log('Uso: tsx scripts/lookupTaskByName.ts <texto a buscar en el nombre>');
    return;
  }

  console.log(`=== project.task con nombre que contiene "${q}" ===`);
  const matches = (await executeKw('project.task', 'search_read', [[['name', 'ilike', q]]], {
    fields: ['id', 'name', 'stage_id', 'state', 'parent_id', 'child_ids', 'project_id'],
    limit: 50,
  })) as Array<Record<string, unknown>>;
  console.log(JSON.stringify(matches, null, 2));

  const parentIds = Array.from(
    new Set(matches.map((t) => (Array.isArray(t.parent_id) ? (t.parent_id[0] as number) : null)).filter((x): x is number => x !== null)),
  );

  if (parentIds.length) {
    console.log(`\n=== Tarea(s) padre (${parentIds.join(', ')}) ===`);
    const parents = (await executeKw('project.task', 'read', [parentIds], {
      fields: ['id', 'name', 'stage_id', 'state', 'child_ids'],
    })) as Array<Record<string, unknown>>;
    console.log(JSON.stringify(parents, null, 2));

    const allChildIds = Array.from(new Set(parents.flatMap((p) => (Array.isArray(p.child_ids) ? (p.child_ids as number[]) : []))));
    if (allChildIds.length) {
      console.log('\n=== TODOS los hijos de esa tarea padre ===');
      const children = (await executeKw('project.task', 'read', [allChildIds], {
        fields: ['id', 'name', 'stage_id', 'state'],
      })) as Array<Record<string, unknown>>;
      console.log(JSON.stringify(children, null, 2));
    }
  }

  console.log('\nListo. Ningún dato fue modificado en Odoo (solo read).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
