import { env } from './env.js';

// Odoo Online exposes a JSON-RPC endpoint at /jsonrpc — no extra dependency
// needed, Node's global fetch is enough. Mirrors the client already proven
// against this same instance in the WARA dashboard project.
async function jsonRpc(service: string, method: string, args: unknown[]): Promise<unknown> {
  const res = await fetch(`${env.ODOO_URL}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { service, method, args }, id: Date.now() }),
  });

  const text = await res.text();
  let data: { result?: unknown; error?: { message?: string; data?: { message?: string } } };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Respuesta no JSON de Odoo. HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  if (data.error) {
    throw new Error(data.error.data?.message ?? data.error.message ?? JSON.stringify(data.error));
  }
  return data.result;
}

// The uid for a given api key doesn't change between requests — cache it in
// memory instead of re-authenticating on every call. If the key is revoked
// or a call fails for an auth-shaped reason, the caller clears this so the
// next call re-authenticates instead of retrying forever with a dead uid.
let uidPromise: Promise<number> | null = null;

export async function getUid(): Promise<number> {
  if (!uidPromise) {
    uidPromise = (async () => {
      const uid = await jsonRpc('common', 'authenticate', [env.ODOO_DB, env.ODOO_EMAIL, env.ODOO_API_KEY, {}]);
      if (!uid || typeof uid !== 'number') throw new Error('Odoo rechazó la autenticación (revisar DB/email/API key).');
      return uid;
    })().catch((err) => {
      uidPromise = null;
      throw err;
    });
  }
  return uidPromise;
}

export function invalidateUid(): void {
  uidPromise = null;
}

// Authenticates a técnico's own Odoo login/password (as opposed to the
// shared service account above) — used to verify/link an account and to
// post messages to a ticket "as" that técnico. Not cached: this only runs
// on the infrequent link/send actions, never on a hot path.
export async function authenticateOdooCredentials(login: string, password: string): Promise<number> {
  const uid = await jsonRpc('common', 'authenticate', [env.ODOO_DB, login, password, {}]);
  if (!uid || typeof uid !== 'number') throw new Error('Odoo rechazó la autenticación (usuario o contraseña incorrectos).');
  return uid;
}

export async function executeKwAsCredentials(
  login: string,
  password: string,
  model: string,
  method: string,
  args: unknown[] = [],
  kwargs: Record<string, unknown> = {},
): Promise<unknown> {
  const uid = await authenticateOdooCredentials(login, password);
  const context = { lang: 'es_AR', ...(kwargs.context as Record<string, unknown> | undefined) };
  return jsonRpc('object', 'execute_kw', [env.ODOO_DB, uid, password, model, method, args, { ...kwargs, context }]);
}

export async function executeKw(
  model: string,
  method: string,
  args: unknown[] = [],
  kwargs: Record<string, unknown> = {},
): Promise<unknown> {
  const uid = await getUid();
  const context = { lang: 'es_AR', ...(kwargs.context as Record<string, unknown> | undefined) };
  try {
    return await jsonRpc('object', 'execute_kw', [env.ODOO_DB, uid, env.ODOO_API_KEY, model, method, args, { ...kwargs, context }]);
  } catch (err) {
    // A stale/invalidated session on Odoo's side surfaces as a generic
    // access error, not a distinct auth error code — re-auth once and retry
    // before giving up, so a session expiring mid-day doesn't need a deploy.
    const message = err instanceof Error ? err.message : String(err);
    if (/access denied|session|invalid/i.test(message)) {
      invalidateUid();
      const uid2 = await getUid();
      return jsonRpc('object', 'execute_kw', [env.ODOO_DB, uid2, env.ODOO_API_KEY, model, method, args, { ...kwargs, context }]);
    }
    throw err;
  }
}
