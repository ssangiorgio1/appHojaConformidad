// Diagnóstico manual, de SOLO LECTURA, para descubrir las etapas reales del
// Kanban de Field Service (project.task.stage_id -> project.task.type) en la
// instancia real de Odoo (producción, sin staging). No hace ningún
// create/write/unlink — solo fields_get/search_read.
//
// Uso: pnpm --filter @wara/api exec tsx scripts/discoverOdooStages.ts
import { executeKw } from '../src/config/odoo.js';

const FSM_PROJECT_NAME_RE = /servicio externo|field service|\bfsm\b/i;

async function main() {
  console.log('=== 1. Detección de proyecto(s) Field Service ===');
  const projectFields = (await executeKw('project.project', 'fields_get', [], {
    attributes: ['string', 'type'],
  })) as Record<string, { string: string; type: string }>;
  const hasIsFsm = 'is_fsm' in projectFields;
  console.log(`  is_fsm existe en project.project: ${hasIsFsm}`);

  let candidateProjects: Array<{ id: number; name: string }> = [];
  if (hasIsFsm) {
    candidateProjects = (await executeKw('project.project', 'search_read', [[['is_fsm', '=', true]]], {
      fields: ['id', 'name'],
    })) as Array<{ id: number; name: string }>;
  } else {
    const allProjects = (await executeKw('project.project', 'search_read', [[]], {
      fields: ['id', 'name'],
    })) as Array<{ id: number; name: string }>;
    candidateProjects = allProjects.filter((p) => FSM_PROJECT_NAME_RE.test(p.name));
  }
  console.log(`  Proyecto(s) candidato(s): ${JSON.stringify(candidateProjects)}`);
  if (!candidateProjects.length) {
    console.log('  No se encontró ningún proyecto candidato — abortando.');
    return;
  }
  const projectIds = candidateProjects.map((p) => p.id);

  console.log('\n=== 2. project.task.type (config del Kanban) fields_get ===');
  const stageFields = (await executeKw('project.task.type', 'fields_get', [], {
    attributes: ['string', 'type', 'relation'],
  })) as Record<string, { string: string; type: string; relation?: string }>;
  const stageFieldNames = Object.keys(stageFields).sort();
  console.log(`  Campos disponibles: ${stageFieldNames.join(', ')}`);

  console.log('\n=== 3. Etapas configuradas (project.task.type) vinculadas a los proyectos candidatos ===');
  const stageReadFields = ['id', 'name', 'sequence', 'fold', 'project_ids'].filter((f) => f in stageFields);
  const allStages = (await executeKw('project.task.type', 'search_read', [[['project_ids', 'in', projectIds]]], {
    fields: stageReadFields,
    order: 'sequence asc',
  })) as Array<Record<string, unknown>>;
  console.log(JSON.stringify(allStages, null, 2));

  console.log('\n=== 4. Fallback: TODAS las project.task.type de la instancia (por si el link project_ids no matchea) ===');
  const everyStage = (await executeKw('project.task.type', 'search_read', [[]], {
    fields: stageReadFields,
    order: 'sequence asc',
  })) as Array<Record<string, unknown>>;
  console.log(JSON.stringify(everyStage, null, 2));

  console.log('\n=== 5. stage_id realmente en uso hoy, tomado directo de project.task (muestra + distinct) ===');
  const tasks = (await executeKw('project.task', 'search_read', [[['project_id', 'in', projectIds]]], {
    fields: ['id', 'stage_id'],
    limit: 2000,
  })) as Array<{ id: number; stage_id: [number, string] | false }>;
  const distinctById = new Map<number, string>();
  for (const t of tasks) {
    if (t.stage_id) distinctById.set(t.stage_id[0], t.stage_id[1]);
  }
  console.log(`  Tareas leídas: ${tasks.length}`);
  console.log(`  Etapas distintas en uso: ${JSON.stringify(Array.from(distinctById.entries()))}`);

  console.log('\n=== 6. Búsqueda de nombres candidatos a "terminal" (hecho/cancel/fall/cliente) ===');
  const nameRe = /hecho|cancel|fall|cliente|nuevo|done|cancel/i;
  const candidates = [...allStages, ...everyStage].filter((s) => nameRe.test(String(s.name ?? '')));
  const uniqueCandidates = Array.from(new Map(candidates.map((s) => [s.id, s])).values());
  console.log(JSON.stringify(uniqueCandidates, null, 2));

  console.log('\nListo. Ningún dato fue modificado en Odoo (solo fields_get/search_read).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
