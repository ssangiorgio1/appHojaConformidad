import type { Checklist, Equipo, SatisfaccionFirma, TipoServicio, MotivoIntervencion, CambioEquipoRazon } from '@wara/shared';

// Mirrors api/src/models/Usuario.ts
export type UsuarioRole = 'tecnico' | 'admin' | 'superadmin' | 'coordinacion' | 'mesa_ayuda';

// Viaje abierto (en camino / en sitio) que nadie cerró — ver api/src/controllers/visitasAbiertas.controller.ts.
export interface VisitaAbierta {
  _id: string;
  tareaOdooId: number;
  fecha: string;
  estado: 'en_camino' | 'en_sitio';
  // El técnico la suspendió para atender otra tarea cercana (caso excepcional).
  suspendida?: boolean;
  motivoSuspension?: string;
  tecnico: { nombre: string; email: string } | null;
  cliente: string;
  enCaminoAt: string | null;
  enSitioAt: string | null;
  horasAbierta: number;
  hojasCompletas: number;
  otroTecnicoTermino: boolean;
  sospechosa: boolean;
}

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
  // Ausentes cuando `motivo` está seteado (el técnico no pudo sacar esta
  // foto — ver GalleryPhotoCapture en la PWA): no hay nada subido a R2.
  url?: string;
  key?: string;
  motivo?: string;
  // Qué encontró el técnico en la foto extra del PRE — solo panel, no va al PDF.
  descripcion?: string;
  // Ausente = 'image/jpeg' (fotos existentes). 'video/webm' es un video
  // corto de verificación (Pantalla N° de serie / Cámaras ADAS, ver
  // GalleryPhotoCapture `allowVideo` en la PWA) — hay que renderizarlo como
  // <video>, no <img>.
  mimeType?: 'image/jpeg' | 'image/png' | 'video/webm';
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
  fallaDetalle?: string;
  item6AirbagDetalle?: string;
  item6GuineDetalle?: string;
  item6AlternadorDetalle?: string;
  item6PresionDetalle?: string;
  item6TempDetalle?: string;
  item1Detalle?: string;
  item2Detalle?: string;
  item3Detalle?: string;
  item4Detalle?: string;
  item5Detalle?: string;
  item7Detalle?: string;
  item8Detalle?: string;
  observaciones: string;
  // Solo para el panel: nunca se imprime en el PDF que ve el cliente.
  observacionesInternas?: string;
  fotos: Foto[];
  firma: Firma | null;
}

export type EstadoVerificacionEquipo = 'verificado' | 'con_problemas' | 'sin_verificar';

export interface VerificacionEquipo {
  estado: EstadoVerificacionEquipo;
  problemas: string[];
  avanzoBajoResponsabilidad: boolean;
  intentos?: number | null;
  at: string | null;
}

