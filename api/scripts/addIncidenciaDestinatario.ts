// Agrega un destinatario de mail.activity de "reprogramar" (ver
// IncidenciaDestinatario.ts / scheduleSubtareaReprogramarActivity) — mismo
// efecto que hacerlo desde el panel (POST /api/incidencia-destinatarios),
// para cuando conviene cargarlo desde acá.
//
// Uso: pnpm --filter @wara/api exec tsx scripts/addIncidenciaDestinatario.ts <odooUserId> <nombre>
import { connectDB } from '../src/config/db.js';
import { IncidenciaDestinatarioModel } from '../src/models/IncidenciaDestinatario.js';
import mongoose from 'mongoose';

async function main() {
  const odooUserId = Number(process.argv[2]);
  const nombre = process.argv[3];
  if (!Number.isFinite(odooUserId) || !nombre) {
    console.error('Uso: tsx scripts/addIncidenciaDestinatario.ts <odooUserId> <nombre>');
    process.exit(1);
  }

  await connectDB();
  const existing = await IncidenciaDestinatarioModel.findOne({ odooUserId });
  if (existing) {
    console.log('Ya existía:', JSON.stringify(existing));
  } else {
    const created = await IncidenciaDestinatarioModel.create({ odooUserId, nombre });
    console.log('Creado:', JSON.stringify(created));
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
