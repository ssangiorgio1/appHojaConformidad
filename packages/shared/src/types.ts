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
// 'reinicio_manual' y 'revisar_ramales' conservan su clave (hojas anteriores) con un rótulo más preciso. Un sensor o módulo
// que ya estaba y se reemplaza o se repara va en 'cambio_sensor_modulo' (ver elementosIntervenidos), no en las casillas de
// equipo, que figuran como instalados.
export type MotivoIntervencion =
  | 'cambio_equipo'
  | 'reinicio_manual'
  | 'actualizacion_firmware'
  | 'revisar_ramales'
  | 'cambio_sensor_modulo'
  | 'otro';

export const MOTIVO_INTERVENCION_LABELS: Record<MotivoIntervencion, string> = {
  cambio_equipo: 'Cambio de equipo',
  reinicio_manual: 'Reinicio / reconfiguración del equipo',
  actualizacion_firmware: 'Actualización de firmware / software',
  revisar_ramales: 'Reparación de cableado / alimentación',
  cambio_sensor_modulo: 'Cambio o reparación de sensor / módulo',
  otro: 'Otro',
};

export const MOTIVO_INTERVENCION_OPTIONS: MotivoIntervencion[] = [
  'cambio_equipo',
  'reinicio_manual',
  'actualizacion_firmware',
  // 'revisar_ramales' (cableado / alimentación) ya no se ofrece: se superponía con sensor / módulo; un cable arreglado se
  // cuenta en el diagnóstico y en "¿Qué se hizo?". Sigue en el tipo para leer las hojas que ya lo tienen.
  'cambio_sensor_modulo',
  'otro',
];

// Sobre qué se actualizó el firmware / software (solo motivoIntervencion 'actualizacion_firmware').
export type ActualizacionSobre = 'equipo' | 'pantalla';

export const ACTUALIZACION_SOBRE_LABELS: Record<ActualizacionSobre, string> = {
  equipo: 'Equipo',
  pantalla: 'Pantalla',
};

// Qué se reinició / reconfiguró o qué se actualizó (motivoIntervencion 'reinicio_manual' y 'actualizacion_firmware'): se pueden
// marcar varios. Clave presente = marcado; el valor es el N° de serie (vacío para el equipo GPS, que es el equipo de la unidad
// ya vinculado). Reemplaza a actualizacionSobre / actualizacionNumero, que quedan para leer las hojas anteriores.
export type DispositivoAccion = 'equipo' | 'pantalla10' | 'pantalla' | 'mdvr' | 'camara';

export const DISPOSITIVO_ACCION_LABELS: Record<DispositivoAccion, string> = {
  equipo: 'Equipo GPS',
  // El equipo con pantalla de 10" integrada: su N° es el del equipo de la unidad (está detrás de la pantalla).
  pantalla10: 'Pantalla 10"',
  pantalla: 'Pantalla separada',
  mdvr: 'MDVR',
  camara: 'Cámara ADAS',
};

export const DISPOSITIVO_ACCION_OPTIONS: DispositivoAccion[] = ['equipo', 'pantalla10', 'pantalla', 'mdvr', 'camara'];

// El equipo GPS y la pantalla de 10" son el equipo de la unidad, ya vinculado: no piden N° de serie. El resto sí.
export function dispositivoPideSerie(k: DispositivoAccion): boolean {
  return k !== 'equipo' && k !== 'pantalla10';
}

// Las acciones que preguntan "¿Qué se reinició / actualizó?".
export function accionConDispositivos(m?: MotivoIntervencion | null): boolean {
  return m === 'reinicio_manual' || m === 'actualizacion_firmware';
}

// "Equipo GPS, MDVR N° 5566" — vacío si no se marcó nada.
export function dispositivosAccionTexto(d?: Partial<Record<DispositivoAccion, string>> | null): string {
  return DISPOSITIVO_ACCION_OPTIONS.filter((k) => d && k in d)
    .map((k) => {
      const serie = dispositivoPideSerie(k) ? (d?.[k] ?? '').trim() : '';
      return `${DISPOSITIVO_ACCION_LABELS[k]}${serie ? ` N° ${serie}` : ''}`;
    })
    .join(', ');
}

// Sensor o módulo que ya estaba en la unidad y se reemplazó o se reparó (solo motivoIntervencion 'cambio_sensor_modulo'):
// clave de la casilla de equipo (EQUIP_ITEM_PHOTO_LABEL) -> qué se hizo. NO es una instalación: el PDF lo muestra en su propia
// tarjeta ("Elementos reemplazados / reparados") y el panel aparte de los instalados.
export type AccionElemento = 'reemplazado' | 'reparado';

export const ACCION_ELEMENTO_LABELS: Record<AccionElemento, string> = {
  reemplazado: 'Reemplazado',
  reparado: 'Reparado',
};

// Fotos de cada elemento reemplazado/reparado: slotKey = prefijo + clave de la casilla.
export const FOTO_ELEMENTO_INTERVENIDO_PREFIX = 'intervenido_';