export interface ConformidadDoc {
  // Posible duplicado de otra hoja de la misma unidad y día; 'pendiente' frena el envío a Odoo hasta que se libere.
  duplicado?: { de: string; estado: 'pendiente' | 'liberada'; detectadoAt: string; revisadoAt: string | null } | null;
  _id: string;
  clientId: string;
  codigoActa: string;
  tipoServicio: TipoServicio | null;
  motivoIntervencion?: MotivoIntervencion | null;
  motivoIntervencionDetalle?: string;
  cambioEquipoRazon?: CambioEquipoRazon | null;
  cambioEquipoRazonDetalle?: string;
  // Intervención que requiere otro técnico; procesadaAt/subtareaNuevaOdooId/error los completa la API al crear la subtarea en Odoo.
  derivacion?: { requerida: boolean; motivo: string; procesadaAt?: string | null; subtareaNuevaOdooId?: number | null; error?: string } | null;
  numero: string;
  cliente: string;
  fecha: string;
  hora: string;
  fechaHora?: string;
  matricula: string;
  // Ausente = 'vehiculo'. 'otro_equipo': surtidor, generador, etc. (sin patente ni tablero).
  tipoUnidad?: 'vehiculo' | 'otro_equipo';
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
  // Verificación del equipo en el paso de control de la PWA. `avanzoBajoResponsabilidad`: el técnico avanzó igual
  // con el equipo sin confirmar. null/ausente = hoja anterior a este dato.
  verificacionEquipo?: VerificacionEquipo | null;
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
  // Identifica sin ambigüedad ESTA franja puntual (`${id}:${start}:${end}`)
  // — el mismo `id` de Odoo puede aparecer en más de una CalendarTask a la
  // vez (una por cada fecha real distinta entre las subtareas del lote, ver
  // calendarTask.service.ts en el API). Usarlo como key de React y como
  // identidad de estado (drag, pendingMoves), nunca `id` solo.
  occurrenceKey: string;
  // true cuando esta franja no es la fecha propia de la tarea padre en Odoo
  // — nació de que 1+ subtareas se reprogramaron a otra fecha. De solo
  // lectura en el calendario del panel (ver CalendarGrid.tsx): para
  // reprogramarla más se usa Incidencias → Reprogramar.
  isSplitOccurrence: boolean;
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
  verificacionEquipo?: EstadoVerificacionEquipo | 'bajo_responsabilidad';
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
export type EstadoSubtareaIncidencia = 'pendiente_reprogramar' | 'propuesta_pendiente' | 'rechazada' | 'reprogramada';

export interface ListSubtareaIncidenciasQuery {
  // Uno o varios estados separados por coma.
  estado?: string;
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
  // 'pre_cancelado': el técnico empezó el PRE y no pudo seguir; puede traer una propuesta de nueva fecha y hora.
  tipo?: 'no_encontrada' | 'pre_cancelado' | 'requiere_otro_tecnico' | 'reprogramado_cliente';
  // 'reprogramado_cliente': el cliente pidió reprogramar en el lugar; la fecha elegida va en propuestaInicio/Fin.
  firmaCliente?: { url: string; nombre: string; dni: string; sinFirma: boolean; motivoSinFirma: string };
  propuestaInicio?: string | null;
  propuestaFin?: string | null;
  motivoRechazo?: string;
  clienteNombre?: string;
  ticketOdooId?: number | null;
  // Si el PDF de reprogramación no pudo adjuntarse al ticket de Odoo (la reprogramación igual quedó hecha).
  pdfReprogramacionAt?: string | null;
  pdfReprogramacionError?: string;
  resueltaPor: string | null;
  resueltaAt: string | null;
  // Nueva fecha y hora de la visita reprogramada; null en las anteriores a este dato.
  reprogramadaPara?: string | null;
  createdAt: string;
  updatedAt: string;
  // Armados server-side (ver getSubtareaIncidencias) — llevan directo a la
  // subtarea (la unidad puntual a reprogramar) o a la tarea/lote padre en Odoo.
  subtareaOdooUrl: string;
  tareaOdooUrl: string;
}

// Quién recibe el mail.activity de "reprogramar" en Odoo cuando se reporta
// una SubtareaIncidencia (ver IncidenciaDestinatario.ts en el API) —
// configurable desde el panel, independiente de tener cuenta en la app.
export interface IncidenciaDestinatario {
  _id: string;
  odooUserId: number;
  nombre: string;
  createdAt: string;
}

// Flota de VisionBLO (movil/mapa + estado de abono del cliente) — ver flota.service.ts en el
// API. `ultimoReporte` en segundos unix (null = nunca reportó).
export type FlotaCategoria =
  | 'baja_con_corte'
  | 'baja'
  | 'corte_reportando'
  | 'corte_sin_reportar'
  | 'sin_reportar_24h'
  | 'sin_reportar_48h'
  | 'sin_reportar_72h'
  | 'activo_reportando';

export interface FlotaUnidad {
  movilId: number;
  equipoId: number | null;
  nombre: string;
  matricula: string | null;
  interno: string | null;
  clienteId: number;
  clienteNombre: string | null;
  latitud: number;
  longitud: number;
  ultimoReporte: number | null;
  categoria: FlotaCategoria;
  tramoReporte: 'ok' | 'mas_1_dia' | 'mas_1_semana' | 'nunca';
}

export interface FlotaResponse {
  actualizadoAt: string | null;
  unidades: FlotaUnidad[];
}

// Estado en vivo de un equipo (bo3: diagnóstico + módulos + historial) — ver
// equipoEstado.service.ts en el API. Para técnicos el API recorta `posicion` y `movil.cliente`.
export interface ModuloDetectado {
  serie: string;
  descripcion: string;
  advertencia: string | null;
}

export interface EventoEquipo {
  fecha: string;
  evento: string;
  datos: Record<string, unknown>;
}

export interface EstadoEquipo {
  consultadoAt: string;
  equipoId: number;
  nombre?: string | null;
  serie: string | null;
  imei: string | null;
  iccid: string | null;
  simTelefono: string | null;
  simOperador: string | null;
  ultimoReporte: string | null;
  posicion: { latitud: number; longitud: number; fecha: string | null } | null;
  ignicion: { encendida: boolean; fecha: string | null } | null;
  voltajeCargador: number | null;
  bateriaInterna: number | null;
  senalDbm: number | null;
  // Última posición con satélites y HDOP (precisión: más bajo es mejor); null si no hay posición.
  gps?: { satelites: number | null; hdop: number | null; fecha: string } | null;
  posicionFecha?: string | null;
  firmware: { version: string | null; fecha: string | null; actualizacionDisponible: boolean; detalleActualizacion: string | null };
  senalesVistas: { pantalla: boolean; rfid: boolean; fuel: boolean; sim: boolean; corteMotor: boolean; panico: string | null };
  movil: { cliente: string; movil: string; matricula: string | null; baja: boolean; bajaCliente: boolean; corteDeServicio: boolean } | null;
  modulos: { fecha: string | null; detectados: ModuloDetectado[] };
  eventosRecientes: EventoEquipo[];
}

export interface EquipoCoincidencia {
  equipoId: number;
  descripcion: string;
}

// Gráficas de estado de un equipo en un día (bo3 equipo/graficas, consulta en vivo, no se guarda).
export type PuntoGrafica = [number, number | null];

export interface GraficasEquipo {
  equipoId: number;
  fecha: string;
  desde: string;
  hasta: string;
  consultadoAt: string;
  series: {
    bateriaInterna: PuntoGrafica[];
    cargador: PuntoGrafica[];
    senalDbm: PuntoGrafica[];
    velocidad: PuntoGrafica[];
    satelites: PuntoGrafica[];
    hdop: PuntoGrafica[];
    ignicion: PuntoGrafica[];
    presenciaCargador: PuntoGrafica[];
    combustible1: PuntoGrafica[];
    combustible2: PuntoGrafica[];
    combustible3: PuntoGrafica[];
  };
}
