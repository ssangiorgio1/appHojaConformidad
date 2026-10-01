import { visionbloPostJson } from '../config/visionblo.js';

// Consulta en vivo, por equipo, del estado de reporte y módulos detectados. Usa los mismos
// endpoints que las pantallas de bo3 (equipo/buscar, equipo/diagnostico, equipo/modulos,
// equipo/historial) con la cookie de sesión — ver ENDPOINTS.md en el proyecto "cruce back sims".
// Sólo se consulta el equipo que se pide: nunca en lote.

// Descripción de cada módulo por prefijo (primeros 4 caracteres de la serie) — es la tabla fija
// que bo3 tiene hardcodeada en su pantalla equipo/modulos (no hay "alta" de módulos: el equipo
// los reporta solo cada hora).
const MODULO_PREFIJOS: Record<string, string> = {
  '1044': 'Módulo de audio',
  '1111': 'Cámara JPEG',
  '2914': 'RPM (camión mezclador)',
  '2F1E': 'Varilla de combustible (TTM)',
  '2F1F': 'Varilla de combustible (WARA)',
  '3144': 'Módulo multifunción',
  '31F1': 'WiFi (ESP8266)',
  '3F1D': 'RFID acoplado (EPC96)',
  C013: 'Boletera estudiantil',
  C0C0: 'Contador de pasajeros',
  CA16: 'CANBus',
  D155: 'Pantalla',
};

export interface ModuloDetectado {
  serie: string;
  descripcion: string;
  advertencia: string | null;
}

export function decodificarModulo(serie: string): ModuloDetectado {
  const prefijo = serie.slice(0, 4).toUpperCase();
  if (prefijo === '2F1D') {
    const viejo = serie.slice(-4, -1) === '000';
    const conBuzzer = (parseInt(serie.slice(-1), 16) & 1) === 1;
    return {
      serie,
      descripcion: conBuzzer ? 'RFID (buzzer interno)' : 'RFID',
      advertencia: viejo ? 'Módulo viejo, cambiar urgente' : null,
    };
  }
  if (prefijo === '51F1') {
    return {
      serie,
      descripcion: 'WiFi (Pico W)',
      advertencia: serie.toUpperCase().startsWith('51F103') ? 'No soporta redes WiFi sin contraseña, actualizar de ser necesario' : null,
    };
  }
  return { serie, descripcion: MODULO_PREFIJOS[prefijo] ?? 'Módulo desconocido', advertencia: null };
}

export interface EquipoCoincidencia {
  equipoId: number;
  descripcion: string;
}

const MAX_COINCIDENCIAS = 15;

// equipo/buscar resuelve serie, IMEI, patente y nombre de unidad; devuelve { "<equipoId>": "<texto>" }.
export async function buscarEquipos(texto: string): Promise<EquipoCoincidencia[]> {
  const res = await visionbloPostJson<Record<string, string>>('equipo/buscar', { texto });
  return Object.entries(res)
    .slice(0, MAX_COINCIDENCIAS)
    .map(([id, descripcion]) => ({ equipoId: Number(id), descripcion }));
}

interface DiagnosticoCrudo {
  equipo: {
    id: number;
    nombre: string | null;
    serie: string | null;
    imei: string | null;
    iccid: string | null;
    fecha_ultimo_reporte: string | null;
    fecha_posicion: string | null;
    latitud: number | null;
    longitud: number | null;
    fecha_ignicion: string | null;
    ignicion: boolean | null;
    fecha_voltaje_cargador: string | null;
    // unknown y no number: bo3 a veces lo serializa como string (ver numOrNull) —
    // un valor así sin coerción rompía el render en la PWA/panel (.toFixed en un string).
    voltaje_cargador: unknown;
    fecha_firmware: string | null;
    firmware: string | null;
  };
  pantalla: unknown;
  corte_motor: unknown;
  sim: { telefono?: string | null; info?: { operator?: { name?: string } } } | false | null;
  peticion_radioescucha: unknown;
  peticion_posicion: unknown;
  panico: { fecha?: string } | false;
  rfid: unknown;
  fuel: unknown;
  movil:
    | false
    | { cliente: string; movil: string; cliente_id: number; baja: boolean; baja_cliente: boolean; corte_de_servicio: boolean };
  actualizar_firmware?: { ok?: boolean; firmware?: number; error?: string };
}

