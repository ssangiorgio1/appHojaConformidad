// Diagnóstico manual, de SOLO LECTURA — busca un res.users de Odoo por email
// (para completar/verificar el odooUserId de un Usuario en Mongo).
// Uso: pnpm --filter @wara/api exec tsx scripts/lookupOdooUser.ts <email>
import { executeKw } from '../src/config/odoo.js';

async function main() {
  const email = process.argv[2]?.toLowerCase().trim();
  if (!email) {
    console.error('Uso: tsx scripts/lookupOdooUser.ts <email>');
    process.exit(1);
  }

  const users = (await executeKw('res.users', 'search_read', [['|', ['login', '=', email], ['email', '=', email]]], {
    fields: ['id', 'name', 'login', 'email', 'active'],
  })) as Array<Record<string, unknown>>;
  console.log(JSON.stringify(users, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
