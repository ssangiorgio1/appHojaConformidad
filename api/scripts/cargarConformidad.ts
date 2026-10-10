// Carga EXTRAORDINARIA de una hoja de conformidad (el técnico la hizo en papel o no pudo usar la app).
// NO toca Odoo: el PDF queda junto a la config y se sube a mano al ticket.
//
// Uso:
//   tsx scripts/cargarConformidad.ts <config.json>                 menú interactivo, paso por paso
//   tsx scripts/cargarConformidad.ts <config.json> --pasos 1,2,3,4  corre esos pasos sin preguntar el menú
//   tsx scripts/cargarConformidad.ts <config.json> --pasos todo     = 1,2,3,4
// Ejemplo de config: scripts/conformidades-extra/ejemplo-X082717.json (leer "_ayuda" adentro).
//
// Pasos (cada uno se puede repetir, son idempotentes):
//   1 Resumen             muestra qué se cargaría y chequea que existan técnico y fotos (no escribe nada)
//   2 Subir fotos a R2    sube las fotos y guarda las URLs en <config>.estado.json
//   3 Crear/actualizar    crea la conformidad en Mongo con esas URLs (si ya existe, la actualiza)
//   4 Generar PDF         renderiza el PDF del registro y lo guarda junto a la config
//   5 Editar fotos        quita una foto o la pasa de slot en el registro ya creado (y regenera el PDF si querés)
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import mongoose from 'mongoose';
import { CHECKLIST_KEYS } from '@wara/shared';
import { connectDB } from '../src/config/db.js';
import { ConformidadModel } from '../src/models/Conformidad.js';
import { UsuarioModel } from '../src/models/Usuario.js';
import { deriveCodigoActa } from '../src/services/codigoActa.service.js';
import { buildObjectKey, uploadBuffer } from '../src/services/r2.service.js';
import { buildConformidadPdfBuffer } from '../src/services/pdf.service.js';

