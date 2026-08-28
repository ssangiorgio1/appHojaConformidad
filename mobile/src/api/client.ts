import type { Checklist, Equipo, EstadoServicio, OdooSync, SatisfaccionFirma, TicketOdooRef } from '@wara/shared';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiFetch<T>(path: string, idToken: string, init?: { method?: string; body?: unknown }): Promise<T> {
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

export interface Usuario {
  _id: string;
  firebaseUid?: string;
  email: string;
  nombre: string;
  role: 'tecnico' | 'admin' | 'superadmin' | 'coordinacion' | 'mesa_ayuda';
  legajo: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export function getMe(idToken: string) {
  return apiFetch<Usuario>('/api/auth/me', idToken);
}

export interface UpdateMeBody {
  nombre?: string;
  legajo?: string;
}

export function updateMe(idToken: string, body: UpdateMeBody) {
  return apiFetch<Usuario>('/api/auth/me', idToken, { method: 'PATCH', body });
}

// Wire shapes for the API — distinct from @wara/shared's local ConformidadRecord:
// photos/signatures are referenced by uploaded url/key here, never by dataUrl.
export interface RemoteFoto {
  id: string;
  url: string;
  key: string;
}

export interface RemoteFirma {
  url?: string;
  key?: string;
  firmedAt?: string;
  satisfaccion?: SatisfaccionFirma | null;
}

export interface RemotePhase {
  checklist?: Partial<Checklist>;
  observaciones?: string;
  fotos?: RemoteFoto[];
  firma?: RemoteFirma | null;
}

export interface CreateConformidadBody {
  clientId: string;
  numero?: string;
  cliente?: string;
  fecha: string;
  hora?: string;
  matricula?: string;
  instalador?: string;
  responsableEmpresa?: string;
  pre: RemotePhase;
  ticketOdoo?: TicketOdooRef | null;
}

export interface PatchConformidadBody {
  numero?: string;
  cliente?: string;
  fecha?: string;
  hora?: string;
  matricula?: string;
  instalador?: string;
  responsableEmpresa?: string;
  pre?: RemotePhase;
  post?: RemotePhase;
  equipo?: Partial<Equipo>;
  ticketOdoo?: TicketOdooRef | null;
  pdfReporte?: { url: string; key: string } | null;
}

export interface ConformidadDoc {
  _id: string;
  clientId: string;
  codigoActa: string;
  status: EstadoServicio;
}

export function createConformidad(idToken: string, body: CreateConformidadBody) {
  return apiFetch<ConformidadDoc>('/api/conformidades', idToken, { method: 'POST', body });
}

export function patchConformidad(idToken: string, id: string, body: PatchConformidadBody) {
  return apiFetch<ConformidadDoc>(`/api/conformidades/${id}`, idToken, { method: 'PATCH', body });
}

// Full record shape returned by GET/list — as opposed to ConformidadDoc,
// which is only the slice create/patch echo back.
export interface RemoteConformidad {
  _id: string;
  clientId: string;
  codigoActa: string;
  numero: string;
  cliente: string;
  fecha: string;
  hora: string;
  matricula: string;
  instalador: string;
  responsableEmpresa: string;
  status: EstadoServicio;
  pre: RemotePhase;
  post: RemotePhase;
  equipo: Partial<Equipo>;
  ticketOdoo: TicketOdooRef | null;
  odooSync: OdooSync;
  pdfReporte: { url: string; key: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListConformidadesResponse {
  data: RemoteConformidad[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function listConformidades(idToken: string, page: number, pageSize: number) {
  return apiFetch<ListConformidadesResponse>(`/api/conformidades?page=${page}&pageSize=${pageSize}`, idToken);
}

export interface PresignedUrlRequest {
  localId: string;
  fecha: string;
  fase: 'pre' | 'post';
  tipo: 'foto' | 'firma' | 'pdf';
  contentType: 'image/jpeg' | 'image/png' | 'application/pdf';
  indice?: number;
}

export interface PresignedUrlResponse {
  codigoActa: string;
  key: string;
  uploadUrl: string;
  publicUrl: string;
}

export function createPresignedUploadUrl(idToken: string, body: PresignedUrlRequest) {
  return apiFetch<PresignedUrlResponse>('/api/uploads/presigned-url', idToken, { method: 'POST', body });
}

export interface OdooTicketResult {
  id: number;
  label: string;
  partnerName: string | null;
  stage: string | null;
}

export function searchOdooTickets(idToken: string, q: string) {
  return apiFetch<{ data: OdooTicketResult[] }>(`/api/odoo/tickets/search?q=${encodeURIComponent(q)}`, idToken);
}

export function syncConformidadToOdoo(idToken: string, remoteId: string) {
  return apiFetch<{ odooSync: OdooSync }>(`/api/conformidades/${remoteId}/odoo-sync`, idToken, { method: 'POST' });
}
