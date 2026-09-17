// Diagnóstico manual, de SOLO LECTURA, para descubrir cómo modela esta
// instancia real de Odoo (producción, sin staging) las tareas de Field
// Service: qué proyecto es, qué campos tiene project.task para
// inicio/fin/asignado, y si hay una agrupación de "técnico" mejor que una
// lista de nombres hardcodeada. No hace ningún create/write/unlink.
//
// Uso: pnpm --filter @wara/api exec tsx scripts/discoverOdooTaskSchema.ts
import { executeKw } from '../src/config/odoo.js';

const DATE_FIELD_RE = /date|start|end|deadline|user|partner|project|fsm|planned|stage/i;
const FSM_PROJECT_NAME_RE = /servicio externo|field service|\bfsm\b/i;

interface FieldInfo {
  string: string;
  type: string;
  relation?: string;
}

async function main() {
  console.log('=== 1. project.task fields_get (filtrado) ===');
  const fields = (await executeKw('project.task', 'fields_get', [], {
    attributes: ['string', 'type', 'relation'],
  })) as Record<string, FieldInfo>;

  const candidateFieldNames = Object.keys(fields).filter((k) => DATE_FIELD_RE.test(k));
  for (const name of candidateFieldNames.sort()) {
    const f = fields[name];
    console.log(`  ${name}: type=${f.type}${f.relation ? ` relation=${f.relation}` : ''} (${f.string})`);
  }

  console.log('\n=== 2. Detección de proyecto Field Service ===');
  const projectFields = (await executeKw('project.project', 'fields_get', [], {
    attributes: ['string', 'type'],
  })) as Record<string, FieldInfo>;
  const hasIsFsm = 'is_fsm' in projectFields;
  console.log(`  is_fsm existe en project.project: ${hasIsFsm}`);

  let candidateProjects: Array<{ id: number; name: string }> = [];
  if (hasIsFsm) {
    candidateProjects = (await executeKw('project.project', 'search_read', [[['is_fsm', '=', true]]], {
      fields: ['id', 'name'],
    })) as Array<{ id: number; name: string }>;
    console.log(`  Proyectos con is_fsm=true: ${JSON.stringify(candidateProjects)}`);
  } else {
    const allProjects = (await executeKw('project.project', 'search_read', [[]], {
      fields: ['id', 'name'],
    })) as Array<{ id: number; name: string }>;
    console.log(`  Todos los proyectos (${allProjects.length}):`);
    for (const p of allProjects) console.log(`    [${p.id}] ${p.name}`);
    candidateProjects = allProjects.filter((p) => FSM_PROJECT_NAME_RE.test(p.name));
    console.log(`  Candidatos por nombre (fallback): ${JSON.stringify(candidateProjects)}`);
  }

  if (!candidateProjects.length) {
    console.log('\n  No se encontró un proyecto candidato de Field Service — revisar la lista completa arriba a mano.');
    return;
  }

  console.log('\n=== 3. Muestra de tareas recientes del/los proyecto(s) candidato(s) ===');
  const projectIds = candidateProjects.map((p) => p.id);
  const sampleFields = ['id', 'name', 'user_ids', 'partner_id', 'project_id', 'stage_id', 'parent_id', ...candidateFieldNames];
  const uniqueSampleFields = Array.from(new Set(sampleFields));

  const tasks = (await executeKw('project.task', 'search_read', [[['project_id', 'in', projectIds]]], {
    fields: uniqueSampleFields,
    limit: 10,
    order: 'write_date desc',
  })) as Array<Record<string, unknown>>;

  console.log(JSON.stringify(tasks, null, 2));

  console.log('\n=== 4. Tipos de los campos candidatos (date vs datetime) ===');
  for (const name of candidateFieldNames) {
    if (name in fields) console.log(`  ${name}: ${fields[name].type}`);
  }

  console.log('\n=== 5. Muestra de res.users (para evaluar agrupación de "técnico") ===');
  const users = (await executeKw('res.users', 'search_read', [[]], {
    fields: ['id', 'name', 'login'],
    limit: 30,
  })) as Array<{ id: number; name: string; login: string }>;
  console.log(JSON.stringify(users, null, 2));

  console.log('\nListo. Ningún dato fue modificado en Odoo (solo fields_get/search_read).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
