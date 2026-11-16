// SOLO LECTURA. Cruza lo que dice Mongo (panel) con lo que hay publicado en cada ticket de Odoo, para saber qué hojas
// de conformidad ya están en el ticket y cuáles faltan enviar. No escribe nada: ni en Mongo ni en Odoo (solo find /
// search_read). Quién decide qué se envía y cómo es otra cosa: este script solo lista.
//
// Uso (en el servidor, que es el que apunta al Odoo de producción):
//   PERMITIR_BASE_REAL=1 npx tsx scripts/auditarEnviosOdoo.ts [--desde 2026-10-01] [--csv ruta.csv]
//     [--pdfs carpeta [--limit 3] [--solo CONF-...,CONF-...] [--sin-prueba]]
//
// Con --pdfs arma, SIN enviar nada, el mismo PDF que se publicaría en el ticket (código del envío real) para cada hoja
// completa que no esté ya enviada, y deja en la carpeta un indice.csv y un indice.html para compararlos con el panel y con
// lo que dice el ticket. Un cambio de unidad completo sale en un solo PDF con las 2 hojas, como en el envío.
//
// Por cada hoja con ticket, en estado completo o pendiente_post, mira en el ticket si está el PDF (nombre
// hoja_conformidad_<acta>.pdf o pre_conformidad_<acta>.pdf, y el de cambio de unidad completo que lleva ambas actas)
// y si ese adjunto está colgado de un mensaje (así lo da por enviado el envío normal).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { executeKw } from '../src/config/odoo.js';
import { ConformidadModel } from '../src/models/Conformidad.js';
import { UsuarioModel } from '../src/models/Usuario.js';
import { buildCambioCompletoPdfBuffer, buildConformidadPdfBuffer } from '../src/services/pdf.service.js';

// Usuarios de prueba: se marcan, para no confundirlos con servicios reales.
const TECNICOS_PRUEBA = new Set(['Joaquin prueba', 'prueba testing', 'LS', 'Joaquin Sangiorgio']);

type Accion =
  | 'ENVIAR (completa, no está en Odoo)'
  | 'YA ESTÁ EN ODOO (Mongo no lo sabe)'
  | 'ADJUNTO SIN MENSAJE (envío lo reutiliza)'
  | 'OK (enviada)'
  | 'EN CURSO (PRE hecho, falta POST: no se envía)'
  | 'TICKET NO EXISTE EN ESTE ODOO'
  | 'RETENIDA POR DUPLICADO';

