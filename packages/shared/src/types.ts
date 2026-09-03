import { emptyChecklist, type Checklist } from './checklist.js';
import { emptyEquipo, type Equipo } from './equipo.js';

export type EstadoServicio = 'borrador_pre' | 'pendiente_post' | 'completo';

// Chosen by the técnico when creating the service — drives what "Datos del
// equipo" asks for in POST (see equipo.ts's modeloInstalado/imeiInstalado,
// only used when it's 'cambio_equipo').
export type TipoServicio = 'instalacion' | 'desinstalacion' | 'reparacion' | 'cambio_equipo';

export const TIPO_SERVICIO_LABELS: Record<TipoServicio, string> = {
  instalacion: 'Instalación',
  desinstalacion: 'Desinstalación',
  reparacion: 'Reparación',
  cambio_equipo: 'Cambio de equipo',
};

export interface Foto {
  id: string;
  // Which guided capture slot this belongs to (see photoSlots.ts).
  slotKey: string;
  // Local-only records hold a data URL; once synced this becomes the R2 public URL.
  dataUrl?: string;
  url?: string;
  key?: string;
}

// Only meaningful on post.firma — whether the client signed satisfied,
// signed unsatisfied, or refused to sign because they were unsatisfied.
export type SatisfaccionFirma = 'satisfecho' | 'insatisfecho' | 'no_firma_insatisfecho';

export const SATISFACCION_LABELS: Record<SatisfaccionFirma, string> = {
  satisfecho: 'Firma conforme',
  insatisfecho: 'Firma disconforme',
  no_firma_insatisfecho: 'No firma por disconformidad',
};

export interface Firma {
  dataUrl?: string;
  url?: string;
  key?: string;
  firmedAt?: string;
  locked?: boolean;
  satisfaccion?: SatisfaccionFirma | null;
  // Required whenever satisfaccion is 'insatisfecho' or 'no_firma_insatisfecho'
  // — why the client wasn't satisfied / refused to sign.
  motivo?: string;
  // Name of the person signing — required in PRE and POST unless the client refuses to sign.
  nombreFirmante?: string;
}

export interface Phase {
  checklist: Checklist;
  observaciones: string;
  fotos: Foto[];
  firma: Firma | null;
}

export function emptyPhase(): Phase {
  return { checklist: emptyChecklist(), observaciones: '', fotos: [], firma: null };
}

// What the técnico typed/picked to identify the Odoo helpdesk ticket for
// this client. `numero` is always present (even offline, unverified) so
// linking a ticket never depends on having signal at that moment.
export interface TicketOdooRef {
  numero: string;
  odooId?: number;
  clienteOdoo?: string;
  clienteEmailOdoo?: string;
  asunto?: string;
  etapa?: string;
  verified: boolean;
}

export type OdooSyncStatus = 'PENDING' | 'SYNCED' | 'FAILED';

// Written only by the backend (never sent by the client as part of a
// create/patch body) so the app can't declare a success that didn't happen.
export interface OdooSync {
  status: OdooSyncStatus;
  attempts: number;
  lastError?: string;
  syncedAt?: string;
}

export function emptyOdooSync(): OdooSync {
  return { status: 'PENDING', attempts: 0 };
}

export interface ConformidadRecord {
  id: string; // local id (clientId on the wire)
  remoteId?: string; // Mongo _id once synced
  codigoActa?: string;

  tipoServicio: TipoServicio | null;

  numero: string;
  cliente: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:mm
  matricula: string;
  instalador: string;
  responsableEmpresa: string;

  status: EstadoServicio;
  syncStatus: 'PENDING_SYNC' | 'SYNCED';

  // Local-only device tag (Firebase uid), never sent to the API — the server
  // already scopes everything by tecnicoId. This exists purely so a técnico's
  // still-unsynced record on a shared device doesn't show up (or become
  // editable) in another técnico's list after an account switch on that
  // same device — see mobile/app/index.tsx.
  localOwnerUid?: string;

  createdAt: string;
  updatedAt: string;

  pre: Phase;
  post: Phase;
  equipo: Equipo;

  ticketOdoo: TicketOdooRef | null;
  odooSync: OdooSync;
  // The generated PDF hoja de conformidad, once uploaded to R2 — ready to
  // attach to the Odoo ticket.
  pdfReporte: { url: string; key: string } | null;
}

export function newRecord(id: string, now: Date): ConformidadRecord {
  // fecha/hora are the técnico's local wall-clock date/time — derived from
  // Date's local getters, NOT now.toISOString(), which is UTC and would run
  // 3h ahead of real time for a técnico in Argentina (UTC-3).
  const pad = (n: number) => String(n).padStart(2, '0');
  const fecha = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const hora = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const iso = now.toISOString();
  return {
    id,
    tipoServicio: null,
    numero: '',
    cliente: '',
    fecha,
    hora,
    matricula: '',
    instalador: '',
    responsableEmpresa: '',
    status: 'borrador_pre',
    syncStatus: 'PENDING_SYNC',
    createdAt: iso,
    updatedAt: iso,
    pre: emptyPhase(),
    post: emptyPhase(),
    equipo: emptyEquipo(),
    ticketOdoo: null,
    odooSync: emptyOdooSync(),
    pdfReporte: null,
  };
}
