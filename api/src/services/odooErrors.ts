// Extraído de services/odoo.service.ts para poder compartirlo con
// calendarTask.service.ts sin duplicar la clasificación de errores de Odoo.
export class OdooError extends Error {
  constructor(
    public code: 'TICKET_NOT_FOUND' | 'TASK_NOT_FOUND' | 'AUTH_FAILED' | 'UNKNOWN',
    message: string,
  ) {
    super(message);
  }
}

const CALL_TIMEOUT_MS = 10_000;

export function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new OdooError('UNKNOWN', `Tiempo de espera agotado hablando con Odoo (${label})`)), CALL_TIMEOUT_MS);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function classify(err: unknown): OdooError {
  if (err instanceof OdooError) return err;
  const message = err instanceof Error ? err.message : String(err);
  if (/rechaz.*autenticaci|access denied/i.test(message)) return new OdooError('AUTH_FAILED', message);
  return new OdooError('UNKNOWN', message);
}

export function many2oneName(v: unknown): string | null {
  return Array.isArray(v) && v.length > 1 ? String(v[1]) : null;
}
