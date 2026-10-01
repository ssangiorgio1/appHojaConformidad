// Migración puntual, una sola vez: VisitaNotificacion pasó de único por
// (tareaOdooId, tecnicoId) a único por (tareaOdooId, tecnicoId, fecha) — ver
// el comentario en VisitaNotificacion.ts (una misma tareaOdooId ahora puede
// representar 2+ entradas de calendario simultáneas en fechas distintas). El
// índice viejo sigue viviendo en Mongo aunque ya no está en el schema —
// Mongoose no dropea índices viejos solo, hay que hacerlo a mano.
// syncIndexes() se encarga de dejar la colección con exactamente los índices
// que declara el schema hoy. Documentos históricos (ya cerrados, sin `fecha`)
// no se tocan — no hace falta backfill, ver el comentario en el modelo.
// Uso: pnpm --filter @wara/api exec tsx scripts/migrateVisitaNotificacionFechaIndex.ts
import { connectDB } from '../src/config/db.js';
import { VisitaNotificacionModel } from '../src/models/VisitaNotificacion.js';
import mongoose from 'mongoose';

async function main() {
  await connectDB();
  console.log('Índices antes:', await VisitaNotificacionModel.collection.indexes());
  const resultado = await VisitaNotificacionModel.syncIndexes();
  console.log('syncIndexes():', resultado);
  console.log('Índices después:', await VisitaNotificacionModel.collection.indexes());
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
