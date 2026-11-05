import { emptyChecklist, type Checklist, type ChecklistKey } from './checklist.js';
import { emptyEquipo, type Equipo } from './equipo.js';

export type EstadoServicio = 'borrador_pre' | 'pendiente_post' | 'completo';

// Chosen by the técnico when creating the service — drives what "Datos del
// equipo" asks for in POST (see equipo.ts's modeloInstalado/imeiInstalado,
// only used when it's 'cambio_equipo').
// Qué se interviene: un vehículo (patente, fotos de matrícula, laterales, torpedo y odómetro) u otro equipo sin
// patente ni tablero (surtidor, generador, etc.): ahí `matricula` guarda el nombre o código del equipo.
export type TipoUnidad = 'vehiculo' | 'otro_equipo';

export type TipoServicio = 'instalacion' | 'desinstalacion' | 'reparacion' | 'cambio_equipo' | 'cambio_unidad';

export const TIPO_SERVICIO_LABELS: Record<TipoServicio, string> = {
  instalacion: 'Instalación',
  desinstalacion: 'Desinstalación',
  reparacion: 'Intervención',
  cambio_equipo: 'Cambio de equipo',
  cambio_unidad: 'Cambio de unidad',
};

// Qué encontró/resolvió el técnico al revisar el equipo — solo aplica cuando
// tipoServicio es 'reparacion'. Si es 'cambio_equipo' la reparación terminó en
// reemplazar el equipo: modelo/imei describen el que sale y
// modeloInstalado/imeiInstalado el que entra (ver isEquipoSwap).
export type MotivoIntervencion = 'cambio_equipo' | 'reinicio_manual' | 'revisar_ramales' | 'otro';

export const MOTIVO_INTERVENCION_LABELS: Record<MotivoIntervencion, string> = {
  cambio_equipo: 'Cambio de equipo',
  reinicio_manual: 'Reinicio manual del equipo',
  revisar_ramales: 'Revisar ramales, módulos, etc',
  otro: 'Otro',
};

// Por qué se cambia el equipo — solo aplica cuando motivoIntervencion es 'cambio_equipo'.
export type CambioEquipoRazon = 'pantalla_danada' | 'otro';

export const CAMBIO_EQUIPO_RAZON_LABELS: Record<CambioEquipoRazon, string> = {
  pantalla_danada: 'Pantalla dañada (táctil / trizada)',
  otro: 'Otro',
};

// Cambio de equipo "de hecho": ya sea porque tipoServicio es 'cambio_equipo'
// desde el alta, o porque una reparación derivó en reemplazar el equipo.
export function isEquipoSwap(
  tipoServicio: TipoServicio | null | undefined,
  motivoIntervencion?: MotivoIntervencion | null,
): boolean {
  return tipoServicio === 'cambio_equipo' || (tipoServicio === 'reparacion' && motivoIntervencion === 'cambio_equipo');
}

export interface Foto {
  id: string;
  // Which guided capture slot this belongs to (see photoSlots.ts).
  slotKey: string;
  // Local-only records hold a data URL; once synced this becomes the R2 public URL.
  dataUrl?: string;
  url?: string;
  key?: string;
  // "Couldn't take this photo, why" (see GalleryPhotoCapture in the PWA) —
  // técnico forgot to bring the sensor/módulo, an extreme case that
  // shouldn't block finishing the service. Only set when there's no
  // dataUrl/url; counts the same as a real photo for that item's
  // "required" check.
  motivo?: string;
  // Qué encontró el técnico en esta foto (slot 'extra' del PRE). Solo para el
  // panel: buildPrintHtml NO lo imprime, el PDF que ve el cliente no lo lleva.
  descripcion?: string;
  // Absent = 'image/jpeg' (compat with existing photos, always JPEG until
  // now). 'video/webm' is a short clip recorded with MediaRecorder (see
  // GalleryPhotoCapture `allowVideo`, "Pantalla N° de serie"/"Cámaras ADAS")
  // — needs to be explicit because once a photo is synced only url/key
  // remain, no `data:` prefix left to infer the type from.
  mimeType?: 'image/jpeg' | 'image/png' | 'video/webm';
}

// Only meaningful on post.firma — whether the client signed satisfied,
// signed unsatisfied, or refused to sign because they were unsatisfied.
export type SatisfaccionFirma = 'satisfecho' | 'insatisfecho' | 'no_firma_insatisfecho';

export const SATISFACCION_LABELS: Record<SatisfaccionFirma, string> = {
  satisfecho: 'Firma conforme',
  insatisfecho: 'Firma disconforme',
  no_firma_insatisfecho: 'No firma por disconformidad',
};

// Default options offered when marking "Cliente ausente" (see
// ClienteAusentePicker in the PWA) — the técnico picks one instead of always
// having to type the reason by hand; "Otro" reveals a free-text field. These
// are stored in the same Firma.motivo field, not a dedicated enum: the final
// text stays free-form so "Otro" can describe any case not listed here.
export const MOTIVO_CLIENTE_AUSENTE_OPTIONS = [
  'No estaba en el domicilio/lugar',
  'Se retiró antes de firmar',
  'Otro',
] as const;

export interface Firma {
  dataUrl?: string;
  url?: string;
  key?: string;
  firmedAt?: string;
  locked?: boolean;
  satisfaccion?: SatisfaccionFirma | null;
  // Required whenever satisfaccion is 'insatisfecho' or 'no_firma_insatisfecho'
  // (why the client wasn't satisfied / refused to sign), or when
  // clienteAusente is true (why the client couldn't be found) — same field
  // covers both cases.
  motivo?: string;
  // Name of the person signing — required in PRE and POST unless the client refuses to sign.
  nombreFirmante?: string;
  dniFirmante?: string;
  cargoFirmante?: string;
  // The client wasn't available to sign — advanced under the technician's
  // responsibility, without a signature or nombreFirmante.
  clienteAusente?: boolean;
}

