// Cronometra un refresco real de la flota (BO3 + escritura a Atlas) y muestra cuántas unidades se escribieron.
import 'dotenv/config';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { refrescarFlota } from '../src/services/flota.service.js';

await mongoose.connect(env.MONGODB_URI);
for (let i = 1; i <= 2; i++) {
  const t = Date.now();
  const r = await refrescarFlota();
  console.log(`corrida ${i}: ${((Date.now() - t) / 1000).toFixed(1)} s`, 'cooldown' in r ? r : { unidades: r.unidades, escritas: r.escritas, eliminadas: r.eliminadas });
  if ('cooldown' in r) break;
}
await mongoose.disconnect();
