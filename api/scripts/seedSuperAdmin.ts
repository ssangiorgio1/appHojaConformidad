import { env } from '../src/config/env.js';
import { connectDB } from '../src/config/db.js';
import { UsuarioModel } from '../src/models/Usuario.js';
import mongoose from 'mongoose';

async function main() {
  const email = process.argv[2]?.toLowerCase().trim();

  if (!email) {
    console.error('Usage: pnpm seed:superadmin <email@waragps.com>');
    process.exit(1);
  }

  if (!email.endsWith(`@${env.ALLOWED_EMAIL_DOMAIN.toLowerCase()}`)) {
    console.error(`Refusing to seed a superadmin outside @${env.ALLOWED_EMAIL_DOMAIN}`);
    process.exit(1);
  }

  await connectDB();

  const usuario = await UsuarioModel.findOneAndUpdate(
    { email },
    { $set: { role: 'superadmin', activo: true }, $setOnInsert: { email } },
    { upsert: true, new: true },
  );

  console.log(`Superadmin ready: ${usuario.email} (role=${usuario.role}, firebaseUid=${usuario.firebaseUid ?? 'pending first login'})`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
