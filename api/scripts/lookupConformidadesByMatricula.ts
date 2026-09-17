import { connectDB } from '../src/config/db.js';
import { ConformidadModel } from '../src/models/Conformidad.js';
import mongoose from 'mongoose';

async function main() {
  const matricula = process.argv[2];
  await connectDB();
  const docs = await ConformidadModel.find({ matricula }).sort({ createdAt: -1 }).limit(10);
  console.log(
    docs.map((d) => ({
      _id: d._id.toString(),
      clientId: d.clientId,
      status: d.status,
      matricula: d.matricula,
      tareaOdoo: d.tareaOdoo,
      subtareaOdoo: d.subtareaOdoo,
      odooSync: d.odooSync,
      deletedAt: d.deletedAt,
      createdAt: d.createdAt,
    })),
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
