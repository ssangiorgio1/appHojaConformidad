// Deterministic derivation so the same (localId, fecha) always yields the same
// codigoActa — needed because the first R2 upload happens before any
// `Conformidad` document exists in Mongo (see uploads.controller.ts).
function shortHash(input: string): string {
  // FNV-1a, 32-bit — deterministic, no crypto dependency needed for a display slug.
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0').toUpperCase();
}

export function deriveCodigoActa(localId: string, fecha: string): string {
  const fechaCompacta = fecha.replace(/-/g, '');
  return `CONF-${fechaCompacta}-${shortHash(localId)}`;
}
