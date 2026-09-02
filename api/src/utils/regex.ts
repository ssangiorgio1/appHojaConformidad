// Escapes regex metacharacters so untrusted input used to build a RegExp is
// matched literally. Without this, a query param like `search=(a+)+$` builds
// a pattern with catastrophic backtracking and can pin the event loop at
// 100% CPU on a single request (ReDoS) — every field below is filtered from
// user-supplied query params (see conformidades.controller.ts's listConformidades).
export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
