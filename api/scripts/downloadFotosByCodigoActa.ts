// Diagnóstico manual, de SOLO LECTURA sobre Mongo: busca una Conformidad por
// codigoActa y descarga todas las fotos (pre y post) desde sus URLs públicas
// de R2 a una carpeta local. No escribe nada en la base de datos.
//
// Uso: pnpm --filter @wara/api exec tsx scripts/downloadFotosByCodigoActa.ts <codigoActa> <carpetaDestino>
import { connectDB } from '../src/config/db.js';
import { ConformidadModel } from '../src/models/Conformidad.js';
import mongoose from 'mongoose';
import fs from 'node:fs';
import path from 'node:path';

async function descargar(url: string, destino: string) {
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`  FALLO (${res.status}) ${url}`);
    return;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destino, buf);
  console.log(`  OK -> ${destino}`);
}

async function main() {
  const codigoActa = process.argv[2];
  const carpeta = process.argv[3];
  if (!codigoActa || !carpeta) {
    console.error('Uso: tsx scripts/downloadFotosByCodigoActa.ts <codigoActa> <carpetaDestino>');
    process.exit(1);
  }

  await connectDB();
  const doc = await ConformidadModel.findOne({ codigoActa });
  if (!doc) {
    console.error(`No se encontró Conformidad con codigoActa=${codigoActa}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  fs.mkdirSync(carpeta, { recursive: true });

  const fases: Array<['pre' | 'post', any]> = [
    ['pre', doc.pre],
    ['post', doc.post],
  ];

  for (const [fase, data] of fases) {
    const fotos = data?.fotos ?? [];
    console.log(`${fase.toUpperCase()}: ${fotos.length} fotos`);
    for (const foto of fotos) {
      if (!foto.url) {
        console.warn(`  Sin URL (slot=${foto.slotKey ?? 'n/a'}, id=${foto.id})`);
        continue;
      }
      const ext = path.extname(new URL(foto.url).pathname) || '.jpg';
      const nombre = `${fase}_${foto.slotKey ?? 'foto'}_${foto.id}${ext}`;
      await descargar(foto.url, path.join(carpeta, nombre));
    }
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
