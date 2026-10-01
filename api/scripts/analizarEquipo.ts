// Uso: pnpm tsx scripts/analizarEquipo.ts <serie|imei|patente|equipoId> [--dias=2] [--json]
// Consulta UN equipo en vivo a bo3 (VISIONBLO_SESSION_COOKIE) y corre las reglas de
// equipoAnalisis.service. Nunca en lote.
import 'dotenv/config';
import { buscarEquipos, getEstadoEquipo } from '../src/services/equipoEstado.service.js';
import { getGraficasRango } from '../src/services/equipoGraficas.service.js';
import { analizarEquipo } from '../src/services/equipoAnalisis.service.js';

const args = process.argv.slice(2);
const query = args.find((a) => !a.startsWith('--'));
const dias = Number(args.find((a) => a.startsWith('--dias='))?.split('=')[1] ?? 2);
const asJson = args.includes('--json');

if (!query) {
  console.error('Uso: tsx scripts/analizarEquipo.ts <serie|imei|patente|equipoId> [--dias=2] [--json]');
  process.exit(1);
}

let equipoId: number;
if (/^\d{1,7}$/.test(query) && args.includes('--id')) {
  equipoId = Number(query);
} else {
  const coincidencias = await buscarEquipos(query);
  if (!coincidencias.length) {
    console.error(`Sin coincidencias para "${query}".`);
    process.exit(1);
  }
  if (coincidencias.length > 1) {
    console.error('Varias coincidencias, repetir con --id y el equipoId:');
    for (const c of coincidencias) console.error(`  ${c.equipoId}  ${c.descripcion}`);
    process.exit(1);
  }
  equipoId = coincidencias[0].equipoId;
}

const hoy = new Date();
const dia = (d: Date) => d.toISOString().slice(0, 10);
const desde = dia(new Date(hoy.getTime() - (Math.max(1, dias) - 1) * 86_400_000));
const [estado, graficas] = await Promise.all([getEstadoEquipo(equipoId, { forzar: true }), getGraficasRango(equipoId, desde, dia(hoy))]);
const hallazgos = analizarEquipo(estado, graficas);

if (asJson) {
  console.log(JSON.stringify({ equipoId, serie: estado.serie, imei: estado.imei, hallazgos }, null, 2));
} else {
  console.log(`Equipo ${equipoId} · serie ${estado.serie} · IMEI ${estado.imei} · últimos ${dias} día(s)`);
  console.log(`Último reporte: ${estado.ultimoReporte ?? '—'} | cargador ${estado.voltajeCargador ?? '—'} V | batería ${estado.bateriaInterna ?? '—'} V | señal ${estado.senalDbm ?? '—'} dBm\n`);
  if (!hallazgos.length) console.log('Sin hallazgos: el equipo se ve sano con las reglas actuales.');
  for (const h of hallazgos) {
    console.log(`[${h.severidad.toUpperCase()}] ${h.codigo}: ${h.mensaje}`);
    console.log(`    Causa probable: ${h.causaProbable}`);
  }
}
process.exit(0);
