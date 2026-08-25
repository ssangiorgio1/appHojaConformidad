import { emptyChecklist, type Checklist } from './checklist.js';
import { emptyEquipo, type Equipo } from './equipo.js';

export type EstadoServicio = 'borrador_pre' | 'pendiente_post' | 'completo';

export interface Foto {
  id: string;
  // Local-only records hold a data URL/URI; once synced this becomes the R2 public URL.
  dataUrl?: string;
  url?: string;
  key?: string;
}

export interface Firma {
  dataUrl?: string;
  url?: string;
  key?: string;
  firmedAt?: string;
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

export interface ConformidadRecord {
  id: string; // local id (clientId on the wire)
  remoteId?: string; // Mongo _id once synced
  codigoActa?: string;

  numero: string;
  cliente: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:mm
  matricula: string;
  instalador: string;
  responsableEmpresa: string;

  status: EstadoServicio;
  syncStatus: 'PENDING_SYNC' | 'SYNCED';

  createdAt: string;
  updatedAt: string;

  pre: Phase;
  post: Phase;
  equipo: Equipo;
}

export function newRecord(id: string, now: string): ConformidadRecord {
  const [fecha, hora] = [now.slice(0, 10), now.slice(11, 16)];
  return {
    id,
    numero: '',
    cliente: '',
    fecha,
    hora,
    matricula: '',
    instalador: '',
    responsableEmpresa: '',
    status: 'borrador_pre',
    syncStatus: 'PENDING_SYNC',
    createdAt: now,
    updatedAt: now,
    pre: emptyPhase(),
    post: emptyPhase(),
    equipo: emptyEquipo(),
  };
}
