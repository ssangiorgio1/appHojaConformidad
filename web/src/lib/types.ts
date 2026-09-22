import type { Checklist, Equipo, SatisfaccionFirma, TipoServicio } from '@wara/shared';

// Mirrors api/src/models/Usuario.ts
export type UsuarioRole = 'tecnico' | 'admin' | 'superadmin' | 'coordinacion' | 'mesa_ayuda';

export interface Usuario {
  _id: string;
  firebaseUid?: string;
  email: string;
  nombre: string;
  role: UsuarioRole;
  legajo: string;
  activo: boolean;
  // Mirrors api/src/models/Usuario.ts's odooUserId — el res.users de Odoo
  // que representa a este técnico en el calendario de Field Service.
  odooUserId: number | null;
  // True for the one superadmin account whose role/activo the API refuses to
  // change — see api/src/services/usuario.service.ts.
  protegido: boolean;
  createdAt: string;
  updatedAt: string;
}

// Mirrors api/src/models/Conformidad.ts — this is the server/Mongo document
// shape, distinct from @wara/shared's ConformidadRecord (the mobile app's
// local offline-first record, which carries mobile-only fields like
// syncStatus and dataUrl-based photos/signatures).
export type EstadoConformidad = 'borrador_pre' | 'pendiente_post' | 'completo';

export interface Foto {
  id: string;
  // Ausente en fotos sincronizadas antes de que el servidor empezara a
  // persistir este campo.
  slotKey?: string;
  url: string;
  key: string;
}

export interface Firma {
  url?: string;
  key?: string;
  firmedAt?: string;
  satisfaccion?: SatisfaccionFirma | null;
  motivo?: string;
  clienteAusente?: boolean;
}

export interface AltaCheck {
  checked: boolean;
  usuarioId: string | null;
  fecha: string | null;
}

export interface AltaEquipo {
  mesaAyuda: AltaCheck;
  coordinacion: AltaCheck;
}

export interface TicketOdoo {
  numero: string;
  odooId: number | null;
  clienteOdoo: string;
  verified: boolean;
}

// Solo se completa cuando tipoServicio es 'cambio_equipo' Y la hoja usa el
// esquema nuevo de 2 hojas vinculadas (retiro + instalación) — las hojas
// cambio_equipo históricas (1 sola hoja) no tienen esto seteado.
export interface CambioEquipo {
  rol: 'retiro' | 'instalacion';
  parejaId: string | null;
}

// Resultado acotado de GET /conformidades/cambio-equipo/retiros-pendientes —
// ver api/src/controllers/conformidades.controller.ts's getRetirosPendientes.
export interface RetiroPendiente {
  _id: string;
  numero: string;
  codigoActa: string;
  cliente: string;
  matricula: string;
  fecha: string;
}

export interface Phase {
  checklist: Checklist;
  observaciones: string;
  fotos: Foto[];
  firma: Firma | null;
}

