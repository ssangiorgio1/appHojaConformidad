// Destraba visitas "pegadas" de un técnico: lista sus viajes abiertos (en_camino/en_sitio) y, con --apply,
// los CIERRA (abierta:false) — mismo efecto que cancelarVisita en el controller: sin Telegram al cliente,
// sin marcarlos 'completo', conservando Salió/Llegó para el reporte. No toca ninguna Conformidad.
// Uso (por defecto solo lista):
//   tsx scripts/cerrarVisitasAbiertas.ts <email del técnico> [--apply]
import { connectDB } from '../src/config/db.js';
import { UsuarioModel } from '../src/models/Usuario.js';
import { VisitaNotificacionModel } from '../src/models/VisitaNotificacion.js';
import mongoose from 'mongoose';

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const apply = process.argv.includes('--apply');
  if (!email) {
    console.error('Uso: tsx scripts/cerrarVisitasAbiertas.ts <email del técnico> [--apply]');
    process.exit(1);
  }
  await connectDB();
  const usuario = await UsuarioModel.findOne({ email });
  if (!usuario) {
    console.log(`No hay ningún usuario con email ${email}.`);
    await mongoose.disconnect();
    process.exit(1);
  }
  const abiertas = await VisitaNotificacionModel.find({
    tecnicoId: usuario._id,
    abierta: true,
    estado: { $in: ['en_camino', 'en_sitio'] },
  }).sort({ updatedAt: -1 });

  console.log(`${usuario.nombre} (${email}): ${abiertas.length} visita(s) abierta(s)`);
  for (const v of abiertas) {
    console.log(
      `  _id=${v._id} tarea=#${v.tareaOdooId} fecha=${v.fecha} estado=${v.estado} enCamino=${v.enCaminoAt?.toISOString() ?? '-'} actualizada=${v.updatedAt?.toISOString() ?? '-'}`,
    );
  }
  if (apply && abiertas.length) {
    const res = await VisitaNotificacionModel.updateMany({ _id: { $in: abiertas.map((v) => v._id) } }, { $set: { abierta: false } });
    console.log(`Cerradas: ${res.modifiedCount}`);
  } else if (abiertas.length) {
    console.log('Solo listado. Para cerrarlas: agregá --apply');
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