interface EventoCrudo {
  fecha: string;
  evento: string;
  datos: Record<string, unknown>;
}

const EVENTOS_RECIENTES_HORAS = 6;
const EVENTOS_RECIENTES_MAX = 40;

// Los campos numéricos de bo3 no tienen garantía de tipo real (vienen de un scrape de JSON externo
// sin validación): un voltaje puede llegar como string ("12.5" o incluso "12,5" con coma decimal) en
// vez de number. Sin esta coerción, .toFixed() en un string tiraba un TypeError en pleno render
// (pantalla de error de Next) en vez de mostrar el dato o un "—".
function numOrNull(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'string') {
    const n = Number(raw.trim().replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

interface FirmwareCrudo {
  version?: string;
  miniavl?: boolean;
  minisystem?: boolean;
  dual_sim?: boolean;
  qaud_display?: boolean;
}

// Mismo formato que la pantalla equipo/diagnostico de bo3 (formato_firmware): la versión cruda es
// una fecha de compilación ("2021-12-06T15:06:43") que se muestra como "v21.12.06r906 (MiniAVL)" —
// aa.mm.dd + "r" + minutos desde medianoche (15:06 → 906) + sufijos según las banderas del equipo.
export function formatoFirmware(raw: string | null): string | null {
  if (!raw) return null;
  let fw: FirmwareCrudo;
  try {
    fw = JSON.parse(raw) as FirmwareCrudo;
  } catch {
    return raw;
  }
  if (fw.minisystem) return 'MiniSystem';
  const v = fw.version;
  if (!v || v.length < 16) return v ?? null;
  let etiqueta = `v${v.slice(2, 4)}.${v.slice(5, 7)}.${v.slice(8, 10)}r${Number(v.slice(11, 13)) * 60 + Number(v.slice(14, 16))}`;
  if (fw.dual_sim) etiqueta += '+dualsim';
  if (fw.qaud_display) etiqueta += '+qauddisplay';
  if (fw.miniavl) etiqueta += ' (MiniAVL)';
  return etiqueta;
}

export interface EstadoEquipo {
  consultadoAt: string;
  equipoId: number;
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
  firmware: { version: string | null; fecha: string | null; actualizacionDisponible: boolean; detalleActualizacion: string | null };
  // Banderas del diagnóstico de bo3: "algún evento de ese tipo se recibió alguna vez" — no
  // equivalen a "hay hardware conectado ahora" (para eso están los módulos detectados).
  senalesVistas: { pantalla: boolean; rfid: boolean; fuel: boolean; sim: boolean; corteMotor: boolean; panico: string | null };
  movil: { cliente: string; movil: string; baja: boolean; bajaCliente: boolean; corteDeServicio: boolean } | null;
  modulos: { fecha: string | null; detectados: ModuloDetectado[] };
  // Última posición del historial (el diagnóstico solo trae lat/lng): trae la cantidad de satélites,
  // que el técnico necesita en el control de instalación.
  gps: { satelites: number | null; hdop: number | null; fecha: string } | null;
  eventosRecientes: EventoCrudo[];
}

async function consultarEstado(equipoId: number): Promise<EstadoEquipo> {
  const hoy = new Date();
  const ayer = new Date(hoy.getTime() - 86_400_000);
  const dia = (d: Date) => d.toISOString().slice(0, 10);

  const [dg, modulos, historial] = await Promise.all([
    visionbloPostJson<DiagnosticoCrudo>('equipo/diagnostico', { equipo_id: String(equipoId) }),
    visionbloPostJson<{ modulos: string[]; fecha: string | null } | null>('equipo/modulos', { equipo_id: String(equipoId) }),
    visionbloPostJson<EventoCrudo[]>('equipo/historial', {
      equipo_id: String(equipoId),
      desde: dia(ayer),
      hasta: dia(hoy),
      debug: '',
      geocerca_id: null,
      utc: true,
      fecha_recepcion: false,
    }),
  ]);

  const desde = hoy.getTime() - EVENTOS_RECIENTES_HORAS * 3_600_000;
  const recientes = historial.filter((e) => e.evento !== 'posicion' && e.evento !== 'debug' && new Date(e.fecha).getTime() >= desde);
  // Un estado_general suelto puede venir con campos en null (ej. dbm_modem un instante, cuando el
  // módem no devolvió lectura) aunque los anteriores sí la traigan: se toma el último valor NO nulo de
  // cada campo, no el del último evento.
  const estados = [...historial].reverse().filter((e) => e.evento === 'estado_general');
  const ultimoValor = (campo: 'voltaje_bateria' | 'dbm_modem') =>
    estados.map((e) => numOrNull(e.datos[campo])).find((v) => v !== null) ?? null;
  const eq = dg.equipo;
  const ultimaPosicion = [...historial].reverse().find((e) => e.evento === 'posicion');

  return {
    consultadoAt: hoy.toISOString(),
    equipoId,
    serie: eq.serie,
    imei: eq.imei,
    iccid: eq.iccid,
    simTelefono: dg.sim ? (dg.sim.telefono ?? null) : null,
    simOperador: dg.sim ? (dg.sim.info?.operator?.name ?? null) : null,
    ultimoReporte: eq.fecha_ultimo_reporte,
    posicion:
      eq.latitud && eq.longitud ? { latitud: eq.latitud / 1e7, longitud: eq.longitud / 1e7, fecha: eq.fecha_posicion } : null,
    ignicion: eq.ignicion === null || eq.ignicion === undefined ? null : { encendida: eq.ignicion, fecha: eq.fecha_ignicion },
    voltajeCargador: numOrNull(eq.voltaje_cargador),
    bateriaInterna: ultimoValor('voltaje_bateria'),
    senalDbm: ultimoValor('dbm_modem'),
    firmware: {
      version: formatoFirmware(eq.firmware),
      fecha: eq.fecha_firmware,
      actualizacionDisponible: dg.actualizar_firmware?.ok === true,
      detalleActualizacion: dg.actualizar_firmware?.error ?? null,
    },
    senalesVistas: {
      pantalla: !!dg.pantalla,
      rfid: !!dg.rfid,
      fuel: !!dg.fuel,
      sim: !!dg.sim,
      corteMotor: !!dg.corte_motor,
      panico: dg.panico ? (dg.panico.fecha ?? null) : null,
    },
    movil: dg.movil
      ? { cliente: dg.movil.cliente, movil: dg.movil.movil, baja: dg.movil.baja, bajaCliente: dg.movil.baja_cliente, corteDeServicio: dg.movil.corte_de_servicio }
      : null,
    modulos: { fecha: modulos?.fecha ?? null, detectados: (modulos?.modulos ?? []).map(decodificarModulo) },
    gps: ultimaPosicion
      ? { satelites: numOrNull(ultimaPosicion.datos.satelites), hdop: numOrNull(ultimaPosicion.datos.hdop), fecha: ultimaPosicion.fecha }
      : null,
    eventosRecientes: recientes.slice(-EVENTOS_RECIENTES_MAX).reverse(),
  };
}

// Cache corto + dedupe de consultas simultáneas: varios usuarios mirando el mismo equipo no
// multiplican los pedidos a bo3 (3 requests por consulta).
const TTL_MS = 30_000;
const cache = new Map<number, { at: number; data: EstadoEquipo }>();
const enCurso = new Map<number, Promise<EstadoEquipo>>();

export async function getEstadoEquipo(equipoId: number, opts: { forzar?: boolean } = {}): Promise<EstadoEquipo> {
  const hit = cache.get(equipoId);
  if (!opts.forzar && hit && Date.now() - hit.at < TTL_MS) return hit.data;
  const pendiente = enCurso.get(equipoId);
  if (pendiente) return pendiente;
  const p = consultarEstado(equipoId)
    .then((data) => {
      cache.set(equipoId, { at: Date.now(), data });
      if (cache.size > 200) cache.delete(cache.keys().next().value as number);
      return data;
    })
    .finally(() => enCurso.delete(equipoId));
  enCurso.set(equipoId, p);
  return p;
}

// Vista para técnicos: el equipo que están instalando/probando sí, pero no qué cliente es ni
// dónde está — esto consulta cualquier equipo de la cuenta, no sólo los del técnico.
export function vistaTecnico(e: EstadoEquipo): EstadoEquipo {
  return { ...e, posicion: null, movil: e.movil ? { ...e.movil, cliente: '' } : null };
}
