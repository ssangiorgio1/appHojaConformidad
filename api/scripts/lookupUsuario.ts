// Diagnóstico manual, de SOLO LECTURA — busca un Usuario por email y muestra
// su odooUserId (necesario para armar tareas/subtareas de prueba en Odoo).
// Uso: pnpm --filter @wara/api exec tsx scripts/lookupUsuario.ts <email>
import { connectDB } from '../src/config/db.js';
import { UsuarioModel } from '../src/models/Usuario.js';
import mongoose from 'mongoose';

async function main() {
  const email = process.argv[2]?.toLowerCase().trim();
  if (!email) {
    console.error('Uso: tsx scripts/lookupUsuario.ts <email>');
    process.exit(1);
  }

  await connectDB();
  const usuario = await UsuarioModel.findOne({ email });
  console.log(usuario ? usuario.toObject() : `No existe Usuario con email ${email}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
