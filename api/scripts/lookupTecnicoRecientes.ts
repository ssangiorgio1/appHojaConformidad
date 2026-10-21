// Diagnóstico manual, de SOLO LECTURA: hojas recientes de un técnico (por nombre), para ver duplicados de un mismo PRE.
// Uso: pnpm --filter @wara/api exec tsx scripts/lookupTecnicoRecientes.ts <nombre> [dias]
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { ConformidadModel } from '../src/models/Conformidad.js';
import { UsuarioModel } from '../src/models/Usuario.js';

async function main() {
  const nombre = process.argv[2];
  const dias = Number(process.argv[3] ?? 3);
  if (!nombre) throw new Error('Uso: tsx scripts/lookupTecnicoRecientes.ts <nombre> [dias]');
  await connectDB();
  const usuarios = await UsuarioModel.find({ nombre: new RegExp(nombre, 'i') }, { nombre: 1, email: 1, role: 1 }).lean();
  console.log('Usuarios:', usuarios.map((u) => ({ id: String(u._id), nombre: u.nombre, email: u.email, role: u.role })));
  const desde = new Date(Date.now() - dias * 86_400_000);
  for (const u of usuarios) {
    const docs = await ConformidadModel.find({ tecnicoId: u._id, createdAt: { $gte: desde } }).sort({ createdAt: -1 }).lean();
    console.log(`\n== ${u.nombre}: ${docs.length} hojas desde ${desde.toISOString()}`);
    for (const d of docs) {
      console.log({
        _id: String(d._id),
        clientId: d.clientId,
        status: d.status,
        matricula: d.matricula,
        fecha: d.fecha,
        tipo: d.tipoServicio,
        tarea: d.tareaOdoo?.id,
        subtarea: d.subtareaOdoo?.id,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        preFotos: d.pre?.fotos?.length ?? 0,
        preFirma: Boolean(d.pre?.firma?.url || d.pre?.firma?.clienteAusente),
        preOdooSync: d.preOdooSync?.status,
        deletedAt: d.deletedAt,
      });
    }
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
