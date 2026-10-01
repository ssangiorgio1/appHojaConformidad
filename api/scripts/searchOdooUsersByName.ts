// Diagnóstico manual, de SOLO LECTURA — busca res.users por nombre (mismo
// buscador que usa /api/incidencia-destinatarios/buscar-odoo del panel).
// Uso: pnpm --filter @wara/api exec tsx scripts/searchOdooUsersByName.ts <query>
import { searchOdooUsers } from '../src/services/odoo.service.js';

async function main() {
  const query = process.argv[2];
  if (!query) {
    console.error('Uso: tsx scripts/searchOdooUsersByName.ts <query>');
    process.exit(1);
  }
  console.log(JSON.stringify(await searchOdooUsers(query), null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
