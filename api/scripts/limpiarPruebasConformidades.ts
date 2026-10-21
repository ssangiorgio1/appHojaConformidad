// Limpieza puntual: borra las hojas de los usuarios de prueba (por tecnicoId) y sus archivos en R2.
// Hace backup JSON antes. Sin --apply es dry-run.
// Uso: tsx scripts/limpiarPruebasConformidades.ts <backup.json> [--apply]
import fs from 'node:fs';
import mongoose from 'mongoose';
import { DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { connectDB } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { r2Client } from '../src/config/r2.js';
import { ConformidadModel } from '../src/models/Conformidad.js';
import { UsuarioModel } from '../src/models/Usuario.js';

async function main() {
  const backup = process.argv[2];
  const apply = process.argv.includes('--apply');
  if (!backup) throw new Error('Uso: tsx scripts/limpiarPruebasConformidades.ts <backup.json> [--apply]');
  await connectDB();
  const us = await UsuarioModel.find({ nombre: /^Joaquin prueba$|^T[eé]cnico Prueba Claude$|^prueba$/i }, { nombre: 1 }).lean();
  console.log('Usuarios:', us.map((u) => u.nombre));
  if (us.length !== 3) throw new Error(`Esperaba 3 usuarios, hay ${us.length}`);
  const docs = await ConformidadModel.find({ tecnicoId: { $in: us.map((u) => u._id) } }).lean();
  fs.writeFileSync(backup, JSON.stringify(docs, null, 1));
  const keys = new Set<string>();
  for (const d of docs) {
    for (const f of [...(d.pre?.fotos ?? []), ...(d.post?.fotos ?? [])]) if (f.key) keys.add(f.key);
    for (const k of [d.pre?.firma?.key, d.post?.firma?.key, d.pdfReporte?.key]) if (k) keys.add(k);
  }
  console.log(`Hojas: ${docs.length}, archivos R2: ${keys.size}, backup: ${backup}`);
  if (!apply) { console.log('Dry-run: no se borró nada.'); await mongoose.disconnect(); return; }
  const lista = [...keys];
  let borrados = 0;
  for (let i = 0; i < lista.length; i += 1000) {
    const lote = lista.slice(i, i + 1000);
    const r = await r2Client.send(new DeleteObjectsCommand({ Bucket: env.R2_BUCKET_NAME, Delete: { Objects: lote.map((Key) => ({ Key })), Quiet: true } }));
    borrados += lote.length - (r.Errors?.length ?? 0);
    if (r.Errors?.length) console.warn('Errores R2:', r.Errors.slice(0, 5));
  }
  console.log('Archivos R2 borrados:', borrados);
  const res = await ConformidadModel.deleteMany({ _id: { $in: docs.map((d) => d._id) } });
  console.log('Hojas borradas:', res.deletedCount);
  console.log('Restantes (otros técnicos):', await ConformidadModel.countDocuments());
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
