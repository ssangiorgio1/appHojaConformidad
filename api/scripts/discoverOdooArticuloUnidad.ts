// Diagnóstico manual, de SOLO LECTURA, a pedido explícito del equipo
// (2026-09-25) tras ver en la UI de Odoo Field Service una columna
// "Artículo de la orden de venta" poblada en una tarea real (QEW233) —
// contradice en apariencia el hallazgo previo de discoverOdooSaleLink.ts
// (sale_line_id vacío en el 100% de una muestra de LOTES). Este script
// confirma qué campo es realmente esa columna, si viene poblado también
// para tareas sueltas (no-lote), y si project.task admite más de un
// artículo/producto por tarea (para no forzar una Conformidad separada
// cuando se instalan/desinstalan varios productos en la misma unidad).
// No hace ningún create/write/unlink.
//
// Uso: pnpm --filter @wara/api exec tsx scripts/discoverOdooArticuloUnidad.ts
import { executeKw } from '../src/config/odoo.js';

interface FieldInfo {
  string: string;
  type: string;
  relation?: string;
}

async function main() {
  console.log('=== 1. project.task fields_get — campos cuyo label contiene "artículo" o "orden de venta" ===');
  const taskFields = (await executeKw('project.task', 'fields_get', [], {
    attributes: ['string', 'type', 'relation'],
  })) as Record<string, FieldInfo>;

  for (const [name, f] of Object.entries(taskFields)) {
    if (/art[ií]culo|sale.*order|order.*line|sale_line/i.test(`${name} ${f.string}`)) {
      console.log(`  ${name}: type=${f.type}${f.relation ? ` relation=${f.relation}` : ''} (${f.string})`);
    }
  }

  console.log('\n=== 2. Buscar la tarea "QEW233" por nombre ===');
  const byName = (await executeKw('project.task', 'search_read', [[['name', 'ilike', 'QEW233']]], {
    fields: ['id', 'name', 'sale_line_id', 'sale_order_id', 'partner_id', 'parent_id', 'stage_id', 'fsm_done'],
  })) as Array<Record<string, unknown>>;
  console.log(JSON.stringify(byName, null, 2));

  if (byName.length) {
    const task = byName[0];
    const saleLineRef = task.sale_line_id as [number, string] | false;
    if (saleLineRef) {
      console.log(`\n=== 3. sale.order.line real (id ${saleLineRef[0]}) vinculado a esa tarea ===`);
      const line = (await executeKw('sale.order.line', 'read', [[saleLineRef[0]]], {
        fields: ['id', 'name', 'product_id', 'product_uom_qty', 'price_unit', 'price_subtotal', 'order_id', 'task_id'],
      })) as Array<Record<string, unknown>>;
      console.log(JSON.stringify(line, null, 2));

      const orderRef = line[0].order_id as [number, string];
      console.log(`\n=== 4. Todas las líneas de esa orden de venta (id ${orderRef[0]}) — ¿cuántas apuntan a esta misma tarea? ===`);
      const allLines = (await executeKw('sale.order.line', 'search_read', [[['order_id', '=', orderRef[0]]]], {
        fields: ['id', 'name', 'product_id', 'task_id', 'product_uom_qty'],
      })) as Array<Record<string, unknown>>;
      console.log(JSON.stringify(allLines, null, 2));

      const sameTaskLines = allLines.filter((l) => {
        const t = l.task_id as [number, string] | false;
        return t && t[0] === task.id;
      });
      console.log(`\n  De ${allLines.length} líneas de la orden, ${sameTaskLines.length} apuntan a la tarea ${task.id} (task_id de sale.order.line).`);
    }
  }

  console.log('\n=== 5. ¿"task_id" en sale.order.line es Many2one (1 tarea por línea) o hay algo Many2many del lado de project.task? ===');
  const saleLineFields = (await executeKw('sale.order.line', 'fields_get', [], {
    attributes: ['string', 'type', 'relation'],
  })) as Record<string, FieldInfo>;
  if ('task_id' in saleLineFields) {
    const f = saleLineFields.task_id;
    console.log(`  sale.order.line.task_id: type=${f.type}${f.relation ? ` relation=${f.relation}` : ''} (${f.string})`);
  }
  const taskSaleRelated = Object.entries(taskFields).filter(([, f]) => f.type === 'many2many' && /sale|order/i.test(f.relation ?? ''));
  console.log(`  Campos many2many en project.task que relacionan a algo de sale/order: ${JSON.stringify(taskSaleRelated.map(([n]) => n))}`);

  console.log('\n=== 6. Muestra amplia: de tareas recientes NO-lote (sin parent_id, is_fsm project), ¿cuántas tienen sale_line_id poblado? ===');
  const projects = (await executeKw('project.project', 'search_read', [[['is_fsm', '=', true]]], {
    fields: ['id', 'name'],
  })) as Array<{ id: number; name: string }>;
  const projectIds = projects.map((p) => p.id);
  const recent = (await executeKw(
    'project.task',
    'search_read',
    [[['project_id', 'in', projectIds], ['parent_id', '=', false]]],
    { fields: ['id', 'name', 'sale_line_id', 'sale_order_id'], limit: 25, order: 'write_date desc' },
  )) as Array<Record<string, unknown>>;
  const populated = recent.filter((t) => t.sale_line_id);
  console.log(`  De ${recent.length} tareas padre/sueltas (sin parent_id), ${populated.length} tienen sale_line_id poblado.`);
  console.log(JSON.stringify(recent, null, 2));

  console.log('\nListo. Ningún dato fue modificado en Odoo (solo fields_get/search_read/read).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
