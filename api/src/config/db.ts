import mongoose from 'mongoose';
import { env } from './env.js';

const CONNECT_MAX_ATTEMPTS = 5;
const CONNECT_RETRY_DELAY_MS = 2000;

// MONGODB_URI usa mongodb+srv://, que resuelve un registro DNS SRV antes de
// poder conectar — en la práctica esa resolución falla de forma intermitente
// (ESERVFAIL) sin que el registro en sí esté roto (confirmado con nslookup,
// 2026-09-25: resuelve bien al toque de reintentar). Sin retry acá, un solo
// blip tumbaba todo el proceso (ver server.ts: connectDB() rechaza →
// process.exit(1)) o cortaba en seco cualquier script de scripts/. Reintenta
// con backoff simple antes de darse por vencido.
export async function connectDB() {
  mongoose.set('strictQuery', true);
  for (let attempt = 1; attempt <= CONNECT_MAX_ATTEMPTS; attempt++) {
    try {
      await mongoose.connect(env.MONGODB_URI);
      console.log('MongoDB connected');
      return;
    } catch (err) {
      if (attempt === CONNECT_MAX_ATTEMPTS) throw err;
      console.error(`MongoDB connect attempt ${attempt}/${CONNECT_MAX_ATTEMPTS} failed, retrying in ${CONNECT_RETRY_DELAY_MS}ms:`, err);
      await new Promise((resolve) => setTimeout(resolve, CONNECT_RETRY_DELAY_MS));
    }
  }
}
