// Diagnóstico manual, de SOLO LECTURA — lista Conformidad por tareaOdoo.id
// (para depurar residuos de pruebas). Uso: tsx scripts/lookupConformidadesByTarea.ts <tareaOdooId>
import { connectDB } from '../src/config/db.js';
import { ConformidadModel } from '../src/models/Conformidad.js';
import mongoose from 'mongoose';

async function main() {
  const tareaOdooId = Number(process.argv[2]);
  if (!tareaOdooId) {
    console.error('Uso: tsx scripts/lookupConformidadesByTarea.ts <tareaOdooId>');
    process.exit(1);
  }
  await connectDB();
  const docs = await ConformidadModel.find({ 'tareaOdoo.id': tareaOdooId, deletedAt: null }).sort({ createdAt: 1 });
  console.log(
    docs.map((d) => ({
      _id: d._id.toString(),
      clientId: d.clientId,
      status: d.status,
      matricula: d.matricula,
      subtareaOdoo: d.subtareaOdoo,
      createdAt: d.createdAt,
    })),
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
