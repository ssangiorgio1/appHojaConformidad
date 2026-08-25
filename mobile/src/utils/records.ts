import { newRecord, type ConformidadRecord } from '@wara/shared';
import { uuid, nowIso } from './misc';

export function newRecordFor(instalador: string): ConformidadRecord {
  const record = newRecord(uuid(), nowIso());
  record.instalador = instalador;
  return record;
}

export { fmtDateTime } from './misc';