export interface Phase {
  checklist: Checklist;
  // Detalle interno (solo panel, no va a la conformidad impresa) cuando items 1-5 responden NO.
  item1Detalle?: string;
  item2Detalle?: string;
  item3Detalle?: string;
  item4Detalle?: string;
  item5Detalle?: string;
  fallaDetalle?: string;
  // Same idea as fallaDetalle (item6_falla): required detail when the
  // matching item answers whatever requiresDetailWhen says (see
  // checklist.ts) — item6_airbag/guine/alternador/presion/temp/item7/item8
  // trigger it on 'NO'.
  item6AirbagDetalle?: string;
  item6GuineDetalle?: string;
  item6AlternadorDetalle?: string;
  item6PresionDetalle?: string;
  item6TempDetalle?: string;
  item7Detalle?: string;
  item8Detalle?: string;
  observaciones: string;
  // Solo para el panel: nunca se imprime en el PDF que ve el cliente.
  observacionesInternas?: string;
  fotos: Foto[];
  firma: Firma | null;
}

export function emptyPhase(): Phase {
  return {
    checklist: emptyChecklist(),
    item1Detalle: '',
    item2Detalle: '',
    item3Detalle: '',
    item4Detalle: '',
    item5Detalle: '',
    fallaDetalle: '',
    item6AirbagDetalle: '',
    item6GuineDetalle: '',
    item6AlternadorDetalle: '',
    item6PresionDetalle: '',
    item6TempDetalle: '',
    item7Detalle: '',
    item8Detalle: '',
    observaciones: '',
    observacionesInternas: '',
    fotos: [],
    firma: null,
  };
}

// The detail fields of a Phase, keyed by ChecklistKey — same shape
// ChecklistEditor/missingChecklistDetail (checklist.ts) expect.
export function phaseDetalles(phase: Phase): Partial<Record<ChecklistKey, string | undefined>> {
  return {
    item1: phase.item1Detalle,
    item2: phase.item2Detalle,
    item3: phase.item3Detalle,
    item4: phase.item4Detalle,
    item5: phase.item5Detalle,
    item6_falla: phase.fallaDetalle,
    item6_airbag: phase.item6AirbagDetalle,
    item6_guine: phase.item6GuineDetalle,
    item6_alternador: phase.item6AlternadorDetalle,
    item6_presion: phase.item6PresionDetalle,
    item6_temp: phase.item6TempDetalle,
    item7: phase.item7Detalle,
    item8: phase.item8Detalle,
  };
}

// What the técnico typed/picked to identify the Odoo helpdesk ticket for
// this client. `numero` is always present (even offline, unverified) so
// linking a ticket never depends on having signal at that moment.
// Which leg of a cambio_equipo this hoja is — the two legs are linked by
// parejaId (Mongo _id of the other one), set once both exist.
export interface CambioEquipoRef {
  rol: 'retiro' | 'instalacion';
  parejaId?: string | null;
}

// Cambio de unidad: el cliente quiere el equipo en otra unidad, pero por norma
// el equipo retirado vuelve al laboratorio y en la unidad nueva se instala uno
// NUEVO. Son 2 hojas (una por unidad, cada una con su matrícula/checklist/firma):
// 'origen' = desinstalación en la unidad que deja el equipo, 'destino' =
// instalación del equipo nuevo en la unidad a la que se cambia. Pueden hacerlas
// técnicos o días distintos y en cualquier orden; se vinculan por parejaId
// (Mongo _id de la otra), normalmente solas por compartir la tarea padre de Odoo.
export interface CambioUnidadRef {
  rol: 'origen' | 'destino';
  parejaId?: string | null;
  // Cambio completo: las dos hojas son un solo trabajo (la liquidación no las paga como dos).
  completo?: boolean;
}

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
  // Cuándo fue el último intento (éxito o falla) — usado para no reintentar
  // en automático un envío a Odoo que falló hace segundos.
  lastAttemptAt?: string;
}

export function emptyOdooSync(): OdooSync {
  return { status: 'PENDING', attempts: 0 };
}

export interface ConformidadRecord {
  id: string; // local id (clientId on the wire)
  remoteId?: string; // Mongo _id once synced
  codigoActa?: string;

  tipoServicio: TipoServicio | null;
  motivoIntervencion?: MotivoIntervencion | null;
  // Obligatorio solo cuando motivoIntervencion es 'otro'.
  motivoIntervencionDetalle?: string;
  // Los 2 campos siguientes solo aplican cuando motivoIntervencion es 'cambio_equipo'.
  cambioEquipoRazon?: CambioEquipoRazon | null;
  // Obligatorio solo cuando cambioEquipoRazon es 'otro'.
  cambioEquipoRazonDetalle?: string;

  numero: string;
  cliente: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:mm
  matricula: string;
  // Ausente = 'vehiculo' (hojas anteriores a este dato).
  tipoUnidad?: TipoUnidad;
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
  cambioEquipo?: CambioEquipoRef | null;
  cambioUnidad?: CambioUnidadRef | null;
  // Solo local de la PWA (no viaja a la API): ver ConformidadRecord.parejaLocalId en la copia de la PWA.
  parejaLocalId?: string;

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
