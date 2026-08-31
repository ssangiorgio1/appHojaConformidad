import type { ConformidadRecord, Phase } from '@wara/shared';
import { emptyChecklist, emptyOdooSync } from '@wara/shared';
import { dbGet, dbPut } from '../db/database';
import { listConformidades, type RemoteConformidad, type RemotePhase } from '../api/client';

function mapPhase(remote: RemotePhase | undefined): Phase {
  return {
    checklist: { ...emptyChecklist(), ...(remote?.checklist ?? {}) },
    observaciones: remote?.observaciones ?? '',
    // The server doesn't persist which guided-capture slot a photo came
    // from (only id/url/key) — pulled photos won't re-match a labeled slot
    // if that phase's wizard is ever reopened, but they're preserved fine
    // for viewing/printing.
    fotos: (remote?.fotos ?? []).map((f) => ({ id: f.id, slotKey: f.id, url: f.url, key: f.key })),
    firma: remote?.firma
      ? {
          url: remote.firma.url,
          key: remote.firma.key,
          firmedAt: remote.firma.firmedAt,
          satisfaccion: remote.firma.satisfaccion ?? null,
          motivo: remote.firma.motivo,
        }
      : null,
  };
}

function mapRemoteToLocal(doc: RemoteConformidad, ownerUid: string): ConformidadRecord {
  return {
    id: doc.clientId,
    remoteId: doc._id,
    codigoActa: doc.codigoActa,
    numero: doc.numero ?? '',
    cliente: doc.cliente ?? '',
    fecha: doc.fecha,
    hora: doc.hora ?? '',
    matricula: doc.matricula ?? '',
    instalador: doc.instalador ?? '',
    responsableEmpresa: doc.responsableEmpresa ?? '',
    status: doc.status,
    syncStatus: 'SYNCED',
    localOwnerUid: ownerUid,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    pre: mapPhase(doc.pre),
    post: mapPhase(doc.post),
    equipo: doc.equipo,
    ticketOdoo: doc.ticketOdoo ?? null,
    odooSync: doc.odooSync ?? emptyOdooSync(),
    pdfReporte: doc.pdfReporte ?? null,
  };
}

// Fills in whichever of the técnico's own records exist on the server but
// not on this device — e.g. after a reinstall, or after a shared-device
// account switch cleared the local cache. Never touches a record that's
// already present locally, so it can't clobber in-progress edits.
export async function pullMyConformidades(idToken: string, ownerUid: string): Promise<void> {
  let page = 1;
  for (;;) {
    const res = await listConformidades(idToken, page, 200);
    for (const doc of res.data) {
      const existing = await dbGet(doc.clientId);
      if (!existing) await dbPut(mapRemoteToLocal(doc, ownerUid));
    }
    if (page >= res.totalPages) break;
    page++;
  }
}
