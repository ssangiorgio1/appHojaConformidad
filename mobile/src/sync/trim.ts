import type { ConformidadRecord, Phase } from '@wara/shared';

function trimPhase(phase: Phase): { phase: Phase; changed: boolean } {
  let changed = false;

  const fotos = phase.fotos.map((f) => {
    if (f.dataUrl && f.url && f.key) {
      changed = true;
      const { dataUrl: _drop, ...rest } = f;
      return rest;
    }
    return f;
  });

  let firma = phase.firma;
  if (firma?.dataUrl && firma.url && firma.key) {
    changed = true;
    const { dataUrl: _drop, ...rest } = firma;
    firma = rest;
  }

  return { phase: changed ? { ...phase, fotos, firma } : phase, changed };
}

// Once a photo/signature has been uploaded (it has a url+key), its base64
// dataUrl is pure local bloat — printHtml.ts falls back to the remote url
// when dataUrl is missing, so this is safe to drop. Keeps the SQLite
// `records` table from growing without bound as a técnico completes jobs.
export function trimSyncedAssets(record: ConformidadRecord): { record: ConformidadRecord; changed: boolean } {
  const pre = trimPhase(record.pre);
  const post = trimPhase(record.post);
  if (!pre.changed && !post.changed) return { record, changed: false };
  return { record: { ...record, pre: pre.phase, post: post.phase }, changed: true };
}
