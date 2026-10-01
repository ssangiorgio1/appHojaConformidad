// Diagnóstico manual, de SOLO LECTURA — ¿qué tan reciente es el duplicado de
// staging? Mira las últimas cotizaciones/productos por write_date.
// Uso: tsx scripts/checkStagingFreshness.ts
import { executeKw } from '../src/config/odoo.js';

async function main() {
  const orders = (await executeKw('sale.order', 'search_read', [[]], {
    fields: ['id', 'name', 'write_date', 'create_date'],
    order: 'write_date desc',
    limit: 5,
  })) as Array<Record<string, unknown>>;
  console.log('Últimas cotizaciones (sale.order) por write_date:', JSON.stringify(orders, null, 2));

  const products = (await executeKw('product.template', 'search_read', [[]], {
    fields: ['id', 'name', 'write_date'],
    order: 'write_date desc',
    limit: 5,
  })) as Array<Record<string, unknown>>;
  console.log('Últimos productos por write_date:', JSON.stringify(products, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
