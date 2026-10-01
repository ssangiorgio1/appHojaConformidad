// Cierre manual de UNA visita puntual (ver finalizarVisitaLote en el
// controller) — para destrabar tickets de prueba sin pasar por la PWA de
// otro técnico. Dispara el mismo notificarEstadoVisita('completo', ...) que
// usa el endpoint real, así que también manda el Telegram si hay chatId.
// Uso: tsx scripts/finalizarVisitaManual.ts <tareaOdooId>
import { connectDB } from '../src/config/db.js';
import { VisitaNotificacionModel } from '../src/models/VisitaNotificacion.js';
import { notificarEstadoVisita } from '../src/services/telegram.service.js';
import mongoose from 'mongoose';

async function main() {
  const tareaOdooId = Number(process.argv[2]);
  if (!tareaOdooId) {
    console.error('Uso: tsx scripts/finalizarVisitaManual.ts <tareaOdooId>');
    process.exit(1);
  }
  await connectDB();
  // Desde 2026-09-25 puede haber más de un viaje ABIERTO para la misma tarea
  // (uno por técnico, ver VisitaNotificacion.ts) — este script solo cierra
  // el primero que encuentre. Si hay 2 técnicos con viaje abierto en la misma
  // tarea, correr esto de nuevo para cerrar el otro.
  const abierta = await VisitaNotificacionModel.findOne({ tareaOdooId, abierta: true });
  if (!abierta?.tecnicoId) {
    console.log('No hay ninguna visita abierta (con técnico) para esa tarea.');
    process.exit(1);
  }
  console.log('Cerrando visita de', abierta.tecnicoId.toString(), '...');
  const visita = await notificarEstadoVisita(tareaOdooId, 'completo', abierta.tecnicoId, abierta.fecha);
  console.log({ estado: visita.estado, abierta: visita.abierta, completoAt: visita.completoAt });
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
