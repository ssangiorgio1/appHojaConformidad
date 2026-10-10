// Carga EXTRAORDINARIA de la hoja de conformidad de AC 278 ZG (ticket 39768, Renzo González) — el técnico la hizo
// en papel. Escribe en Mongo y sube las fotos a R2; NO toca Odoo ni genera/envía PDF (odooSync queda PENDING).
//
// Uso: tsx scripts/forzarConformidadAC278ZG.ts <imei> [--apply]    (sin --apply: solo muestra qué haría)
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { CHECKLIST_KEYS } from '@wara/shared';
import { connectDB } from '../src/config/db.js';
import { ConformidadModel } from '../src/models/Conformidad.js';
import { deriveCodigoActa } from '../src/services/codigoActa.service.js';
import { buildObjectKey, uploadBuffer } from '../src/services/r2.service.js';

const CARPETA = 'C:/Users/frost/Downloads/AC 278 ZG';
const FECHA = '2026-10-07';
const HORA = '14:17';
const RENZO_ID = '6aad29943cbc8ebb8119e5b6';
const f = (n: string) => path.join(CARPETA, `5059799249872162${n}.jpg`);

const PRE_FOTOS = [
  { slotKey: 'matricula', file: f('905') },
  { slotKey: 'frente', file: f('904') },
  { slotKey: 'interior', file: f('906') },
  { slotKey: 'odometro', file: f('907') },
];
const POST_FOTOS = [
  { slotKey: 'precintos', file: f('908') },
  { slotKey: 'precintos', file: f('909') },
  { slotKey: 'precintos', file: f('910') },
  { slotKey: 'boton_panico', file: f('911') },
  { slotKey: 'odometro', file: f('907') },
];

function checklistTodoSi() {
  return Object.fromEntries(CHECKLIST_KEYS.map((k) => [k, k === 'item6_falla' ? 'NO' : 'SI']));
}

async function main() {
  const imei = process.argv[2];
  const apply = process.argv.includes('--apply');
  if (!imei || imei.startsWith('--')) {
    console.error('Falta el IMEI completo: tsx scripts/forzarConformidadAC278ZG.ts <imei> [--apply]');
    process.exit(1);
  }
  for (const x of [...PRE_FOTOS, ...POST_FOTOS]) if (!fs.existsSync(x.file)) throw new Error(`No existe ${x.file}`);

  const clientId = 'extraordinaria-ac278zg-20261007';
  const codigoActa = deriveCodigoActa(clientId, FECHA);

  await connectDB();
  const ya = await ConformidadModel.findOne({ $or: [{ clientId }, { matricula: 'AC 278 ZG', deletedAt: null }] });
  if (ya) {
    console.error(`Ya existe una conformidad (${ya.codigoActa}, ${ya.status}) para AC 278 ZG — no se crea otra.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const subir = async (fase: 'pre' | 'post', lista: typeof PRE_FOTOS) => {
    const out = [];
    for (let i = 0; i < lista.length; i++) {
      const key = buildObjectKey({ codigoActa, localId: clientId, fecha: FECHA, fase, tipo: 'foto', contentType: 'image/jpeg', indice: i });
      if (apply) {
        const { publicUrl } = await uploadBuffer(key, fs.readFileSync(lista[i].file), 'image/jpeg');
        out.push({ id: `${clientId}-${fase}-${i}`, slotKey: lista[i].slotKey, url: publicUrl, key, mimeType: 'image/jpeg' as const });
      } else {
        console.log(`  [dry] ${fase} ${lista[i].slotKey} <- ${path.basename(lista[i].file)} -> ${key}`);
      }
    }
    return out;
  };
  const pre = await subir('pre', PRE_FOTOS);
  const post = await subir('post', POST_FOTOS);
  if (!apply) {
    console.log(`\nDry-run: crearía ${codigoActa} (instalación, ${FECHA} ${HORA}, IMEI ${imei}). Corré con --apply para escribir.`);
    await mongoose.disconnect();
    return;
  }

  const firmedAt = new Date(`${FECHA}T${HORA}:00-03:00`);
  const doc = await ConformidadModel.create({
    clientId,
    codigoActa,
    tipoServicio: 'instalacion',
    numero: '261007-EXTRA',
    cliente: 'Cimalco Sa',
    fecha: FECHA,
    hora: HORA,
    matricula: 'AC 278 ZG',
    instalador: 'Renzo Gonzalez',
    tecnicoId: RENZO_ID,
    responsableEmpresa: 'Cimalco Sa',
    status: 'completo',
    origen: 'extraordinaria',
    ticketOdoo: { numero: '39768', odooId: 39768, clienteOdoo: 'Cimalco Sa', verified: true },
    tareaOdoo: { id: 21817, nombre: '3 INSTALACIONES - NUEVO CLIENTE CIMALCO' },
    subtareaOdoo: { id: 21819, nombre: 'AC 278 ZG', mergedTaskIds: [] },
    pre: {
      checklist: checklistTodoSi(),
      observaciones: 'Hoja cargada de forma extraordinaria (se completó en papel).',
      fotos: pre,
      firma: { firmedAt, satisfaccion: null, motivo: 'Conformidad cargada de forma extraordinaria', clienteAusente: false },
    },
    post: {
      checklist: checklistTodoSi(),
      observaciones: 'Hoja cargada de forma extraordinaria (se completó en papel).',
      fotos: post,
      firma: { firmedAt, satisfaccion: null, motivo: 'Conformidad cargada de forma extraordinaria', clienteAusente: false },
    },
    equipo: {
      modelo: '2601914',
      imei,
      modBPanico: 'Sí',
      controlSenalModem: '-51 dBm',
      controlCantidadSatGps: '14',
      controlBateriaInterna: '4 V',
      controlAlimentacionExterna: '13.6 V',
      controlOdometro: '89604',
      controlRevisionIgnicion: 'SI',
      controlRevisionPanico: 'SI',
      controlConexionRed: 'SI',
      controlRevisionSensores: 'SI',
    },
  });
  console.log('Creada', doc.codigoActa, String(doc._id));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
