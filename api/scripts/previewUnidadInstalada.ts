// Diagnóstico manual, de SOLO LECTURA — muestra cómo quedaría el payload de
// "unidad instalada" (maqueta para BO4, ver ALCANCE_BACKOFFICE.md §14.6 y
// unidadInstalada.mapper.ts) para una Conformidad o una SubtareaIncidencia
// real. No escribe nada, no llama a Odoo.
// Uso:
//   tsx scripts/previewUnidadInstalada.ts conformidad <mongoId>
//   tsx scripts/previewUnidadInstalada.ts incidencia <mongoId>
import { connectDB } from '../src/config/db.js';
import { ConformidadModel } from '../src/models/Conformidad.js';
import { SubtareaIncidenciaModel } from '../src/models/SubtareaIncidencia.js';
import { mapConformidadAUnidadInstalada, mapIncidenciaAUnidadInstalada } from '../src/services/unidadInstalada.mapper.js';
import mongoose from 'mongoose';

async function main() {
  const [tipo, id] = process.argv.slice(2);
  if (!tipo || !id || !['conformidad', 'incidencia'].includes(tipo)) {
    console.error('Uso: tsx scripts/previewUnidadInstalada.ts <conformidad|incidencia> <mongoId>');
    process.exit(1);
  }
  await connectDB();

  if (tipo === 'conformidad') {
    const record = await ConformidadModel.findById(id);
    if (!record) throw new Error('No existe esa Conformidad.');
    console.log(JSON.stringify(mapConformidadAUnidadInstalada(record), null, 2));
  } else {
    const incidencia = await SubtareaIncidenciaModel.findById(id);
    if (!incidencia) throw new Error('No existe esa incidencia.');
    console.log(JSON.stringify(mapIncidenciaAUnidadInstalada(incidencia), null, 2));
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