interface FotoCfg {
  slot: string;
  archivo: string;
}
interface Config {
  tecnicoEmail: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:MM
  cliente: string;
  matricula: string;
  tipoServicio?: 'instalacion' | 'desinstalacion' | 'reparacion' | 'cambio_equipo';
  ticket: { numero: string; clienteOdoo?: string };
  tarea?: { id: number; nombre?: string };
  subtarea?: { id: number; nombre?: string };
  numeroHoja?: string;
  observacionesPre?: string;
  observacionesPost?: string;
  checklistTodoSi?: boolean; // default true (item6_falla queda en NO)
  equipo: Record<string, string>;
  carpetaFotos: string;
  fotosPre: FotoCfg[];
  fotosPost: FotoCfg[];
}
interface FotoSubida {
  id: string;
  slotKey: string;
  url: string;
  key: string;
  mimeType: 'image/jpeg';
}
interface Estado {
  pre: FotoSubida[];
  post: FotoSubida[];
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const NOMBRE_PASOS: Record<string, string> = {
  '1': 'Resumen (no escribe)',
  '2': 'Subir fotos a R2',
  '3': 'Crear/actualizar conformidad en Mongo',
  '4': 'Generar PDF',
  '5': 'Editar fotos del registro (quitar / cambiar slot)',
};

const cfgPath = path.resolve(process.argv[2] ?? '');
if (!process.argv[2] || process.argv[2].startsWith('--') || !fs.existsSync(cfgPath)) {
  console.error('Uso: tsx scripts/cargarConformidad.ts <config.json> [--pasos 1,2,3,4|todo]\nCopiá scripts/conformidades-extra/ejemplo-X082717.json y editalo.');
  process.exit(1);
}
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as Config;
const estadoPath = cfgPath.replace(/\.json$/i, '') + '.estado.json';
const clientId = `extraordinaria-${slug(cfg.matricula)}-${cfg.fecha.replace(/-/g, '')}`;
const codigoActa = deriveCodigoActa(clientId, cfg.fecha);
const fotoPath = (x: FotoCfg) => path.resolve(cfg.carpetaFotos, x.archivo);
const leerEstado = (): Estado | null => (fs.existsSync(estadoPath) ? (JSON.parse(fs.readFileSync(estadoPath, 'utf8')) as Estado) : null);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const confirmar = async (msg: string) => (await rl.question(`${msg} [s/N] `)).trim().toLowerCase().startsWith('s');

async function paso1() {
  console.log(`\n${codigoActa}  ${cfg.tipoServicio ?? 'instalacion'}  ${cfg.fecha} ${cfg.hora}  ${cfg.matricula}  ${cfg.cliente}  ticket ${cfg.ticket.numero}`);
  console.log(`tarea ${cfg.tarea?.id ?? '-'}  subtarea ${cfg.subtarea?.id ?? '-'}  equipo ${cfg.equipo.modelo ?? '-'} / ${cfg.equipo.imei ?? '-'}`);
  const tecnico = await UsuarioModel.findOne({ email: cfg.tecnicoEmail.toLowerCase() });
  console.log(`técnico: ${tecnico ? `${tecnico.nombre} OK` : `NO ENCUENTRO ${cfg.tecnicoEmail}`}`);
  for (const [fase, lista] of [['PRE', cfg.fotosPre], ['POST', cfg.fotosPost]] as const) {
    for (const x of lista) console.log(`  ${fase} ${x.slot.padEnd(18)} ${fs.existsSync(fotoPath(x)) ? 'ok ' : 'FALTA'} ${x.archivo}`);
  }
  const ya = await ConformidadModel.findOne({ clientId });
  console.log(`registro en Mongo: ${ya ? `existe (${ya.status})` : 'no existe todavía'}`);
  console.log(`fotos subidas (estado.json): ${leerEstado() ? 'sí' : 'no'}`);
}

async function paso2() {
  for (const x of [...cfg.fotosPre, ...cfg.fotosPost]) if (!fs.existsSync(fotoPath(x))) throw new Error(`No existe ${fotoPath(x)}`);
  const subir = async (fase: 'pre' | 'post', lista: FotoCfg[]) => {
    const out: FotoSubida[] = [];
    for (let i = 0; i < lista.length; i++) {
      const key = buildObjectKey({ codigoActa, localId: clientId, fecha: cfg.fecha, fase, tipo: 'foto', contentType: 'image/jpeg', indice: i });
      const { publicUrl } = await uploadBuffer(key, fs.readFileSync(fotoPath(lista[i])), 'image/jpeg');
      out.push({ id: `${clientId}-${fase}-${i}`, slotKey: lista[i].slot, url: publicUrl, key, mimeType: 'image/jpeg' });
      console.log(`  subida ${fase} ${lista[i].slot}`);
    }
    return out;
  };
  const estado: Estado = { pre: await subir('pre', cfg.fotosPre), post: await subir('post', cfg.fotosPost) };
  fs.writeFileSync(estadoPath, JSON.stringify(estado, null, 1));
  console.log(`URLs guardadas en ${estadoPath}`);
}

async function paso3() {
  const estado = leerEstado();
  if (!estado) throw new Error('Primero corré el paso 2 (subir fotos).');
  const tecnico = await UsuarioModel.findOne({ email: cfg.tecnicoEmail.toLowerCase() });
  if (!tecnico) throw new Error(`No encuentro al técnico ${cfg.tecnicoEmail}`);
  const checklist = Object.fromEntries(CHECKLIST_KEYS.map((k) => [k, cfg.checklistTodoSi === false ? null : k === 'item6_falla' ? 'NO' : 'SI']));
  const firma = { firmedAt: new Date(`${cfg.fecha}T${cfg.hora}:00-03:00`), satisfaccion: null, motivo: 'Conformidad cargada de forma extraordinaria', clienteAusente: false };
  const datos = {
    tipoServicio: cfg.tipoServicio ?? 'instalacion',
    numero: cfg.numeroHoja ?? `${cfg.fecha.slice(2).replace(/-/g, '')}-EXTRA`,
    cliente: cfg.cliente,
    fecha: cfg.fecha,
    hora: cfg.hora,
    matricula: cfg.matricula,
    instalador: tecnico.nombre,
    tecnicoId: tecnico._id,
    responsableEmpresa: cfg.cliente,
    status: 'completo' as const,
    origen: 'extraordinaria',
    ticketOdoo: { numero: cfg.ticket.numero, odooId: Number(cfg.ticket.numero) || null, clienteOdoo: cfg.ticket.clienteOdoo ?? cfg.cliente, verified: true },
    tareaOdoo: cfg.tarea,
    subtareaOdoo: cfg.subtarea ? { ...cfg.subtarea, mergedTaskIds: [] } : undefined,
    pre: { checklist, observaciones: cfg.observacionesPre ?? '', fotos: estado.pre, firma },
    post: { checklist, observaciones: cfg.observacionesPost ?? '', fotos: estado.post, firma },
    equipo: cfg.equipo,
  };
  const ya = await ConformidadModel.findOne({ clientId });
  if (ya) {
    if (!(await confirmar(`Ya existe ${ya.codigoActa} (${ya.status}). ¿La piso con estos datos?`))) return;
    ya.set(datos);
    await ya.save();
    console.log('Actualizada', ya.codigoActa);
    return;
  }
  const dup = await ConformidadModel.findOne({ matricula: cfg.matricula.toUpperCase(), 'ticketOdoo.numero': cfg.ticket.numero, deletedAt: null });
  if (dup) throw new Error(`Ya hay otra conformidad (${dup.codigoActa}, ${dup.status}) de ${cfg.matricula} en el ticket ${cfg.ticket.numero}.`);
  const doc = await ConformidadModel.create({ clientId, codigoActa, ...datos });
  console.log('Creada', doc.codigoActa, String(doc._id));
}

async function paso4() {
  const doc = await ConformidadModel.findOne({ clientId });
  if (!doc) throw new Error('Primero corré el paso 3 (crear la conformidad).');
  const pdf = await buildConformidadPdfBuffer(doc.toObject() as unknown as Parameters<typeof buildConformidadPdfBuffer>[0]);
  const out = path.join(path.dirname(cfgPath), `Conformidad-${cfg.matricula}-${doc.codigoActa}.pdf`);
  fs.writeFileSync(out, pdf);
  console.log('PDF:', out, `${(pdf.length / 1024).toFixed(0)} KB`);
}

async function paso5() {
  const doc = await ConformidadModel.findOne({ clientId });
  if (!doc) throw new Error('Primero corré el paso 3 (crear la conformidad).');
  for (;;) {
    const fotos = [
      ...doc.pre.fotos.map((f, i) => ({ fase: 'pre' as const, i, f })),
      ...doc.post.fotos.map((f, i) => ({ fase: 'post' as const, i, f })),
    ];
    console.log('\nFotos del registro:');
    fotos.forEach((x, n) => console.log(`  ${n + 1}. ${x.fase.toUpperCase()} ${x.f.slotKey}`));
    const r = (await rl.question('Número de foto a editar (vacío = terminar): ')).trim();
    if (!r) break;
    const sel = fotos[Number(r) - 1];
    if (!sel) continue;
    const accion = (await rl.question('  [q]uitar, [c]ambiar slot, [Enter] cancelar: ')).trim().toLowerCase();
    if (accion === 'q') {
      doc[sel.fase].fotos.splice(sel.i, 1);
    } else if (accion === 'c') {
      const nuevo = (await rl.question('  slot nuevo (ej. boton_panico, ubicacion_equipo, extra_post): ')).trim();
      if (nuevo) doc[sel.fase].fotos[sel.i].slotKey = nuevo;
    } else continue;
    doc.markModified(`${sel.fase}.fotos`);
    await doc.save();
    console.log('  guardado.');
  }
  if (await confirmar('¿Regenerar el PDF ahora?')) await paso4();
}

const PASOS: Record<string, () => Promise<void>> = { '1': paso1, '2': paso2, '3': paso3, '4': paso4, '5': paso5 };

async function main() {
  const i = process.argv.indexOf('--pasos');
  const arg = i >= 0 ? process.argv[i + 1] : undefined;
  await connectDB();
  try {
    if (arg) {
      const lista = arg === 'todo' ? ['1', '2', '3', '4'] : arg.split(',').map((s) => s.trim());
      for (const p of lista) {
        if (!PASOS[p]) throw new Error(`Paso inválido: ${p}`);
        console.log(`\n=== Paso ${p}: ${NOMBRE_PASOS[p]} ===`);
        await PASOS[p]();
      }
    } else {
      for (;;) {
        console.log(`\nConformidad extraordinaria ${cfg.matricula} (${codigoActa})`);
        for (const [k, v] of Object.entries(NOMBRE_PASOS)) console.log(`  ${k}. ${v}`);
        console.log('  t. Todo (1 a 4, confirmando antes de cada paso que escribe)   q. Salir');
        const r = (await rl.question('Elegí pasos (ej. 2,3 o t): ')).trim().toLowerCase();
        if (r === 'q' || r === '') break;
        const lista = r === 't' ? ['1', '2', '3', '4'] : r.split(',').map((s) => s.trim());
        for (const p of lista) {
          if (!PASOS[p]) {
            console.log(`Paso inválido: ${p}`);
            continue;
          }
          if (['2', '3', '4'].includes(p) && !(await confirmar(`¿Correr el paso ${p} (${NOMBRE_PASOS[p]})?`))) continue;
          console.log(`\n=== Paso ${p}: ${NOMBRE_PASOS[p]} ===`);
          try {
            await PASOS[p]();
          } catch (err) {
            console.error('Error:', (err as Error).message);
            break;
          }
        }
      }
    }
  } finally {
    rl.close();
    await mongoose.disconnect();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
