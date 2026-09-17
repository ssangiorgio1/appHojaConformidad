// Diagnóstico manual, de SOLO LECTURA — lista VisitaNotificacion en
// en_camino/en_sitio para un técnico (para detectar residuos de pruebas).
// Uso: tsx scripts/lookupVisitasActivas.ts <tecnicoEmail>
import { connectDB } from '../src/config/db.js';
import { UsuarioModel } from '../src/models/Usuario.js';
import { VisitaNotificacionModel } from '../src/models/VisitaNotificacion.js';
import mongoose from 'mongoose';

async function main() {
  const email = process.argv[2]?.toLowerCase().trim();
  if (!email) {
    console.error('Uso: tsx scripts/lookupVisitasActivas.ts <email>');
    process.exit(1);
  }
  await connectDB();
  const usuario = await UsuarioModel.findOne({ email });
  if (!usuario) {
    console.log('No existe ese usuario.');
    process.exit(1);
  }
  const docs = await VisitaNotificacionModel.find({ tecnicoId: usuario._id, estado: { $in: ['en_camino', 'en_sitio'] } });
  console.log(
    docs.map((d) => ({
      _id: d._id.toString(),
      tareaOdooId: d.tareaOdooId,
      estado: d.estado,
      enCaminoAt: d.enCaminoAt,
      enSitioAt: d.enSitioAt,
      updatedAt: d.updatedAt,
    })),
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
