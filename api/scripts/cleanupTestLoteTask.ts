// Borra ÚNICAMENTE los ids pasados por argumento (los que armamos nosotros
// para probar sobre el ticket #37739) — no toca ningún otro registro.
// Uso: pnpm --filter @wara/api exec tsx scripts/cleanupTestLoteTask.ts <id1> <id2> ...
import { executeKw } from '../src/config/odoo.js';

async function main() {
  const ids = process.argv.slice(2).map(Number).filter(Boolean);
  if (!ids.length) {
    console.error('Uso: tsx scripts/cleanupTestLoteTask.ts <id1> <id2> ...');
    process.exit(1);
  }
  console.log('Borrando SOLO estos ids de project.task:', ids);
  await executeKw('project.task', 'unlink', [ids]);
  console.log('Listo.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
