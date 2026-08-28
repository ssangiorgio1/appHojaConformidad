import * as Print from 'expo-print';
import type { ConformidadRecord, Firma, Foto, Phase } from '@wara/shared';
import { dbPut } from '../db/database';
import {
  createConformidad,
  patchConformidad,
  syncConformidadToOdoo,
  type RemoteFirma,
  type RemoteFoto,
  type RemotePhase,
} from '../api/client';
import { uploadAsset } from './uploadAsset';
import { nowIso } from '../utils/misc';
import { trimSyncedAssets } from './trim';
import { buildPrintHtml } from '../utils/printHtml';
import { getLogoDataUri } from '../utils/logo';

async function resolveFotos(
  idToken: string,
  record: ConformidadRecord,
  fase: 'pre' | 'post',
  fotos: Foto[],
): Promise<{ local: Foto[]; remote: RemoteFoto[] }> {
  const local: Foto[] = [];
  const remote: RemoteFoto[] = [];

  for (let i = 0; i < fotos.length; i++) {
    const foto = fotos[i];
    if (foto.url && foto.key) {
      local.push(foto);
      remote.push({ id: foto.id, url: foto.url, key: foto.key });
      continue;
    }
    if (!foto.dataUrl) {
      local.push(foto);
      continue;
    }
    const { url, key } = await uploadAsset(idToken, {
      localId: record.id,
      fecha: record.fecha,
      fase,
      tipo: 'foto',
      source: foto.dataUrl,
      indice: i,
    });
    local.push({ ...foto, url, key });
    remote.push({ id: foto.id, url, key });
  }

  return { local, remote };
}

async function resolveFirma(
  idToken: string,
  record: ConformidadRecord,
  fase: 'pre' | 'post',
  firma: Firma | null,
): Promise<{ local: Firma | null; remote: RemoteFirma | null }> {
  if (!firma) return { local: null, remote: null };
  if (firma.url && firma.key) {
    return {
      local: firma,
      remote: { url: firma.url, key: firma.key, firmedAt: firma.firmedAt, satisfaccion: firma.satisfaccion },
    };
  }
  if (!firma.dataUrl) {
    // "No firma por disconformidad" never captures a dataUrl — there's
    // nothing to upload, but the outcome itself must still reach the server.
    return { local: firma, remote: firma.satisfaccion ? { firmedAt: firma.firmedAt, satisfaccion: firma.satisfaccion } : null };
  }

  const { url, key } = await uploadAsset(idToken, {
    localId: record.id,
    fecha: record.fecha,
    fase,
    tipo: 'firma',
    source: firma.dataUrl,
  });
  const local = { ...firma, url, key };
  return { local, remote: { url, key, firmedAt: firma.firmedAt, satisfaccion: firma.satisfaccion } };
}

async function resolvePhase(
  idToken: string,
  record: ConformidadRecord,
  fase: 'pre' | 'post',
  phase: Phase,
): Promise<{ local: Phase; remote: RemotePhase }> {
  const [fotos, firma] = await Promise.all([
    resolveFotos(idToken, record, fase, phase.fotos),
    resolveFirma(idToken, record, fase, phase.firma),
  ]);
  return {
    local: { ...phase, fotos: fotos.local, firma: firma.local },
    remote: { checklist: phase.checklist, observaciones: phase.observaciones, fotos: fotos.remote, firma: firma.remote },
  };
}

// Pushes fotos/firma to R2 and the record's current state to the API. Fails
// soft — the app is offline-first, so a sync failure just leaves
// syncStatus 'PENDING_SYNC' for the next retry (see index.tsx's load()).
export async function syncRecord(record: ConformidadRecord, getIdToken: () => Promise<string>): Promise<boolean> {
  if (record.status === 'borrador_pre') return false;

  try {
    const idToken = await getIdToken();
    let working = record;

    const pre = await resolvePhase(idToken, working, 'pre', working.pre);
    working = { ...working, pre: pre.local };
    await dbPut({ ...working, updatedAt: nowIso() });

    let remoteId = working.remoteId;
    if (!remoteId) {
      const doc = await createConformidad(idToken, {
        clientId: working.id,
        numero: working.numero,
        cliente: working.cliente,
        fecha: working.fecha,
        hora: working.hora,
        matricula: working.matricula,
        instalador: working.instalador,
        responsableEmpresa: working.responsableEmpresa,
        pre: pre.remote,
        ticketOdoo: working.ticketOdoo,
      });
      remoteId = doc._id;
      working = { ...working, remoteId };
      await dbPut({ ...working, updatedAt: nowIso() });
    }

    let postRemote: RemotePhase | undefined;
    if (working.status === 'completo') {
      const post = await resolvePhase(idToken, working, 'post', working.post);
      working = { ...working, post: post.local };
      await dbPut({ ...working, updatedAt: nowIso() });
      postRemote = post.remote;
    }

    await patchConformidad(idToken, remoteId, {
      numero: working.numero,
      cliente: working.cliente,
      fecha: working.fecha,
      hora: working.hora,
      matricula: working.matricula,
      instalador: working.instalador,
      responsableEmpresa: working.responsableEmpresa,
      equipo: working.equipo,
      pre: pre.remote,
      post: postRemote,
      ticketOdoo: working.ticketOdoo,
    });

    if (working.status === 'completo' && working.ticketOdoo && working.odooSync.status !== 'SYNCED') {
      // Best-effort — a failure here must never affect the record's own
      // sync status (tracked separately via odooSync, retried independently
      // from index.tsx's background pass and ver/[id].tsx's retry button).
      try {
        working = await pushToOdoo(idToken, remoteId, working);
        await dbPut({ ...working, updatedAt: nowIso() });
      } catch {
        // leave odooSync as-is (still PENDING/FAILED) for the next retry
      }
    }

    const trimmed = trimSyncedAssets(working).record;
    await dbPut({ ...trimmed, syncStatus: 'SYNCED', updatedAt: nowIso() });
    return true;
  } catch {
    return false;
  }
}

// Generates the finished hoja de conformidad PDF (once), uploads it to R2,
// and asks the backend to attach it to the linked Odoo ticket.
async function pushToOdoo(idToken: string, remoteId: string, record: ConformidadRecord): Promise<ConformidadRecord> {
  let working = record;

  if (!working.pdfReporte) {
    const logoDataUri = await getLogoDataUri();
    const html = await buildPrintHtml(working, { logoDataUri });
    const { uri } = await Print.printToFileAsync({ html });
    const { url, key } = await uploadAsset(idToken, {
      localId: working.id,
      fecha: working.fecha,
      fase: 'post',
      tipo: 'pdf',
      source: uri,
    });
    const pdfReporte = { url, key };
    await patchConformidad(idToken, remoteId, { pdfReporte });
    working = { ...working, pdfReporte };
  }

  const { odooSync } = await syncConformidadToOdoo(idToken, remoteId);
  return { ...working, odooSync };
}