interface Fila {
  id: string;
  pdf: string;
  nota: string;
  accion: Accion;
  tecnico: string;
  prueba: boolean;
  acta: string;
  estado: string;
  fecha: string;
  dias: number;
  cliente: string;
  ticket: string;
  clienteTicket: string;
  tituloTicket: string;
  clienteDifiere: boolean;
  etapaTicket: string;
  hojasEnTicket: number;
  mongoPost: string;
  mongoPre: string;
  errorMongo: string;
  postEnOdoo: string;
  preEnOdoo: string;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
function clienteDifiere(hoja: string, ticket: string): boolean {
  const a = norm(hoja);
  const b = norm(ticket);
  if (!a || !b) return false; // sin dato no se puede decir que difiera
  if (a.includes(b) || b.includes(a)) return false;
  const palabras = (s: string) => s.split(' ').filter((p) => p.length >= 4);
  const pb = new Set(palabras(b));
  return !palabras(a).some((p) => pb.has(p));
}
const m2oNombre = (v: unknown): string => (Array.isArray(v) ? String(v[1] ?? '') : '');
const trozos = <T>(xs: T[], n: number): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

function arg(nombre: string): string | undefined {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const desde = arg('--desde');
  const csv = arg('--csv');
  await connectDB();
  const host = new URL(env.ODOO_URL).host;
  console.log(`Mongo: ${mongoose.connection.name} | Odoo: ${host}`);
  if (/testing|\.dev\.odoo\.com/i.test(host)) {
    console.log('⚠ Este Odoo parece de STAGING: los ids de ticket de producción no van a existir acá. Corré el script en el servidor.');
  }

  const filtro: Record<string, unknown> = {
    deletedAt: null,
    status: { $in: ['pendiente_post', 'completo'] },
    'ticketOdoo.numero': { $exists: true, $ne: '' },
  };
  if (desde) filtro.createdAt = { $gte: new Date(`${desde}T00:00:00-03:00`) };
  const hojas = (await ConformidadModel.find(filtro)
    .select('codigoActa status fecha fechaHora createdAt cliente ticketOdoo tecnicoId odooSync preOdooSync duplicado')
    .sort({ createdAt: 1 })
    .lean()) as any[];
  console.log(`Hojas con ticket en estado pendiente_post / completo${desde ? ` desde ${desde}` : ''}: ${hojas.length}`);
  if (!hojas.length) return;

  const usuarios = await UsuarioModel.find({ _id: { $in: [...new Set(hojas.map((h) => String(h.tecnicoId)))] } }).select('nombre').lean();
  const nombreTecnico = new Map(usuarios.map((u: any) => [String(u._id), String(u.nombre ?? '')]));

  const ticketIds = [...new Set(hojas.map((h) => Number(h.ticketOdoo.odooId ?? h.ticketOdoo.numero)).filter(Number.isFinite))];

  // Tickets (existen, cliente, etapa). active_test:false para ver también los archivados.
  const tickets = new Map<number, { cliente: string; etapa: string; titulo: string }>();
  for (const lote of trozos(ticketIds, 50)) {
    const rows = (await executeKw('helpdesk.ticket', 'search_read', [[['id', 'in', lote]]], {
      fields: ['id', 'name', 'partner_id', 'stage_id'],
      context: { active_test: false },
    })) as any[];
    for (const r of rows) tickets.set(r.id, { cliente: m2oNombre(r.partner_id), etapa: m2oNombre(r.stage_id), titulo: String(r.name ?? '') });
  }

  // PDF de conformidad de cada ticket (adjuntos) y cuáles están colgados de algún mensaje.
  const adjuntos: Array<{ id: number; name: string; res_id: number }> = [];
  const colgados = new Set<number>();
  for (const lote of trozos([...tickets.keys()], 50)) {
    const adj = (await executeKw('ir.attachment', 'search_read', [[['res_model', '=', 'helpdesk.ticket'], ['res_id', 'in', lote], ['name', 'ilike', 'conformidad']]], {
      fields: ['id', 'name', 'res_id'],
    })) as any[];
    adjuntos.push(...adj);
    const msgs = (await executeKw('mail.message', 'search_read', [[['model', '=', 'helpdesk.ticket'], ['res_id', 'in', lote], ['attachment_ids', '!=', false]]], {
      fields: ['attachment_ids'],
    })) as any[];
    for (const m of msgs) for (const id of m.attachment_ids as number[]) colgados.add(id);
  }

  const hojasPorTicket = new Map<number, number>();
  for (const h of hojas) {
    const t = Number(h.ticketOdoo.odooId ?? h.ticketOdoo.numero);
    hojasPorTicket.set(t, (hojasPorTicket.get(t) ?? 0) + 1);
  }

  const estadoEnOdoo = (ticketId: number, patron: (n: string) => boolean): string => {
    const delTicket = adjuntos.filter((a) => a.res_id === ticketId && patron(a.name));
    if (!delTicket.length) return 'no';
    return delTicket.some((a) => colgados.has(a.id)) ? 'sí (con mensaje)' : 'adjunto sin mensaje';
  };

  const hoy = Date.now();
  const filas: Fila[] = hojas.map((h) => {
    const ticketId = Number(h.ticketOdoo.odooId ?? h.ticketOdoo.numero);
    const t = tickets.get(ticketId);
    const acta = String(h.codigoActa);
    const tecnico = nombreTecnico.get(String(h.tecnicoId)) ?? '?';
    // El PDF final lleva el acta en el nombre (también el de cambio de unidad completo, que lleva las dos actas).
    const postEnOdoo = t ? estadoEnOdoo(ticketId, (n) => /^hoja_conformidad_/i.test(n) && n.includes(acta)) : 'ticket inexistente';
    const preEnOdoo = t ? estadoEnOdoo(ticketId, (n) => /^pre_conformidad_/i.test(n) && n.includes(acta)) : 'ticket inexistente';

    let accion: Accion;
    if (!t) accion = 'TICKET NO EXISTE EN ESTE ODOO';
    else if (h.status === 'pendiente_post') accion = 'EN CURSO (PRE hecho, falta POST: no se envía)';
    else if (postEnOdoo === 'sí (con mensaje)') accion = h.odooSync?.status === 'SYNCED' ? 'OK (enviada)' : 'YA ESTÁ EN ODOO (Mongo no lo sabe)';
    else if (h.duplicado?.estado === 'pendiente') accion = 'RETENIDA POR DUPLICADO';
    else if (postEnOdoo === 'adjunto sin mensaje') accion = 'ADJUNTO SIN MENSAJE (envío lo reutiliza)';
    else accion = 'ENVIAR (completa, no está en Odoo)';

    return {
      id: String(h._id),
      pdf: '',
      nota: '',
      accion,
      tecnico,
      prueba: TECNICOS_PRUEBA.has(tecnico),
      acta,
      estado: h.status,
      fecha: new Date(h.createdAt).toISOString().slice(0, 10),
      dias: Math.floor((hoy - new Date(h.createdAt).getTime()) / 86_400_000),
      cliente: String(h.cliente ?? ''),
      ticket: String(h.ticketOdoo.numero),
      clienteTicket: t?.cliente ?? '',
      tituloTicket: t?.titulo ?? '',
      clienteDifiere: t ? clienteDifiere(String(h.cliente ?? ''), t.cliente) : false,
      etapaTicket: t?.etapa ?? '',
      hojasEnTicket: hojasPorTicket.get(ticketId) ?? 1,
      mongoPost: h.odooSync?.status ?? '-',
      mongoPre: h.preOdooSync?.status ?? '-',
      errorMongo: String(h.odooSync?.lastError ?? '').replace(/\s+/g, ' ').slice(0, 80),
      postEnOdoo,
      preEnOdoo,
    };
  });

  // Resumen
  const porAccion = new Map<string, number>();
  for (const f of filas) porAccion.set(`${f.accion}${f.prueba ? ' [prueba]' : ''}`, (porAccion.get(`${f.accion}${f.prueba ? ' [prueba]' : ''}`) ?? 0) + 1);
  console.log('\nResumen:');
  for (const [a, n] of [...porAccion].sort()) console.log(`  ${String(n).padStart(4)}  ${a}`);

  // Detalle de lo que habría que enviar
  const aEnviar = filas.filter((f) => f.accion.startsWith('ENVIAR') || f.accion.startsWith('ADJUNTO'));
  console.log(`\nA enviar (${aEnviar.length}):`);
  console.table(
    aEnviar.map((f) => ({
      técnico: f.tecnico + (f.prueba ? ' (prueba)' : ''),
      acta: f.acta,
      fecha: f.fecha,
      días: f.dias,
      cliente: f.cliente.slice(0, 28),
      ticket: f.ticket,
      'cliente del ticket': f.clienteTicket.slice(0, 28),
      '¿difiere?': f.clienteDifiere ? 'REVISAR' : '',
      'hojas en ticket': f.hojasEnTicket,
      etapa: f.etapaTicket,
      'error Mongo': f.errorMongo.slice(0, 40),
    })),
  );

  const raros = filas.filter((f) => f.clienteDifiere || f.accion.startsWith('TICKET NO EXISTE') || f.accion.startsWith('YA ESTÁ'));
  if (raros.length) {
    console.log(`\nPara mirar antes de enviar (${raros.length}): ticket inexistente, cliente que no coincide, o ya publicada sin que Mongo lo sepa.`);
    console.table(raros.map((f) => ({ acción: f.accion, técnico: f.tecnico, acta: f.acta, cliente: f.cliente.slice(0, 28), ticket: f.ticket, 'cliente del ticket': f.clienteTicket.slice(0, 28) })));
  }

  const pdfs = arg('--pdfs');
  if (pdfs) {
    await generarPdfs(pdfs, filas, {
      limit: arg('--limit') ? Number(arg('--limit')) : undefined,
      solo: arg('--solo')?.split(',').map((s) => s.trim()),
      sinPrueba: process.argv.includes('--sin-prueba'),
    });
  }

  const cols = Object.keys(filas[0]) as Array<keyof Fila>;
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const contenidoCsv = '﻿' + [cols.join(','), ...filas.map((f) => cols.map((c) => esc(f[c])).join(','))].join('\n');
  if (csv) {
    writeFileSync(csv, contenidoCsv, 'utf8');
    console.log(`\nCSV: ${csv} (${filas.length} filas)`);
  }
  if (pdfs) {
    // Solo lo que tiene PDF: es lo que se revisa. El indice.csv completo también queda en la carpeta.
    const conPdf = filas.filter((f) => f.pdf);
    writeFileSync(join(pdfs, 'indice.csv'), contenidoCsv, 'utf8');
    writeFileSync(join(pdfs, 'indice.html'), indiceHtml(conPdf, host), 'utf8');
    console.log(`\nÍndice: ${join(pdfs, 'indice.html')} (${conPdf.length} PDF)`);
  }
}

const limpio = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'sin_nombre';
const h = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

// Arma, sin enviar nada, el PDF que se publicaría en el ticket. Las hojas ya enviadas (OK) no se arman.
async function generarPdfs(dir: string, filas: Fila[], opts: { limit?: number; solo?: string[]; sinPrueba: boolean }): Promise<void> {
  mkdirSync(dir, { recursive: true });
  // Solo las NO enviadas: completas, que Mongo no tiene como SYNCED y que no figuran como enviadas en Odoo. (Si el Odoo
  // consultado no es el de producción, la acción sale "ticket inexistente" y eso sola no alcanza: por eso se mira Mongo.)
  let objetivo = filas.filter((f) => f.estado === 'completo' && f.mongoPost !== 'SYNCED' && !f.accion.startsWith('OK'));
  if (opts.sinPrueba) objetivo = objetivo.filter((f) => !f.prueba);
  if (opts.solo?.length) objetivo = objetivo.filter((f) => opts.solo!.includes(f.acta));
  if (opts.limit) objetivo = objetivo.slice(0, opts.limit);
  console.log(`\nArmando ${objetivo.length} PDF en ${dir} (de a uno, sin enviar nada)...`);

  const hechos = new Map<string, string>(); // id de hoja -> ruta relativa (un cambio completo comparte PDF)
  let n = 0;
  for (const f of objetivo) {
    n++;
    if (hechos.has(f.id)) {
      f.pdf = hechos.get(f.id)!;
      f.nota = 'cambio completo: mismo PDF que su pareja';
      continue;
    }
    try {
      const doc = (await ConformidadModel.findById(f.id).lean()) as any;
      const pareja =
        doc?.cambioUnidad?.completo && doc.cambioUnidad.parejaId
          ? ((await ConformidadModel.findOne({ _id: doc.cambioUnidad.parejaId, deletedAt: null }).lean()) as any)
          : null;
      const carpeta = limpio(f.tecnico);
      mkdirSync(join(dir, carpeta), { recursive: true });
      let buf: Buffer;
      let nombre: string;
      if (pareja && pareja.status === 'completo') {
        const [a, b] = doc.cambioUnidad.rol === 'destino' ? [pareja, doc] : [doc, pareja];
        buf = await buildCambioCompletoPdfBuffer([a, b]);
        nombre = `${f.fecha}_T${limpio(f.ticket)}_${a.codigoActa}+${b.codigoActa}.pdf`;
        f.nota = `cambio completo: 2 hojas en un PDF (con ${pareja.codigoActa})`;
        hechos.set(String(pareja._id), `${carpeta}/${nombre}`);
      } else {
        buf = await buildConformidadPdfBuffer(doc);
        nombre = `${f.fecha}_T${limpio(f.ticket)}_${f.acta}.pdf`;
        if (doc?.cambioUnidad?.completo) f.nota = 'cambio completo: la otra hoja no está cerrada; en el envío real esta espera';
      }
      writeFileSync(join(dir, carpeta, nombre), buf);
      f.pdf = `${carpeta}/${nombre}`;
      console.log(`  [${n}/${objetivo.length}] ${f.pdf} (${Math.round(buf.length / 1024)} KB)`);
    } catch (err) {
      f.nota = `ERROR AL ARMAR EL PDF: ${err instanceof Error ? err.message : String(err)}`.slice(0, 200);
      console.log(`  [${n}/${objetivo.length}] ${f.acta}: ${f.nota}`);
    }
  }
}

function indiceHtml(filas: Fila[], odooHost: string): string {
  const filasHtml = filas
    .map(
      (f) => `<tr class="${f.clienteDifiere ? 'dif' : ''}${f.prueba ? ' prueba' : ''}">
  <td>${h(f.tecnico)}${f.prueba ? ' (prueba)' : ''}</td><td>${h(f.fecha)}</td><td><a href="${h(f.pdf)}" target="_blank">${h(f.acta)}</a></td>
  <td>${h(f.cliente)}</td><td>#${h(f.ticket)}<br><small>${h(f.tituloTicket)}</small></td><td>${h(f.clienteTicket) || '—'}${f.clienteDifiere ? ' ⚠' : ''}</td>
  <td>${h(f.etapaTicket)}</td><td>${h(f.postEnOdoo)}</td><td>${h(f.accion)}</td><td>${h(f.mongoPost)}</td><td>${h(f.errorMongo)}</td><td>${h(f.nota)}</td></tr>`,
    )
    .join('\n');
  return `<!doctype html><html lang="es"><meta charset="utf-8"><title>Hojas pendientes: PDF y ticket</title>
<style>body{font:13px system-ui;margin:16px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:4px 6px;text-align:left;vertical-align:top}
th{background:#eee;position:sticky;top:0}tr.dif{background:#fff3cd}tr.prueba{color:#888}</style>
<h2>Hojas completas sin enviar: PDF y ticket (${filas.length})</h2>
<p>Odoo consultado: <b>${h(odooHost)}</b>. En amarillo: el cliente de la hoja no coincide con el del ticket. Clic en el acta para abrir el PDF.</p>
<table><tr><th>Técnico</th><th>Fecha</th><th>Acta (PDF)</th><th>Cliente (hoja)</th><th>Ticket</th><th>Cliente (ticket Odoo)</th><th>Etapa</th><th>¿En Odoo?</th><th>Acción</th><th>Mongo</th><th>Error Mongo</th><th>Nota</th></tr>
${filasHtml}</table></html>`;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    process.exit(); // el Chromium de los PDF queda abierto un rato: no esperar
  });