// Elementos con N° de serie propio: al reemplazarlos o repararlos se pide el número, si no se pierde qué dispositivo quedó.
export const ELEMENTOS_CON_SERIE: readonly string[] = ['modPantallaSerie', 'camarasAdas', 'mdvr', 'antenaStarlink'];

// Sensores que en una instalación llevan cantidad (mismos que tienen campo `cantidad` en EQUIP_GROUPS): al reemplazarlos o
// repararlos también se pide cuántos.
export const ELEMENTOS_CON_CANTIDAD: readonly string[] = ['sensorTemperatura', 'sensorAperturaPuertas', 'sensorAperturaPSemi', 'medComb'];

// Sensor de giro: tiene el sensor y un módulo aparte; se indica cuál de las dos partes (o ambas) se intervino.
export const ELEMENTO_CON_PARTE = 'sensorGiro';
export type ParteElemento = 'sensor' | 'modulo' | 'ambos';
export const PARTE_ELEMENTO_LABELS: Record<ParteElemento, string> = {
  sensor: 'Sensor',
  modulo: 'Módulo',
  ambos: 'Sensor y módulo',
};

// Detalle de cada elemento reemplazado/reparado (clave de la casilla -> detalle):
// - serie / serieAnterior (ELEMENTOS_CON_SERIE): reemplazado = el que se colocó y el que se sacó; reparado = solo `serie`.
// - cantidad (ELEMENTOS_CON_CANTIDAD).
// - parte (ELEMENTO_CON_PARTE).
// - conexion: dónde se conecta (texto libre: IO1, AO3, 1-Wire…), opcional; solo panel y Excel, no va al PDF.
export interface DetalleElementoIntervenido {
  serie?: string;
  serieAnterior?: string;
  cantidad?: string;
  parte?: ParteElemento;
  conexion?: string;
}

// "sensor y módulo · x2 · N° 12345 (antes 11111)" — vacío si no se cargó nada.
// `incluirConexion`: el panel y el Excel la muestran; el PDF del cliente no.
export function detalleElementoTexto(accion: AccionElemento, d?: DetalleElementoIntervenido | null, incluirConexion = false): string {
  const serie = d?.serie?.trim() ?? '';
  const anterior = accion === 'reemplazado' ? (d?.serieAnterior?.trim() ?? '') : '';
  const cantidad = d?.cantidad?.trim() ?? '';
  const series = [serie && `N° ${serie}`, anterior && `(antes ${anterior})`].filter(Boolean).join(' ');
  const conexion = incluirConexion && d?.conexion?.trim() ? `conectado en ${d.conexion.trim()}` : '';
  return [d?.parte ? PARTE_ELEMENTO_LABELS[d.parte].toLowerCase() : '', cantidad && `x${cantidad}`, series, conexion].filter(Boolean).join(' · ');
}


// "Actualización de firmware / software (pantalla)", "Cambio o reparación de sensor / módulo", etc.
export function accionIntervencionLabel(c: {
  motivoIntervencion?: MotivoIntervencion | null;
  actualizacionSobre?: ActualizacionSobre | null;
  actualizacionNumero?: string | null;
  dispositivosAccion?: Partial<Record<DispositivoAccion, string>> | null;
}): string {
  if (!c.motivoIntervencion) return '';
  const base = MOTIVO_INTERVENCION_LABELS[c.motivoIntervencion] ?? c.motivoIntervencion;
  // "Reinicio / reconfiguración (Equipo GPS, MDVR N° 5566)"
  const dispositivos = accionConDispositivos(c.motivoIntervencion) ? dispositivosAccionTexto(c.dispositivosAccion) : '';
  if (dispositivos) return `${base.replace(/ del equipo$/, '')} (${dispositivos})`;
  if (c.motivoIntervencion !== 'actualizacion_firmware' || !c.actualizacionSobre) return base;
  const sobre = ACTUALIZACION_SOBRE_LABELS[c.actualizacionSobre].toLowerCase();
  const numero = c.actualizacionSobre === 'pantalla' ? c.actualizacionNumero?.trim() : '';
  return `${base} (${sobre}${numero ? ` N° ${numero}` : ''})`;
}

// Qué se hizo, para el listado del panel y su exportación a Excel: el tipo de servicio y, en una intervención, lo que no dice el
// tipo solo ("Intervención · Cambio de equipo · Sensor / módulo"). El PDF del cliente puede no mencionar el cambio de equipo; acá
// figura siempre. Una hoja vieja sin tipo se muestra como instalación.
export function servicioLabel(c: {
  tipoServicio?: TipoServicio | null;
  motivoIntervencion?: MotivoIntervencion | null;
  instalaSensorModulo?: boolean | null;
  elementosIntervenidos?: Record<string, AccionElemento> | null;
}): string {
  const partes = [TIPO_SERVICIO_LABELS[c.tipoServicio ?? 'instalacion']];
  if (c.tipoServicio === 'reparacion' && c.motivoIntervencion === 'cambio_equipo') partes.push(MOTIVO_INTERVENCION_LABELS.cambio_equipo);
  // Con la acción propia o como extra de otra acción (ej. cambio de equipo 3G→4G que además reemplaza la pantalla).
  if (c.tipoServicio === 'reparacion' && (c.motivoIntervencion === 'cambio_sensor_modulo' || Object.keys(c.elementosIntervenidos ?? {}).length > 0)) {
    partes.push('Sensor / módulo reemplazado o reparado');
  }
  if (c.instalaSensorModulo) partes.push('Sensor / módulo');
  return partes.join(' · ');
}

