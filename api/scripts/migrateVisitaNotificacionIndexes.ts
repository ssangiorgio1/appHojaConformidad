// Migración puntual, una sola vez: el modelo pasó de "un documento por
// tareaOdooId, para siempre" a "un documento por VIAJE, con a lo sumo uno
// abierto por tarea" (ver VisitaNotificacion.ts, sesión 2026-09-16). El
// índice único viejo (`tareaOdooId_1`, sin partialFilterExpression) sigue
// viviendo en Mongo aunque ya no está en el schema — Mongoose no dropea
// índices viejos solo, hay que hacerlo a mano. syncIndexes() se encarga de
// dejar la colección con exactamente los índices que declara el schema hoy.
// Uso: pnpm --filter @wara/api exec tsx scripts/migrateVisitaNotificacionIndexes.ts
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