export interface ConformidadDoc {
  _id: string;
  clientId: string;
  codigoActa: string;
  tipoServicio: TipoServicio | null;
  numero: string;
  cliente: string;
  fecha: string;
  hora: string;
  fechaHora?: string;
  matricula: string;
  instalador: string;
  tecnicoId?: string;
  responsableEmpresa: string;
  status: EstadoConformidad;
  origen: string;
  pre: Phase;
  post: Phase;
  equipo: Equipo;
  altaEquipo: AltaEquipo;
  ticketOdoo: TicketOdoo | null;
  cambioEquipo: CambioEquipo | null;
  // Set once the app has generated and uploaded the PDF report (see
  // mobile/src/sync/sync.ts) — null until then, e.g. for borrador_pre records.
  pdfReporte: { url: string; key: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUsuarioInput {
  email: string;
  nombre: string;
  legajo?: string;
  role: UsuarioRole;
  activo: boolean;
}

export interface CreateUsuarioResponse {
  usuario: Usuario;
  tempPassword?: string;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// Mirrors api/src/services/calendarTask.service.ts
export interface CalendarSubtask {
  id: number;
  name: string;
  stage: string | null;
  technicianName: string | null;
  isClosed: boolean;
  description: string | null;
  odooUrl: string;
}

export interface CalendarTask {
  id: number;
  title: string;
  start: string;
  end: string | null;
  technicianId: number | null;
  technicianName: string | null;
  partnerName: string | null;
  stage: string | null;
  description: string | null;
  odooUrl: string;
  subtaskCount: number;
  subtasks: CalendarSubtask[];
  // El helpdesk.ticket del que nace esta tarea de FSM, cuando existe (ver
  // calendarTask.service.ts) — no todas las tareas vienen de un ticket.
  ticketOdoo: { id: number; label: string } | null;
}

export interface OdooTechnician {
  id: number;
  name: string;
}

export interface ListCalendarTasksQuery {
  from: string;
  to: string;
  technicianIds?: number[];
}

// Mirrors api/src/schemas/conformidad.schema.ts's listConformidadesQuerySchema
export interface ListConformidadesQuery {
  page?: number;
  pageSize?: number;
  status?: EstadoConformidad;
  tecnicoId?: string;
  matricula?: string;
  imei?: string;
  numero?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  search?: string;
  altaMesaAyuda?: 'pendiente' | 'hecho';
  altaCoordinacion?: 'pendiente' | 'hecho';
  cambioEquipoPendiente?: boolean;
}

// Mirrors api/src/schemas/reporte.schema.ts
export interface ReporteVisitasQuery {
  tecnicoId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  // Solo lo usa /reportes/visitas — /reportes/tecnicos los ignora (ver
  // api/src/schemas/reporte.schema.ts).
  page?: number;
  pageSize?: number;
}

// Mirrors api/src/services/reportes.service.ts — un renglón por VIAJE
// (VisitaNotificacion), no por Conformidad: una tarea de lote genera varias
// Conformidades para el mismo viaje, así que agrupar por Conformidad inflaba
// "visitas" y duplicaba Salió/Llegó/Terminó. Cliente/tarea siguen viniendo
// de una Conformidad (de exhibición nomás) porque VisitaNotificacion no los
// tiene.
export interface ReporteVisita {
  visitaId: string;
  tareaOdooId: number;
  tareaNombre: string | null;
  cliente: string | null;
  tecnico: string | null;
  estado: 'pendiente' | 'en_camino' | 'en_sitio' | 'completo' | null;
  // false = el técnico cortó este viaje (canceló el borrador antes de
  // terminar, o nunca volvió) sin llegar a 'completo' — sigue siendo un
  // viaje real, no se borra, pero conviene distinguirlo de uno en curso.
  abierta: boolean;
  fecha: string | null;
  hora: string | null;
  enCaminoAt: string | null;
  enSitioAt: string | null;
  completoAt: string | null;
  minutosTraslado: number | null;
  // Tiempo TOTAL en el lugar (llegada → cierre) — incluye instalar todas las
  // unidades del lote más cualquier otro tiempo ahí que no es instalación
  // pura. Ver minutosInstalandoTotal para esa parte sola.
  minutosEnSitio: number | null;
  // Suma estimada de cuánto se tardó instalando cada unidad del lote (ver
  // `unidades` y api/src/services/reportes.service.ts's minutosInstalandoUnidad).
  minutosInstalandoTotal: number | null;
  unidades: ReporteVisitaUnidad[];
}

export interface ReporteVisitaUnidad {
  subtareaOdooId: number | null;
  subtareaNombre: string | null;
  minutosInstalando: number | null;
}

// Mirrors api/src/services/reportes.service.ts getReporteTecnicos — un
// renglón por técnico (no por visita) con sus promedios de tiempo de campo
// y la carga de tareas/subtareas asignada en Odoo Field Service.
export interface ReporteTecnico {
  tecnicoId: string;
  tecnico: string;
  vinculadoOdoo: boolean;
  visitas: number;
  minutosTrasladoProm: number | null;
  minutosEnSitioProm: number | null;
  minutosInstalandoProm: number | null;
  tareasTotal: number;
  tareasCompletadas: number;
  tareasPendientes: number;
  subtareasTotal: number;
  subtareasCompletadas: number;
  subtareasPendientes: number;
}

// Mirrors api/src/models/SubtareaIncidencia.ts — una unidad de un lote que el
// técnico no encontró en el lugar (no genera Conformidad, ver
// ALCANCE_BACKOFFICE.md §14). Coordinación la ve acá para reprogramarla en
// Odoo y marcarla resuelta.
export type EstadoSubtareaIncidencia = 'pendiente_reprogramar' | 'reprogramada';

export interface ListSubtareaIncidenciasQuery {
  estado?: EstadoSubtareaIncidencia;
  page?: number;
  pageSize?: number;
}

export interface SubtareaIncidencia {
  _id: string;
  tareaOdooId: number;
  subtareaOdooId: number;
  subtareaNombre: string;
  // Populado server-side (nombre/email) — ver getSubtareaIncidencias.
  tecnicoId: { _id: string; nombre: string; email: string } | null;
  fecha: string;
  motivo: string;
  estado: EstadoSubtareaIncidencia;
  resueltaPor: string | null;
  resueltaAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Armados server-side (ver getSubtareaIncidencias) — llevan directo a la
  // subtarea (la unidad puntual a reprogramar) o a la tarea/lote padre en Odoo.
  subtareaOdooUrl: string;
  tareaOdooUrl: string;
}