// Por qué se cambia el equipo — solo aplica cuando motivoIntervencion es 'cambio_equipo'.
// 'actualizacion_4g': migración de 3G a 4G que el cliente conoce de antemano → figura en el PDF del cliente.
// 'orden_interna': el mismo cambio de 3G a 4G pero por orden interna de la empresa; si el cliente pidió solo un sensor o módulo,
// el cambio NO figura en su PDF (ver ocultaCambioEquipoEnPdf) y queda completo en el panel.
export type CambioEquipoRazon = 'equipo_danado' | 'pantalla_danada' | 'actualizacion_4g' | 'orden_interna' | 'otro';

export const CAMBIO_EQUIPO_RAZON_LABELS: Record<CambioEquipoRazon, string> = {
  equipo_danado: 'Equipo GPS',
  // Solo el equipo con pantalla de 10" integrada: una pantalla separada del equipo no es un cambio de equipo.
  pantalla_danada: 'Pantalla 10"',
  actualizacion_4g: 'Actualización de 2G, 3G a 4G',
  // Que no figura en el PDF del cliente se avisa con un cartel al elegirla, no en el botón.
  orden_interna: 'Cambio por incompatibilidad del equipo',
  otro: 'Otro',
};

// Intervención con cambio de equipo + instalación de un sensor o módulo: el PDF del cliente habla solo de la instalación del
// sensor y no menciona el cambio (ni sus fotos ni los datos del equipo retirado) cuando el cambio fue por orden interna.
// Con cualquier otra razón (incluida la actualización a 4G, que el cliente ya conoce) el cambio figura como siempre.
export function ocultaCambioEquipoEnPdf(r: {
  tipoServicio?: TipoServicio | null;
  motivoIntervencion?: MotivoIntervencion | null;
  cambioEquipoRazon?: CambioEquipoRazon | null;
  instalaSensorModulo?: boolean | null;
}): boolean {
  return (
    r.tipoServicio === 'reparacion' &&
    r.motivoIntervencion === 'cambio_equipo' &&
    r.cambioEquipoRazon === 'orden_interna' &&
    r.instalaSensorModulo === true
  );
}

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
  // Destino cuyo equipo no lo desinstaló el técnico: lo entregó el cliente en un acta de retiro/entrega de la unidad de origen
  // (no hay hoja de origen). `clientId` es el del acta y `unidad` el nombre de la unidad de donde viene.
  desdeRetiro?: { clientId: string; unidad?: string } | null;
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
  // Diagnóstico ("¿Qué se encontró?"), obligatorio en la PWA para cualquier acción. En hojas anteriores: solo el detalle de 'otro'.
  motivoIntervencionDetalle?: string;
  // Solo motivoIntervencion 'actualizacion_firmware'. Equipo: su N° es el del equipo de la unidad (equipo.modelo/imei);
  // pantalla: su N° de serie va acá, a mano (no en modPantallaSerie, que figuraría como pantalla instalada).
  actualizacionSobre?: ActualizacionSobre | null;
  actualizacionNumero?: string;
  // Solo 'reinicio_manual' y 'actualizacion_firmware': qué se reinició / actualizó y su N° de serie (ver DispositivoAccion).
  dispositivosAccion?: Partial<Record<DispositivoAccion, string>>;
  // Dónde quedó instalado el equipo (texto libre, junto a la foto "Ubicación y colocación"). Solo uso interno: no va al PDF;
  // sirve para auditar y para mostrárselo al próximo técnico que interviene la unidad.
  ubicacionEquipo?: string;
  // Solo motivoIntervencion 'cambio_sensor_modulo' (ver AccionElemento).
  elementosIntervenidos?: Record<string, AccionElemento>;
  // N° de serie, cantidad y parte de los elementos intervenidos (ver DetalleElementoIntervenido).
  elementosIntervenidosDetalle?: Record<string, DetalleElementoIntervenido>;
  // Los 3 campos siguientes solo aplican cuando motivoIntervencion es 'cambio_equipo'.
  cambioEquipoRazon?: CambioEquipoRazon | null;
  // Obligatorio solo cuando cambioEquipoRazon es 'otro'.
  cambioEquipoRazonDetalle?: string;
  // El equipo instalado es un backup provisorio y el original vuelve después del laboratorio (pastilla "Reemplazo temporal" del PDF).
  cambioEquipoTemporal?: boolean;
  // Intervención en la que, además de lo que se hizo con el equipo, se instala un sensor o módulo (se tilda en "Módulos y sensores").
  instalaSensorModulo?: boolean;

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
