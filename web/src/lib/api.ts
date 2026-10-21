import type { RutaAcceso, TerritorioTecnico } from "./rutasAcceso";
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
  VisitaAbierta,
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

// Coordinación/admin confirman que la hoja marcada como posible duplicado no lo es: sigue su curso y se envía a Odoo.
export function liberarDuplicadoConformidad(idToken: string, id: string) {
  return apiFetch<ConformidadDoc>(`/api/conformidades/${id}/duplicado/liberar`, idToken, { method: 'POST' });
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

export function listVisitasAbiertas(idToken: string) {
  return apiFetch<{ data: VisitaAbierta[] }>('/api/visitas-abiertas', idToken);
}

// Cierra el viaje sin avisar al cliente ni tocar Odoo (ver visitasAbiertas.controller.ts en la API).
export function cerrarVisitaAbierta(idToken: string, id: string) {
  return apiFetch<{ ok: true }>(`/api/visitas-abiertas/${id}/cerrar`, idToken, { method: 'POST' });
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

// Rutas de acceso rápido y territorios por técnico (planificación de visitas), guardados en el sistema.
export type RutaAccesoInput = Pick<RutaAcceso, 'nombre' | 'color' | 'anchoKm' | 'puntos' | 'activa'>;
// Trazo por las calles que pasa por los puntos marcados, sin guardar nada (vista previa al marcar).
export function previsualizarRutaAcceso(idToken: string, puntos: Array<[number, number]>) {
  return apiFetch<{ trazo: Array<[number, number]>; km: number; porCalle: boolean }>('/api/planificacion/rutas/previsualizar', idToken, { method: 'POST', body: { puntos } });
}
export interface TerritorioInput {
  tecnicoNombre: string;
  rutas: string[];
  departamentos: string[];
  distritos: string[];
}
export function listRutasAcceso(idToken: string) {
  return apiFetch<{ data: RutaAcceso[] }>('/api/planificacion/rutas', idToken).then((r) => r.data);
}
export function createRutaAcceso(idToken: string, body: RutaAccesoInput) {
  return apiFetch<RutaAcceso>('/api/planificacion/rutas', idToken, { method: 'POST', body });
}
export function updateRutaAcceso(idToken: string, id: string, body: RutaAccesoInput) {
  return apiFetch<RutaAcceso>(`/api/planificacion/rutas/${id}`, idToken, { method: 'PUT', body });
}
export function deleteRutaAcceso(idToken: string, id: string) {
  return apiFetch<void>(`/api/planificacion/rutas/${id}`, idToken, { method: 'DELETE' });
}
export function listTerritorios(idToken: string) {
  return apiFetch<{ data: TerritorioTecnico[] }>('/api/planificacion/territorios', idToken).then((r) => r.data);
}
export function saveTerritorio(idToken: string, tecnicoId: string, body: TerritorioInput) {
  return apiFetch<TerritorioTecnico | void>(`/api/planificacion/territorios/${tecnicoId}`, idToken, { method: 'PUT', body });
}

// Rutas por calle (servidor OSRM configurado en la API con ROUTING_URL). Sin él `disponible` es false.
export interface ParadaRecorrido {
  id: string | number;
  posicion: number;
  kmDesdeAnterior: number;
  minDesdeAnterior: number;
  kmAcumulado: number;
}
export interface Recorrido {
  paradas: ParadaRecorrido[];
  totalKm: number;
  totalMin: number;
  vuelta: { km: number; min: number } | null;
  /** Traza por las calles, como [longitud, latitud]. */
  geometria: Array<[number, number]>;
}
/** Tramo que hacen juntos todos los técnicos, de la oficina al punto donde se separan. */
export interface TramoCompartido {
  km: number;
  min: number;
  geometria: Array<[number, number]>;
}
export interface RecorridoTecnico extends Recorrido {
  /** Posición del técnico en la lista pedida (0 = el primero). */
  tecnico: number;
}
export function getRuteoEstado(idToken: string) {
  return apiFetch<{ disponible: boolean }>('/api/ruteo/estado', idToken).then((r) => r.disponible);
}
export function ordenarVisitasPorCalle(
  idToken: string,
  origen: { latitud: number; longitud: number },
  puntos: { id: string | number; latitud: number; longitud: number }[],
  volver: boolean,
) {
  return apiFetch<Recorrido>('/api/ruteo/visitas', idToken, { method: 'POST', body: { origen, puntos, volver } });
}

// Reparte los puntos entre `cantidad` técnicos (por zonas alrededor del origen) y arma el recorrido de cada uno.
// cercania = de la unidad más cercana a la siguiente más cercana; optimo = el recorrido más corto en total.
export type CriterioOrden = 'cercania' | 'optimo';

export function ordenarVisitasVariosTecnicos(
  idToken: string,
  origen: { latitud: number; longitud: number },
  // `tecnicos`: posiciones (0 = el primero) de los técnicos a los que ya les corresponde por su territorio (con varios, la zona se comparte).
  puntos: { id: string | number; latitud: number; longitud: number; tecnicos?: number[] }[],
  cantidad: number,
  volver: boolean,
  criterio: CriterioOrden = 'cercania',
  // `primeroId`: la primera visita; `desdeOficina` false = el recorrido empieza en ella, sin el viaje desde la oficina.
  opciones: {
    primeroId?: string | number;
    desdeOficina?: boolean;
    // `vias`: por técnico, puntos [longitud, latitud] de una ruta de acceso por donde pasa (la API los corta hasta donde le sirven).
    vias?: Array<Array<[number, number]>>;
    // `juntosHasta`: los técnicos van juntos hasta ese punto y ahí se separan.
    juntosHasta?: { latitud: number; longitud: number };
  } = {},
) {
  return apiFetch<{ recorridos: RecorridoTecnico[]; compartido: TramoCompartido | null }>('/api/ruteo/visitas-varios-tecnicos', idToken, {
    method: 'POST',
    body: { origen, puntos, cantidad, volver, criterio, ...opciones },
  });
}

// Número de equipo (serie del diagnóstico) de varios equipos; null si bo3 no lo devolvió.
export interface SerieEquipo {
  serie: string | null;
  nombre: string | null;
}
export function getSeriesEquipos(idToken: string, equipoIds: number[]) {
  return apiFetch<{ series: Record<string, SerieEquipo | null> }>('/api/equipos/series', idToken, { method: 'POST', body: { equipoIds } }).then((r) => r.series);
}

export function getEstadoEquipo(idToken: string, equipoId: number, forzar = false) {
  return apiFetch<EstadoEquipo>(`/api/equipos/${equipoId}/estado${forzar ? '?forzar=1' : ''}`, idToken);
}

export function getGraficasEquipo(idToken: string, equipoId: number, desde: string, hasta: string = desde) {
  return apiFetch<GraficasEquipo>(`/api/equipos/${equipoId}/graficas?desde=${desde}&hasta=${hasta}`, idToken);
}

// ---- Firma de hojas de ruta del depósito desde el celular del técnico ----
export type PedidoFirmaInput = {
  transferenciaId: string;
  tecnicoNombre: string;
  sentido: 'a_tecnico' | 'a_deposito';
  lineas: { nombre: string; cantidad: number; series?: string[] }[];
};

export type PedidoFirmaPublico = {
  transferenciaId: string;
  tecnicoNombre: string;
  sentido: 'a_tecnico' | 'a_deposito';
  lineas: { nombre: string; cantidad: number; series: string[] }[];
  firmada: boolean;
};

export function crearPedidoFirma(idToken: string, body: PedidoFirmaInput) {
  return apiFetch<{ token: string; expiresAt: string }>('/api/firmas-transferencia', idToken, { method: 'POST', body });
}

export function getEstadoPedidoFirma(idToken: string, token: string) {
  return apiFetch<{ firmada: boolean; firma: string | null; firmedAt: string | null }>(`/api/firmas-transferencia/${encodeURIComponent(token)}`, idToken);
}

// Sin sesión: la página del celular solo tiene el token del link.
// En el celular "localhost" es el propio celular: si la API está configurada como localhost y el panel se abrió por la
// IP de la PC (red local), se usa esa misma IP para hablarle a la API.
function apiUrlParaCelular() {
  if (typeof window === 'undefined') return API_URL;
  const u = new URL(API_URL);
  const local = ['localhost', '127.0.0.1'].includes(u.hostname);
  if (local && !['localhost', '127.0.0.1'].includes(window.location.hostname)) u.hostname = window.location.hostname;
  return u.origin;
}

async function publicFetch<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`${apiUrlParaCelular()}${path}`, {
    method: init?.method ?? 'GET',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export function getPedidoFirmaPublico(token: string) {
  return publicFetch<PedidoFirmaPublico>(`/api/publico/firma-transferencia/${encodeURIComponent(token)}`);
}

export function firmarPedidoPublico(token: string, firma: string) {
  return publicFetch<{ ok: true }>(`/api/publico/firma-transferencia/${encodeURIComponent(token)}`, { method: 'POST', body: { firma } });
}
