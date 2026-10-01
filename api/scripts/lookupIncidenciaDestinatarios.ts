import { connectDB } from '../src/config/db.js';
import { IncidenciaDestinatarioModel } from '../src/models/IncidenciaDestinatario.js';
import mongoose from 'mongoose';

async function main() {
  await connectDB();
  const docs = await IncidenciaDestinatarioModel.find();
  console.log(docs.map((d) => ({ odooUserId: d.odooUserId, nombre: d.nombre })));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
