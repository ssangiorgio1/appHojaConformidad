import * as SQLite from 'expo-sqlite';
import type { ConformidadRecord } from '@wara/shared';

const DB_NAME = 'wara_conformidad.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function openDB() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS records (
          id TEXT PRIMARY KEY NOT NULL,
          status TEXT NOT NULL,
          syncStatus TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          data TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_records_status ON records(status);
        CREATE INDEX IF NOT EXISTS idx_records_updatedAt ON records(updatedAt);
      `);
      return db;
    });
  }
  return dbPromise;
}

export async function dbGetAll(): Promise<ConformidadRecord[]> {
  const db = await openDB();
  const rows = await db.getAllAsync<{ data: string }>('SELECT data FROM records ORDER BY updatedAt DESC');
  return rows.map((r) => JSON.parse(r.data) as ConformidadRecord);
}

export async function dbGet(id: string): Promise<ConformidadRecord | null> {
  const db = await openDB();
  const row = await db.getFirstAsync<{ data: string }>('SELECT data FROM records WHERE id = ?', [id]);
  return row ? (JSON.parse(row.data) as ConformidadRecord) : null;
}

export async function dbPut(record: ConformidadRecord): Promise<void> {
  const db = await openDB();
  await db.runAsync(
    `INSERT INTO records (id, status, syncStatus, updatedAt, data) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET status = excluded.status, syncStatus = excluded.syncStatus,
       updatedAt = excluded.updatedAt, data = excluded.data`,
    [record.id, record.status, record.syncStatus, record.updatedAt, JSON.stringify(record)],
  );
}

export async function dbDelete(id: string): Promise<void> {
  const db = await openDB();
  await db.runAsync('DELETE FROM records WHERE id = ?', [id]);
}

// Called on sign-out so a técnico logging into a shared device doesn't see
// the previous técnico's already-submitted hojas. Records still PENDING_SYNC
// are kept — clearing those would destroy unsaved field work.
export async function dbClearSynced(): Promise<void> {
  const db = await openDB();
  await db.runAsync("DELETE FROM records WHERE syncStatus = 'SYNCED'");
}
