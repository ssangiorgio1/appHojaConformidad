// Borra SubtareaIncidencia por id de Mongo (limpieza puntual de datos de
// prueba). Uso: pnpm --filter @wara/api exec tsx scripts/cleanupIncidencias.ts <mongoId> ...
import { connectDB } from '../src/config/db.js';
import { SubtareaIncidenciaModel } from '../src/models/SubtareaIncidencia.js';
import mongoose from 'mongoose';

async function main() {
  const ids = process.argv.slice(2);
  if (!ids.length) {
    console.error('Uso: tsx scripts/cleanupIncidencias.ts <mongoId> ...');
    process.exit(1);
  }
  await connectDB();
  const res = await SubtareaIncidenciaModel.deleteMany({ _id: { $in: ids } });
  console.log(`Borradas: ${res.deletedCount}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
