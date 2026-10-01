// Diagnóstico manual, de SOLO LECTURA: trae el documento completo (campos
// relevantes) de una Conformidad por matrícula, para depurar por qué no
// disparó el marcado en Odoo al completarse. No escribe nada.
//
// Uso: pnpm --filter @wara/api exec tsx scripts/lookupConformidadFull.ts <matricula>
import { connectDB } from '../src/config/db.js';
import { ConformidadModel } from '../src/models/Conformidad.js';
import mongoose from 'mongoose';

async function main() {
  const matricula = process.argv[2];
  await connectDB();
  const docs = await ConformidadModel.find({ matricula }).sort({ createdAt: -1 }).limit(10);
  console.log(
    docs.map((d) => ({
      _id: d._id.toString(),
      status: d.status,
      tipoServicio: d.tipoServicio,
      cambioEquipo: d.cambioEquipo,
      tecnicoId: d.tecnicoId,
      tareaOdoo: d.tareaOdoo,
      subtareaOdoo: d.subtareaOdoo,
      postFirma: d.post?.firma,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    })),
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
