// Envío EXTRAORDINARIO, una sola vez, de la hoja de conformidad COMPLETA de BGJ01 al ticket 39509 de Odoo PRODUCCIÓN.
// Usa las credenciales de producción comentadas en api/.env (bloque "Producción") sin editar el archivo. Publica con la
// cuenta de Odoo vinculada del técnico, igual que el flujo normal; pushConformidadToTicket no duplica si el PDF ya está.
// message_post manda correo a los seguidores del ticket (incluido el cliente).
//
// Uso: tsx scripts/forzarEnvioTicket39509.ts [--apply]    (sin --apply: solo muestra qué haría, no publica nada)
import fs from 'node:fs';
import path from 'node:path';

const ID = '6ace5016f4c17f6a2d6ec84f';
const TICKET = 39509;

function cargarProduccion() {
  const txt = fs.readFileSync(path.resolve(import.meta.dirname, '../.env'), 'utf8');
  const bloque = txt.split('# Producción')[1]?.split('# Staging')[0] ?? '';
  const vars = [...bloque.matchAll(/^#\s*(ODOO_(?:API_KEY|DB|EMAIL|URL))=(.*)$/gm)];
  if (vars.length !== 4) throw new Error('No encontré las 4 variables ODOO_* de producción en .env');
  for (const [, k, v] of vars) process.env[k] = v.trim();
}

async function main() {
  const apply = process.argv.includes('--apply');
  cargarProduccion();
  const mongoose = (await import('mongoose')).default;
  const { connectDB } = await import('../src/config/db.js');
  const { ConformidadModel } = await import('../src/models/Conformidad.js');
  const { UsuarioModel } = await import('../src/models/Usuario.js');
  const { verifyTicketExists, pushConformidadToTicket } = await import('../src/services/odoo.service.js');
  const { buildConformidadPdfBuffer } = await import('../src/services/pdf.service.js');
  const { decryptSecret } = await import('../src/utils/secretBox.js');

  console.log(`Odoo destino: ${new URL(process.env.ODOO_URL!).host}`);
  await connectDB();
  const record = await ConformidadModel.findById(ID);
  if (!record) throw new Error('Conformidad no encontrada');
  const usuario = await UsuarioModel.findById(record.tecnicoId);
  console.log({
    codigoActa: record.codigoActa,
    matricula: record.matricula,
    status: record.status,
    ticketOdoo: record.ticketOdoo,
    odooSync: record.odooSync,
    tecnico: record.instalador,
    tecnicoConOdooVinculado: Boolean(usuario?.odoo),
  });
  if (record.status !== 'completo') throw new Error('La hoja no está completa');
  if (Number(record.ticketOdoo?.odooId ?? record.ticketOdoo?.numero) !== TICKET) throw new Error(`La hoja no apunta al ticket ${TICKET}`);
  if (!usuario?.odoo) throw new Error('El técnico no tiene cuenta de Odoo vinculada');

  const ticket = await verifyTicketExists(TICKET);
  console.log('Ticket en producción:', ticket);
  if (!ticket) throw new Error('El ticket no existe en este Odoo');
  if (!apply) {
    console.log('\nDry-run: no se publicó nada. Corré con --apply para enviar.');
    await mongoose.disconnect();
    return;
  }

  const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const resumenHtml = `<p><b>Hoja de conformidad completada</b> — ${esc(record.cliente)} (${esc(record.matricula)})</p>
    <p>Fecha: ${esc(record.fecha)} ${esc(record.hora)}<br>Técnico: ${esc(record.instalador)}</p>`;
  const pdfBuffer = await buildConformidadPdfBuffer(record.toObject() as never);
  await pushConformidadToTicket({
    ticketId: TICKET,
    pdfBuffer,
    fileName: `hoja_conformidad_${record.codigoActa}.pdf`,
    resumenHtml,
    as: { login: usuario.odoo.login, password: decryptSecret(usuario.odoo.passwordEnc) },
  });
  console.log('Publicado en el ticket', TICKET);
  record.odooSync = { status: 'SYNCED', attempts: (record.odooSync?.attempts ?? 0) + 1, syncedAt: new Date(), lastError: '', lastAttemptAt: new Date() };
  await record.save();
  console.log('odooSync marcado SYNCED');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
