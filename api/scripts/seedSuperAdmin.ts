import { connectDB } from '../src/config/db.js';
import { UsuarioModel } from '../src/models/Usuario.js';
import { ensureFirebaseUser } from '../src/services/usuario.service.js';
import mongoose from 'mongoose';

const VALID_ROLES = ['tecnico', 'admin', 'superadmin', 'coordinacion', 'mesa_ayuda'] as const;
type Role = (typeof VALID_ROLES)[number];

async function main() {
  const email = process.argv[2]?.toLowerCase().trim();
  const role = (process.argv[3]?.toLowerCase().trim() ?? 'superadmin') as Role;

  if (!email) {
    console.error('Usage: pnpm seed:superadmin <email> [role=superadmin]');
    process.exit(1);
  }

  if (!VALID_ROLES.includes(role)) {
    console.error(`Invalid role "${role}" — must be one of: ${VALID_ROLES.join(', ')}`);
    process.exit(1);
  }

  // No domain restriction on the target email here — seeding a user by hand
  // (an admin running this script) is exactly how a domain exception gets
  // vetted; see auth.middleware.ts.

  const { uid: firebaseUid, tempPassword } = await ensureFirebaseUser(email);
  if (tempPassword) {
    console.log(`Created new Firebase account for ${email}.`);
    console.log(`  Temporary password: ${tempPassword}`);
    console.log('  Share it securely and have them change it after first login.');
  } else {
    console.log(`Firebase account already exists for ${email} (uid=${firebaseUid}).`);
  }

  await connectDB();

  const usuario = await UsuarioModel.findOneAndUpdate(
    { email },
    { $set: { role, activo: true, firebaseUid }, $setOnInsert: { email } },
    { upsert: true, new: true },
  );

  console.log(`Usuario ready: ${usuario.email} (role=${usuario.role}, firebaseUid=${usuario.firebaseUid})`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
