import type {
  ConformidadDoc,
  CreateUsuarioInput,
  CreateUsuarioResponse,
  ListConformidadesQuery,
  Paginated,
  Usuario,
  UsuarioRole,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiFetch<T>(
  path: string,
  idToken: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error ?? res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function getMe(idToken: string) {
  return apiFetch<Usuario>('/api/auth/me', idToken);
}

export function updateMe(idToken: string, body: { nombre?: string; legajo?: string }) {
  return apiFetch<Usuario>('/api/auth/me', idToken, { method: 'PATCH', body });
}

export function listUsuarios(idToken: string) {
  return apiFetch<Usuario[]>('/api/auth/usuarios', idToken);
}

export function createUsuario(idToken: string, body: CreateUsuarioInput) {
  return apiFetch<CreateUsuarioResponse>('/api/auth/usuarios', idToken, { method: 'POST', body });
}

export interface UpdateUsuarioBody {
  nombre?: string;
  legajo?: string;
  role?: UsuarioRole;
  activo?: boolean;
}

export function updateUsuario(idToken: string, id: string, patch: UpdateUsuarioBody) {
  return apiFetch<Usuario>(`/api/auth/usuarios/${id}`, idToken, { method: 'PATCH', body: patch });
}

export function resetUsuarioPassword(idToken: string, id: string) {
  return apiFetch<{ tempPassword: string }>(`/api/auth/usuarios/${id}/reset-password`, idToken, { method: 'POST' });
}

function queryString(query: ListConformidadesQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function listConformidades(idToken: string, query: ListConformidadesQuery = {}) {
  return apiFetch<Paginated<ConformidadDoc>>(`/api/conformidades${queryString(query)}`, idToken);
}

export function getConformidad(idToken: string, id: string) {
  return apiFetch<ConformidadDoc>(`/api/conformidades/${id}`, idToken);
}
