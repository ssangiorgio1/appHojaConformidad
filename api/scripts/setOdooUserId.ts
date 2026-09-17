// Escritura puntual en Mongo (WARA), no en Odoo — setea Usuario.odooUserId
// para un email. Uso: pnpm --filter @wara/api exec tsx scripts/setOdooUserId.ts <email> <odooUserId>
import { connectDB } from '../src/config/db.js';
import { UsuarioModel } from '../src/models/Usuario.js';
import mongoose from 'mongoose';

async function main() {
  const email = process.argv[2]?.toLowerCase().trim();
  const odooUserId = Number(process.argv[3]);
  if (!email || !odooUserId) {
    console.error('Uso: tsx scripts/setOdooUserId.ts <email> <odooUserId>');
    process.exit(1);
  }

  await connectDB();
  const usuario = await UsuarioModel.findOneAndUpdate({ email }, { $set: { odooUserId } }, { new: true });
  console.log(usuario ? { email: usuario.email, odooUserId: usuario.odooUserId } : `No existe Usuario con email ${email}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
