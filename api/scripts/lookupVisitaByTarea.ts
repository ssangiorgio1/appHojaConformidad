// Diagnóstico manual, de SOLO LECTURA — VisitaNotificacion + técnico dueño
// para una tareaOdooId puntual (debug de 403 en /finalizar o /estado).
// Uso: tsx scripts/lookupVisitaByTarea.ts <tareaOdooId>
import { connectDB } from '../src/config/db.js';
import { VisitaNotificacionModel } from '../src/models/VisitaNotificacion.js';
import { UsuarioModel } from '../src/models/Usuario.js';
import mongoose from 'mongoose';

async function main() {
  const tareaOdooId = Number(process.argv[2]);
  if (!tareaOdooId) {
    console.error('Uso: tsx scripts/lookupVisitaByTarea.ts <tareaOdooId>');
    process.exit(1);
  }
  await connectDB();
  const docs = await VisitaNotificacionModel.find({ tareaOdooId }).sort({ createdAt: 1 });
  for (const d of docs) {
    const usuario = d.tecnicoId ? await UsuarioModel.findById(d.tecnicoId) : null;
    console.log({
      _id: d._id.toString(),
      estado: d.estado,
      abierta: d.abierta,
      tecnicoId: d.tecnicoId?.toString() ?? null,
      tecnicoEmail: usuario?.email ?? null,
      tecnicoOdooUserId: usuario?.odooUserId ?? null,
      enCaminoAt: d.enCaminoAt,
      enSitioAt: d.enSitioAt,
      completoAt: d.completoAt,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    });
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
