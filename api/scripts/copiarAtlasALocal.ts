import 'dotenv/config';
import { spawn } from 'node:child_process';

// Copia la base de Atlas (la que usa Render) al Mongo local de pruebas (`pnpm mongo:pruebas`).
// SOLO LEE Atlas (mongodump); lo único que se escribe es el Mongo local, y se REEMPLAZA su contenido (--drop).
// Usa las herramientas de la imagen mongo:7 vía Docker, así no hace falta instalar nada.
//
// Uso: pnpm mongo:copiar-atlas            (pide --si para ejecutarse)
//      pnpm mongo:copiar-atlas --si
// Ojo: la copia trae datos reales (firmas, DNI, mails) a esta compu. Y los ids de Odoo de esas hojas son de producción:
// si la API local apunta al Odoo de staging, esos ids no van a coincidir.
const CONTENEDOR = 'wara-mongo-pruebas';
const DB_LOCAL = 'wara-pruebas';

function main() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri || !/^mongodb(\+srv)?:\/\//i.test(uri) || /localhost|127\.0\.0\.1/.test(uri)) {
    console.error('MONGODB_URI de .env tiene que ser la de Atlas (no la local).');
    process.exit(1);
  }
  const dbAtlas = new URL(uri.replace(/^mongodb(\+srv)?:/i, 'http:')).pathname.replace(/^\//, '');
  if (!dbAtlas) {
    console.error('La MONGODB_URI de Atlas no trae el nombre de la base.');
    process.exit(1);
  }
  if (!process.argv.includes('--si')) {
    console.error(`Va a REEMPLAZAR el contenido de ${DB_LOCAL} (Mongo local) con una copia de la base "${dbAtlas}" de Atlas.`);
    console.error('Atlas solo se lee. Para seguir: pnpm mongo:copiar-atlas --si');
    process.exit(1);
  }

  const dump = spawn('docker', ['run', '--rm', 'mongo:7', 'mongodump', `--uri=${uri}`, '--archive', '--quiet'], { stdio: ['ignore', 'pipe', 'inherit'] });
  const restore = spawn(
    'docker',
    ['exec', '-i', CONTENEDOR, 'mongorestore', '--archive', '--drop', `--nsFrom=${dbAtlas}.*`, `--nsTo=${DB_LOCAL}.*`],
    { stdio: ['pipe', 'inherit', 'inherit'] },
  );
  dump.stdout.pipe(restore.stdin);
  let dumpCode: number | null = null;
  dump.on('close', (c) => (dumpCode = c));
  restore.on('close', (c) => {
    if (dumpCode !== 0 || c !== 0) {
      console.error(`Falló la copia (mongodump=${dumpCode}, mongorestore=${c}).`);
      process.exit(1);
    }
    console.log(`Listo: "${dbAtlas}" de Atlas copiada a ${DB_LOCAL} (local).`);
  });
}

main();
