import type {
  CalendarTask,
  ConformidadDoc,
  CreateUsuarioInput,
  CreateUsuarioResponse,
  EstadoSubtareaIncidencia,
  ListCalendarTasksQuery,
  ListConformidadesQuery,
  OdooTechnician,
  Paginated,
  ReporteTecnico,
  ReporteVisita,
  ReporteVisitasQuery,
  SubtareaIncidencia,
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
  odooUserId?: number | null;
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

export function generateConformidadPdf(idToken: string, id: string) {
  return apiFetch<{ pdfReporte: { url: string; key: string } }>(`/api/conformidades/${id}/pdf`, idToken, { method: 'POST' });
}

export function setAltaConformidad(idToken: string, id: string, area: 'mesaAyuda' | 'coordinacion', checked: boolean) {
  return apiFetch<ConformidadDoc>(`/api/conformidades/${id}/alta`, idToken, { method: 'POST', body: { area, checked } });
}

function calendarQueryString(query: ListCalendarTasksQuery): string {
  const params = new URLSearchParams({ from: query.from, to: query.to });
  if (query.technicianIds?.length) params.set('technicianIds', query.technicianIds.join(','));
  return `?${params.toString()}`;
}

export function listCalendarTasks(idToken: string, query: ListCalendarTasksQuery) {
  return apiFetch<{ data: CalendarTask[] }>(`/api/calendar/tasks${calendarQueryString(query)}`, idToken).then((r) => r.data);
}

export function listTechnicians(idToken: string) {
  return apiFetch<{ data: OdooTechnician[] }>('/api/calendar/technicians', idToken).then((r) => r.data);
}

export function moveCalendarTask(idToken: string, taskId: number, body: { start: string; end: string }) {
  return apiFetch<void>(`/api/calendar/tasks/${taskId}/move`, idToken, { method: 'PATCH', body });
}

function reporteVisitasQueryString(query: ReporteVisitasQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function getReporteVisitas(idToken: string, query: ReporteVisitasQuery = {}) {
  return apiFetch<{ data: ReporteVisita[] }>(`/api/reportes/visitas${reporteVisitasQueryString(query)}`, idToken).then(
    (r) => r.data,
  );
}

export function getReporteTecnicos(idToken: string, query: ReporteVisitasQuery = {}) {
  return apiFetch<{ data: ReporteTecnico[] }>(`/api/reportes/tecnicos${reporteVisitasQueryString(query)}`, idToken).then(
    (r) => r.data,
  );
}

export function listSubtareaIncidencias(idToken: string, estado?: EstadoSubtareaIncidencia) {
  const qs = estado ? `?estado=${estado}` : '';
  return apiFetch<{ data: SubtareaIncidencia[] }>(`/api/subtareas/incidencias${qs}`, idToken).then((r) => r.data);
}

export function resolveSubtareaIncidencia(idToken: string, id: string) {
  return apiFetch<SubtareaIncidencia>(`/api/subtareas/incidencias/${id}`, idToken, {
    method: 'PATCH',
    body: { estado: 'reprogramada' },
  });
}
