// Diagnóstico manual, de SOLO LECTURA, para inspeccionar el ticket S03937
// (#39058) y entender el campo de etiquetas de helpdesk.ticket: qué modelo
// es, si el técnico/coordinación puede crear etiquetas nuevas al vuelo desde
// el widget, y qué etiquetas existen hoy. No hace ningún create/write/unlink.
//
// Uso: pnpm --filter @wara/api exec tsx scripts/discoverTicketTags.ts
import { executeKw } from '../src/config/odoo.js';

interface FieldInfo {
  string: string;
  type: string;
  relation?: string;
}

async function main() {
  console.log('=== 1. Campos de helpdesk.ticket relacionados a tags/etiquetas ===');
  const fields = (await executeKw('helpdesk.ticket', 'fields_get', [], {
    attributes: ['string', 'type', 'relation'],
  })) as Record<string, FieldInfo>;
  const tagFieldNames = Object.keys(fields).filter((k) => /tag|categ|etiqueta/i.test(k));
  for (const name of tagFieldNames.sort()) {
    const f = fields[name];
    console.log(`  ${name}: type=${f.type}${f.relation ? ` relation=${f.relation}` : ''} (${f.string})`);
  }

  console.log('\n=== 2. Ticket #39058 (S03937 - Instalación GPS) ===');
  const tickets = (await executeKw('helpdesk.ticket', 'search_read', [[['id', '=', 39058]]], {
    fields: ['id', 'name', ...tagFieldNames],
  })) as Array<Record<string, unknown>>;
  console.log(JSON.stringify(tickets, null, 2));

  if (fields.tag_ids?.relation) {
    const relation = fields.tag_ids.relation;
    if (relation) {
      console.log(`\n=== 3. Todas las etiquetas existentes en ${relation} ===`);
      const allTags = (await executeKw(relation, 'search_read', [[]], {
        fields: ['id', 'name'],
      })) as Array<{ id: number; name: string }>;
      console.log(JSON.stringify(allTags, null, 2));

      console.log(`\n=== 4. ir.model.access sobre ${relation} (¿quién puede crear registros?) ===`);
      const access = (await executeKw('ir.model.access', 'search_read', [[['model_id.model', '=', relation]]], {
        fields: ['name', 'group_id', 'perm_read', 'perm_write', 'perm_create', 'perm_unlink'],
      })) as Array<Record<string, unknown>>;
      console.log(JSON.stringify(access, null, 2));
    }
  }

  console.log('\nListo. Ningún dato fue modificado en Odoo (solo fields_get/search_read).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
