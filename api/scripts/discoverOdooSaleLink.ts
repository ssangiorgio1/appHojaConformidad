// Diagnóstico manual, de SOLO LECTURA, para confirmar si esta instancia de
// Odoo linkea project.task (tareas de Field Service) con sale.order.line
// (líneas de cotización/presupuesto) — necesario para saber si se puede
// mostrar "producto + cotización" en las hojas de conformidad sin más
// infraestructura que leer un par de modelos nuevos con el mismo executeKw
// genérico que ya se usa para helpdesk.ticket/project.task/res.users.
// No hace ningún create/write/unlink.
//
// Uso: pnpm --filter @wara/api exec tsx scripts/discoverOdooSaleLink.ts
import { executeKw } from '../src/config/odoo.js';

interface FieldInfo {
  string: string;
  type: string;
  relation?: string;
}

const SALE_FIELD_RE = /sale|order|invoice/i;

async function main() {
  console.log('=== 1. project.task fields_get — buscando campos relacionados a sale.order ===');
  const taskFields = (await executeKw('project.task', 'fields_get', [], {
    attributes: ['string', 'type', 'relation'],
  })) as Record<string, FieldInfo>;

  const candidateFieldNames = Object.keys(taskFields).filter((k) => SALE_FIELD_RE.test(k));
  if (!candidateFieldNames.length) {
    console.log('  Ningún campo de project.task matchea /sale|order|invoice/i.');
  }
  for (const name of candidateFieldNames.sort()) {
    const f = taskFields[name];
    console.log(`  ${name}: type=${f.type}${f.relation ? ` relation=${f.relation}` : ''} (${f.string})`);
  }

  const hasSaleLineId = 'sale_line_id' in taskFields;
  const hasSaleOrderId = 'sale_order_id' in taskFields;
  console.log(`\n  sale_line_id existe: ${hasSaleLineId}`);
  console.log(`  sale_order_id existe: ${hasSaleOrderId}`);

  if (!hasSaleLineId && !hasSaleOrderId) {
    console.log('\n  Ninguno de los dos campos existe en este project.task — el vínculo task→cotización no es directo en esta instancia. Revisar candidateFieldNames de arriba por si hay otro nombre de campo relevante.');
    return;
  }

  console.log('\n=== 2. Proyectos de Field Service (mismo criterio que calendarTask.service.ts) ===');
  const projects = (await executeKw('project.project', 'search_read', [[['is_fsm', '=', true]]], {
    fields: ['id', 'name'],
  })) as Array<{ id: number; name: string }>;
  console.log(`  Proyectos FSM: ${JSON.stringify(projects)}`);
  const projectIds = projects.map((p) => p.id);
  if (!projectIds.length) {
    console.log('  Sin proyectos FSM — no se puede muestrear tareas reales.');
    return;
  }

  console.log('\n=== 3. Muestra de tareas recientes — ¿vienen pobladas? ===');
  const sampleFields = ['id', 'name', 'parent_id', ...candidateFieldNames];
  const tasks = (await executeKw('project.task', 'search_read', [[['project_id', 'in', projectIds]]], {
    fields: Array.from(new Set(sampleFields)),
    limit: 15,
    order: 'write_date desc',
  })) as Array<Record<string, unknown>>;
  console.log(JSON.stringify(tasks, null, 2));

  const populatedCount = tasks.filter((t) => (hasSaleLineId ? t.sale_line_id : t.sale_order_id)).length;
  console.log(`\n  De ${tasks.length} tareas muestreadas, ${populatedCount} tienen el campo de venta poblado.`);

  if (!populatedCount) {
    console.log('  Ninguna tarea de la muestra tiene el campo poblado — puede ser que estas tareas no vengan de una cotización, o que la muestra no sea representativa. Probar con más tareas o filtrando por un ticket conocido que sí tenga cotización.');
    return;
  }

  const withSaleLine = tasks.find((t) => (hasSaleLineId ? t.sale_line_id : t.sale_order_id));
  const saleLineRef = hasSaleLineId ? (withSaleLine!.sale_line_id as [number, string]) : null;
  const saleOrderRef = hasSaleOrderId ? (withSaleLine!.sale_order_id as [number, string]) : null;

  if (saleLineRef) {
    console.log(`\n=== 4. sale.order.line real (id ${saleLineRef[0]}) ===`);
    const lines = (await executeKw('sale.order.line', 'read', [[saleLineRef[0]]], {
      fields: ['id', 'name', 'product_id', 'price_unit', 'price_subtotal', 'order_id'],
    })) as Array<Record<string, unknown>>;
    console.log(JSON.stringify(lines, null, 2));
  }

  if (saleOrderRef) {
    console.log(`\n=== 5. sale.order real (id ${saleOrderRef[0]}) ===`);
    const orders = (await executeKw('sale.order', 'read', [[saleOrderRef[0]]], {
      fields: ['id', 'name', 'amount_total', 'state', 'partner_id'],
    })) as Array<Record<string, unknown>>;
    console.log(JSON.stringify(orders, null, 2));
  }

  console.log('\nListo. Ningún dato fue modificado en Odoo (solo fields_get/search_read/read).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
