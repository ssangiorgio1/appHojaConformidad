import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { app } from './app.js';
import { warmUpPdf } from './services/pdf.service.js';

async function main() {
  await connectDB();
  app.listen(env.PORT, () => {
    console.log(`API listening on port ${env.PORT}`);
    // Diferido: al despertar (Render) las primeras peticiones reales no deben competir con el arranque de Chromium.
    setTimeout(warmUpPdf, 15_000).unref();
  });
}

main().catch((err) => {
  console.error('Fatal error during startup:', err);
  process.exit(1);
});
