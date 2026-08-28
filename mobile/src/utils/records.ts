import { newRecord, type ConformidadRecord } from '@wara/shared';
import { dbGetAll } from '../db/database';
import { uuid, generateNumeroHoja } from './misc';

const MAX_NUMERO_ATTEMPTS = 5;

export async function newRecordFor(instalador: string): Promise<ConformidadRecord> {
  const record = newRecord(uuid(), new Date());
  record.instalador = instalador;
  record.numero = await pickUniqueNumeroHoja();
  return record;
}

async function pickUniqueNumeroHoja(): Promise<string> {
  const existing = new Set((await dbGetAll()).map((r) => r.numero));
  for (let attempt = 0; attempt < MAX_NUMERO_ATTEMPTS; attempt++) {
    const candidate = generateNumeroHoja();
    if (!existing.has(candidate)) return candidate;
  }
  return generateNumeroHoja();
}

export { fmtDateTime } from './misc';
