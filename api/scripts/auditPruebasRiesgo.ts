// SOLO LECTURA: hojas que coinciden con usuarios de prueba por una vía que NO es tecnicoId.
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { ConformidadModel } from '../src/models/Conformidad.js';
import { UsuarioModel } from '../src/models/Usuario.js';

async function main() {
  await connectDB();
  const us = await UsuarioModel.find({ nombre: /Joaquin Prueba|T[eé]cnico Prueba Claude|^prueba$/i }, { nombre: 1 }).lean();
  const ids = us.map((u) => u._id);
  const nombres = us.map((u) => u.nombre);
  const docs = await ConformidadModel.find({
    tecnicoId: { $nin: ids },
    $or: [{ tecnicoIdPost: { $in: ids } }, { instalador: { $in: nombres } }],
  }).lean();
  console.log('Hojas de OTRO tecnicoId que matchean por post/instalador:', docs.length);
  for (const d of docs) console.log(String(d._id), d.codigoActa, d.tecnicoId, d.tecnicoIdPost, d.instalador, d.matricula, d.status);
  const porUsuario = await Promise.all(us.map(async (u) => [u.nombre, await ConformidadModel.countDocuments({ tecnicoId: u._id })] as const));
  console.log('Por tecnicoId:', porUsuario);
  const reales = await ConformidadModel.countDocuments({ tecnicoId: { $nin: ids } });
  console.log('Hojas de otros técnicos (se conservarían):', reales);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
