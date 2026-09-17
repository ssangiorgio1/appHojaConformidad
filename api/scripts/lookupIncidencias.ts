// Diagnóstico manual, de SOLO LECTURA — lista las SubtareaIncidencia
// guardadas (para saber cuáles limpiar al rearmar el escenario de prueba).
// Uso: pnpm --filter @wara/api exec tsx scripts/lookupIncidencias.ts
import { connectDB } from '../src/config/db.js';
import { SubtareaIncidenciaModel } from '../src/models/SubtareaIncidencia.js';
import mongoose from 'mongoose';

async function main() {
  await connectDB();
  const docs = await SubtareaIncidenciaModel.find({}).sort({ createdAt: -1 }).limit(20);
  console.log(docs.map((d) => d.toObject()));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
