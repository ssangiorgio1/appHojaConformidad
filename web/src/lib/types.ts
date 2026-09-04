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
}
