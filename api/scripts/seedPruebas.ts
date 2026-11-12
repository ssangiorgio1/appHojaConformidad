import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { UsuarioModel } from '../src/models/Usuario.js';

// Carga (o actualiza) un usuario en la Mongo LOCAL de pruebas, sin tocar Firebase: al iniciar sesión por primera vez
// con ese email, el middleware de auth lo reclama (le asigna el firebaseUid). Sirve para dejar listo el vínculo con Odoo
// (odooUserId) que, si no, hay que cargar a mano desde el panel.
//
// Uso: pnpm seed:pruebas <email> [rol=tecnico] [odooUserId] [nombre]
//   pnpm seed:pruebas jsangiorgio@waragps.com tecnico 295 "Joaquin prueba"
// Solo corre con WARA_ENTORNO=pruebas (pnpm seed:pruebas ya lo carga) para no escribir por error en una base real.
async function main() {
  if (env.WARA_ENTORNO !== 'pruebas') {
    console.error('Solo en modo pruebas: usá `pnpm seed:pruebas` (carga .env.pruebas).');
    process.exit(1);
  }
  const [emailArg, rolArg, odooArg, ...nombreArg] = process.argv.slice(2);
  const email = emailArg?.toLowerCase().trim();
  const role = (rolArg ?? 'tecnico').trim();
  const odooUserId = odooArg ? Number(odooArg) : undefined;
  if (!email || (odooArg && !Number.isInteger(odooUserId))) {
    console.error('Uso: pnpm seed:pruebas <email> [rol=tecnico] [odooUserId] [nombre]');
    process.exit(1);
  }
  if (!['tecnico', 'admin', 'superadmin', 'coordinacion', 'mesa_ayuda'].includes(role)) {
    console.error(`Rol inválido: ${role}`);
    process.exit(1);
  }

  await connectDB();
  const nombre = nombreArg.join(' ').trim();
  const usuario = await UsuarioModel.findOneAndUpdate(
    { email },
    { $set: { role, activo: true, ...(odooUserId ? { odooUserId } : {}), ...(nombre ? { nombre } : {}) }, $setOnInsert: { email } },
    { upsert: true, returnDocument: 'after' },
  );
  console.log(`Usuario de pruebas listo: ${usuario.email} (rol=${usuario.role}, odooUserId=${usuario.odooUserId ?? '-'})`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
