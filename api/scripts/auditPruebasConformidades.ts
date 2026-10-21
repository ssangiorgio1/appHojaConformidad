// Diagnóstico manual, de SOLO LECTURA: hojas de los usuarios de prueba, para decidir qué borrar.
// Uso: pnpm --filter @wara/api exec tsx scripts/auditPruebasConformidades.ts "<regex nombre>"
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { ConformidadModel } from '../src/models/Conformidad.js';
import { UsuarioModel } from '../src/models/Usuario.js';

async function main() {
  const patron = process.argv[2] ?? 'Joaquin Prueba|T[eé]cnico Prueba Claude|^prueba$';
  await connectDB();
  const usuarios = await UsuarioModel.find({ nombre: new RegExp(patron, 'i') }, { nombre: 1, email: 1, role: 1 }).lean();
  console.log('Usuarios que matchean:', usuarios.map((u) => ({ id: String(u._id), nombre: u.nombre, email: u.email, role: u.role })));
  const ids = usuarios.map((u) => u._id);
  const nombres = usuarios.map((u) => u.nombre);
  const docs = await ConformidadModel.find({
    $or: [{ tecnicoId: { $in: ids } }, { tecnicoIdPost: { $in: ids } }, { instalador: { $in: nombres } }],
  })
    .sort({ createdAt: 1 })
    .lean();
  console.log(`\nTotal hojas: ${docs.length}`);
  for (const d of docs) {
    console.log(
      [
        String(d._id),
        d.codigoActa,
        d.status,
        d.tipoServicio,
        d.matricula,
        d.fecha,
        `tec=${usuarios.find((u) => String(u._id) === String(d.tecnicoId))?.nombre ?? d.tecnicoId} inst=${d.instalador}`,
        `ticket=${d.ticketOdoo?.numero ?? '-'}`,
        `tarea=${d.tareaOdoo?.id ?? '-'}`,
        `odoo=${d.odooSync?.status}/${d.preOdooSync?.status}`,
        `del=${d.deletedAt ? 'si' : 'no'}`,
      ].join(' | '),
    );
  }
  const conOdoo = docs.filter((d) => d.ticketOdoo?.numero || d.tareaOdoo?.id || d.odooSync?.status === 'SYNCED' || d.preOdooSync?.status === 'SYNCED');
  console.log(`\nCon vínculo/sync a Odoo: ${conOdoo.length}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
