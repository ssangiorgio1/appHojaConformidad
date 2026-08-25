import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { app } from './app.js';

async function main() {
  await connectDB();
  app.listen(env.PORT, () => {
    console.log(`API listening on port ${env.PORT}`);
  });
}

main().catch((err) => {
  console.error('Fatal error during startup:', err);
  process.exit(1);
});
