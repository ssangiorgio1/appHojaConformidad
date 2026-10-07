import type {
  CalendarTask,
  ConformidadDoc,
  EquipoCoincidencia,
  EstadoEquipo,
  GraficasEquipo,
  FlotaResponse,
  CreateUsuarioInput,
  CreateUsuarioResponse,
  ListCalendarTasksQuery,
  ListConformidadesQuery,
  IncidenciaDestinatario,
  ListSubtareaIncidenciasQuery,
  OdooTechnician,
  Paginated,
  ReporteTecnico,
  ReporteVisita,
  ReporteVisitasQuery,
  RetiroPendiente,
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

// El backend genera el PDF con Puppeteer bajo demanda y lo devuelve como
// binario (application/pdf) — ya no se guarda en R2, así que no hay más
// `pdfReporte.url` que leer de una respuesta JSON (ver
// api/src/controllers/conformidades.controller.ts). No pasa por apiFetch
// porque esa función asume JSON.
export async function generateConformidadPdf(idToken: string, id: string): Promise<Blob> {
  const res = await fetch(`${API_URL}/api/conformidades/${id}/pdf`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error ?? res.statusText);
  }
  return res.blob();
}

export function setAltaConformidad(idToken: string, id: string, area: 'mesaAyuda' | 'coordinacion', checked: boolean) {
  return apiFetch<ConformidadDoc>(`/api/conformidades/${id}/alta`, idToken, { method: 'POST', body: { area, checked } });
}

// Endpoint acotado para el emparejamiento de cambio de equipo — a propósito
// no pasa por listConformidades (ver api/src/controllers/conformidades.controller.ts's
// getRetirosPendientes): busca por matrícula sin importar qué técnico hizo
// la otra hoja, para poder vincularlas manualmente desde acá cuando no se
// pudo hacer en el momento en la PWA. `rol` es el rol que se busca — el
// opuesto al de la hoja que se está vinculando.
export function searchCambioEquipoPendientes(idToken: string, matricula: string, rol: 'retiro' | 'instalacion') {
  return apiFetch<{ data: RetiroPendiente[] }>(
    `/api/conformidades/cambio-equipo/retiros-pendientes?matricula=${encodeURIComponent(matricula)}&rol=${rol}`,
    idToken,
  );
}

export function linkCambioEquipoPareja(idToken: string, id: string, parejaId: string) {
  return apiFetch<ConformidadDoc>(`/api/conformidades/${id}/cambio-equipo-pareja`, idToken, {
    method: 'PATCH',
    body: { parejaId },
  });
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
  return apiFetch<Paginated<ReporteVisita>>(`/api/reportes/visitas${reporteVisitasQueryString(query)}`, idToken);
}

export function getReporteTecnicos(idToken: string, query: ReporteVisitasQuery = {}) {
  return apiFetch<{ data: ReporteTecnico[] }>(`/api/reportes/tecnicos${reporteVisitasQueryString(query)}`, idToken).then(
    (r) => r.data,
  );
}

export function listSubtareaIncidencias(idToken: string, query: ListSubtareaIncidenciasQuery = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return apiFetch<Paginated<SubtareaIncidencia>>(`/api/subtareas/incidencias${qs ? `?${qs}` : ''}`, idToken);
}

// Sin start/end: solo tilda el check en Mongo (coordinación que ya
// reprogramó a mano en Odoo). Con start/end (+ technicianId opcional): el
// backend además reprograma la subtarea en Odoo antes de marcarla resuelta —
// ver ReprogramarIncidenciaPanel. `parentDateMoved` viene en `false` cuando el
// backend a propósito NO movió la fecha de la tarea padre del lote (hay otra
// unidad todavía activa en otra fecha) — el panel usa esto para avisarle a
// coordinación que puede hacer falta mover la tarea completa a mano en Odoo.
export function resolveSubtareaIncidencia(
  idToken: string,
  id: string,
  body: { start?: string; end?: string; technicianId?: number } = {},
) {
  return apiFetch<SubtareaIncidencia & { parentDateMoved?: boolean }>(`/api/subtareas/incidencias/${id}`, idToken, {
    method: 'PATCH',
    body: { estado: 'reprogramada', ...body },
  });
}

// Coordinación rechaza la propuesta de reprogramación del técnico: no toca Odoo, deja el motivo y la unidad queda
// para reprogramar a mano (pestaña Pendientes).
export function rechazarPropuestaIncidencia(idToken: string, id: string, motivoRechazo: string) {
  return apiFetch<SubtareaIncidencia>(`/api/subtareas/incidencias/${id}`, idToken, {
    method: 'PATCH',
    body: { estado: 'rechazada', motivoRechazo },
  });
}

export function listIncidenciaDestinatarios(idToken: string) {
  return apiFetch<{ data: IncidenciaDestinatario[] }>('/api/incidencia-destinatarios', idToken).then((r) => r.data);
}

export function createIncidenciaDestinatario(idToken: string, body: { odooUserId: number; nombre: string }) {
  return apiFetch<IncidenciaDestinatario>('/api/incidencia-destinatarios', idToken, { method: 'POST', body });
}

export function deleteIncidenciaDestinatario(idToken: string, id: string) {
  return apiFetch<void>(`/api/incidencia-destinatarios/${id}`, idToken, { method: 'DELETE' });
}

export function searchOdooUsers(idToken: string, q: string) {
  return apiFetch<{ data: OdooTechnician[] }>(
    `/api/incidencia-destinatarios/buscar-odoo?q=${encodeURIComponent(q)}`,
    idToken,
  ).then((r) => r.data);
}

export function getFlota(idToken: string) {
  return apiFetch<FlotaResponse>('/api/flota', idToken);
}

export function refrescarFlota(idToken: string) {
  return apiFetch<{ unidades: number; porCategoria: Record<string, number>; actualizadoAt: string }>(
    '/api/flota/refrescar',
    idToken,
    { method: 'POST' },
  );
}

export function buscarEquipos(idToken: string, q: string) {
  return apiFetch<{ data: EquipoCoincidencia[] }>(`/api/equipos/buscar?q=${encodeURIComponent(q)}`, idToken).then((r) => r.data);
}

// El QR de algunas etiquetas trae solo el IMEI: la API consulta la herramienta de stock para sacar el número de equipo.
export function getNumeroEquipoPorImei(idToken: string, imei: string) {
  return apiFetch<{ numEquipo: string | null }>(`/api/equipos/numero-por-imei?imei=${encodeURIComponent(imei)}`, idToken).then((r) => r.numEquipo);
}

export function getEstadoEquipo(idToken: string, equipoId: number, forzar = false) {
  return apiFetch<EstadoEquipo>(`/api/equipos/${equipoId}/estado${forzar ? '?forzar=1' : ''}`, idToken);
}

export function getGraficasEquipo(idToken: string, equipoId: number, desde: string, hasta: string = desde) {
  return apiFetch<GraficasEquipo>(`/api/equipos/${equipoId}/graficas?desde=${desde}&hasta=${hasta}`, idToken);
}
