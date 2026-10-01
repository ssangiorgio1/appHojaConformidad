// Uso: pnpm tsx scripts/analizarSinReportar.ts [--max=30] [--nunca] [--dias-max=N] [--cat=...] [--csv=ruta]
// --nunca: solo los que jamás reportaron (recién instalados / apagados). --dias-max=N: solo los que
// dejaron de reportar hace N días o menos (ej. 7). Sin filtros: más recientes primero.
// Toma de la colección FlotaUnidad (Mongo, sin pegarle a bo3) los móviles de clientes ACTIVOS que no
// reportan, y analiza cada uno de a uno (3-4 consultas a bo3 por equipo) con pausa entre equipos.
// Acotado por --max: no es un barrido de toda la flota.
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { FlotaUnidadModel } from '../src/models/FlotaUnidad.js';
import { getEstadoEquipo } from '../src/services/equipoEstado.service.js';
import { getGraficasRango } from '../src/services/equipoGraficas.service.js';
import { analizarEquipo, type Hallazgo } from '../src/services/equipoAnalisis.service.js';

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const max = Number(arg('max') ?? 30);
const cats = (arg('cat') ?? 'sin_reportar_24h,sin_reportar_48h,sin_reportar_72h').split(',');
const csvPath = arg('csv');
const soloNunca = process.argv.includes('--nunca');
const diasMax = arg('dias-max') ? Number(arg('dias-max')) : null;
const PAUSA_MS = 1500;
const dia = (d: Date) => d.toISOString().slice(0, 10);

await connectDB();
const filtro: Record<string, unknown> = { categoria: { $in: cats }, equipoId: { $ne: null } };
if (soloNunca) filtro.ultimoReporte = null;
else if (diasMax !== null) filtro.ultimoReporte = { $gte: new Date(Date.now() - diasMax * 86_400_000) };
const total = await FlotaUnidadModel.countDocuments(filtro as never);
const candidatos = await FlotaUnidadModel.find(filtro as never)
  .sort({ ultimoReporte: -1 })
  .limit(max)
  .lean();
console.log(`${total} móviles activos sin reportar con equipo asociado; analizando ${candidatos.length} (--max=${max}).\n`);

const filas: string[][] = [['movil', 'matricula', 'cliente', 'equipoId', 'categoria', 'ultimoReporte', 'tipo', 'hallazgo', 'causaProbable']];
for (const u of candidatos) {
  try {
    const estado = await getEstadoEquipo(u.equipoId!, { forzar: true });
    // Las gráficas se piden alrededor del último reporte: el rango "últimos días" estaría vacío.
    const ref = estado.ultimoReporte ? new Date(estado.ultimoReporte) : null;
    const graficas = ref
      ? await getGraficasRango(u.equipoId!, dia(new Date(ref.getTime() - 86_400_000)), dia(ref))
      : { equipoId: u.equipoId!, fecha: '', desde: '', hasta: '', consultadoAt: '', series: { bateriaInterna: [], cargador: [], senalDbm: [], velocidad: [], satelites: [], hdop: [], ignicion: [], presenciaCargador: [] } };
    const hallazgos: Hallazgo[] = analizarEquipo(estado, graficas);
    const tipo = ref ? 'dejo_de_reportar' : 'nunca_reporto';
    const principal = hallazgos.filter((h) => h.severidad !== 'info').slice(0, 3);
    console.log(`#${u.equipoId} ${u.nombre} (${u.matricula ?? '-'}) · ${u.clienteNombre ?? '-'} · ${tipo} · último ${estado.ultimoReporte ?? '—'}`);
    for (const h of principal.length ? principal : hallazgos.slice(0, 1)) console.log(`   [${h.severidad}] ${h.codigo}: ${h.causaProbable}`);
    for (const h of principal.length ? principal : hallazgos.slice(0, 1))
      filas.push([u.nombre, u.matricula ?? '', u.clienteNombre ?? '', String(u.equipoId), u.categoria, estado.ultimoReporte ?? '', tipo, h.codigo, h.causaProbable]);
  } catch (err) {
    console.log(`#${u.equipoId} ${u.nombre}: ERROR ${(err as Error).message}`);
    if ((err as { code?: string }).code === 'SESSION_EXPIRED') break;
  }
  await new Promise((r) => setTimeout(r, PAUSA_MS));
}

if (csvPath) {
  writeFileSync(csvPath, '﻿' + filas.map((f) => f.map((c) => `"${c.replaceAll('"', '""')}"`).join(',')).join('\n'));
  console.log(`\nCSV: ${csvPath}`);
}
await mongoose.disconnect();
process.exit(0);
