// Limpieza puntual: borra una VisitaNotificacion por tareaOdooId y una
// Conformidad por _id (residuos de prueba). Uso:
// tsx scripts/cleanupVisitaAndConformidad.ts <tareaOdooId> [conformidadId]
import { connectDB } from '../src/config/db.js';
import { VisitaNotificacionModel } from '../src/models/VisitaNotificacion.js';
import { ConformidadModel } from '../src/models/Conformidad.js';
import mongoose from 'mongoose';

async function main() {
  const tareaOdooId = Number(process.argv[2]);
  const conformidadId = process.argv[3];
  if (!tareaOdooId) {
    console.error('Uso: tsx scripts/cleanupVisitaAndConformidad.ts <tareaOdooId> [conformidadId]');
    process.exit(1);
  }
  await connectDB();
  const v = await VisitaNotificacionModel.deleteOne({ tareaOdooId });
  console.log(`VisitaNotificacion borradas (tareaOdooId=${tareaOdooId}):`, v.deletedCount);
  if (conformidadId) {
    const c = await ConformidadModel.deleteOne({ _id: conformidadId });
    console.log(`Conformidad borrada (${conformidadId}):`, c.deletedCount);
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
