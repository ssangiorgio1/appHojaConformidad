import { VisionbloError, visionbloPostJson } from '../config/visionblo.js';
import { ultimoReporteApi, visionbloApiConfigurada, type EventoApi, type UltimoReporteApi } from '../config/visionbloApi.js';
import { FlotaUnidadModel } from '../models/FlotaUnidad.js';
import { matriculaRegex } from './historialUnidad.service.js';

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

// Patentes completas dentro de un texto, sin espacios ("217 - AB 054 AQ" → ["AB054AQ"]): vieja (ABC123) o Mercosur
// (AB123CD). Se buscan sobre el texto ORIGINAL, como palabra aparte (letras y números pegados solo por espacios o guion
// dentro de la propia patente): compactar todo el texto primero inventa patentes que cruzan palabras
// ("CASE SR220 (EFW 042)" daba "ESR220", y la patente real, EFW 042, nunca se buscaba).
const PATENTE_EN_TEXTO_RE = /(?<![A-Z0-9])(?:[A-Z]{2}[ -]?\d{3}[ -]?[A-Z]{2}|[A-Z]{3}[ -]?\d{3})(?![A-Z0-9])/g;

export function patentesDeTexto(texto: string): string[] {
  const encontradas = texto.toUpperCase().match(PATENTE_EN_TEXTO_RE) ?? [];
  return [...new Set(encontradas.map((p) => p.replace(/[^A-Z0-9]/g, '')))];
}

export function patenteDeTexto(texto: string): string | null {
  return patentesDeTexto(texto)[0] ?? null;
}

// Una patente se cruza SOLO con el campo `matricula` de la unidad (movil/mapa, el mismo que muestra
// cliente/moviles_activos). El `nombre` de la unidad es texto libre del cliente: puede ser otra patente,
// un interno o cualquier cosa, y equipo/buscar lo mezcla con la matrícula.
async function buscarPorMatricula(patente: string): Promise<EquipoCoincidencia[]> {
  const unidades = await FlotaUnidadModel.find(
    { matricula: matriculaRegex(patente), equipoId: { $ne: null } },
    { equipoId: 1, nombre: 1, matricula: 1, clienteNombre: 1, movilBaja: 1, clienteBaja: 1 },
  ).lean();
  // Si la patente quedó también en unidades dadas de baja, manda la que está activa.
  const activas = unidades.filter((u) => !u.movilBaja && !u.clienteBaja);
  const elegidas = activas.length > 0 ? activas : unidades;
  const porEquipo = new Map<number, EquipoCoincidencia>();
  for (const u of elegidas) {
    porEquipo.set(u.equipoId as number, {
      equipoId: u.equipoId as number,
      descripcion: [u.clienteNombre, u.nombre, u.matricula].filter(Boolean).join(' - '),
    });
  }
  return [...porEquipo.values()];
}

// Matrícula de la unidad a la que pertenece un equipo (la unidad de bo3, no su nombre).
async function matriculaDeEquipo(equipoId: number): Promise<string | null> {
  const u = await FlotaUnidadModel.findOne({ equipoId, movilBaja: false }, { matricula: 1 }).lean();
  return u?.matricula || null;
}

// equipo/buscar resuelve serie, IMEI, patente y nombre de unidad; devuelve { "<equipoId>": "<texto>" }.
// Cuando lo buscado trae una patente, primero se resuelve por matrícula; equipo/buscar queda para IMEI, serie, número
// de equipo y para las patentes que la flota todavía no conoce.
export async function buscarEquipos(texto: string): Promise<EquipoCoincidencia[]> {
  // El texto puede traer un interno junto a la patente ("CASE SR220 (EFW 042)"): se prueba cada patente que contenga.
  const patentes = patentesDeTexto(texto);
  for (const patente of patentes) {
    try {
      const porMatricula = await buscarPorMatricula(patente);
      if (porMatricula.length > 0) return porMatricula.slice(0, MAX_COINCIDENCIAS);
    } catch (err) {
      console.error('BUSCAR_POR_MATRICULA_FAILED', err);
    }
  }
  // equipo/buscar: primero el texto tal cual (IMEI, serie, N° de equipo, nombre); si no devuelve nada y el texto traía una
  // patente, se reintenta con la patente sola, que es lo que VisionBLO sí indexa.
  for (const consulta of [texto, ...patentes]) {
    const res = await visionbloPostJson<Record<string, string>>('equipo/buscar', { texto: consulta });
    const coincidencias = Object.entries(res)
      .filter(([, descripcion]) => !esOtraPatente(consulta, descripcion))
      .slice(0, MAX_COINCIDENCIAS)
      .map(([id, descripcion]) => ({ equipoId: Number(id), descripcion }));
    if (coincidencias.length > 0) return coincidencias;
  }
  return [];
}

// Patente argentina vieja (ABC123) o Mercosur (AB123CD), sin espacios.
const PATENTE_RE = /[A-Z]{2,3}\d{3}[A-Z]{0,2}/g;
const PATENTE_EXACTA_RE = /^(?:[A-Z]{3}\d{3}|[A-Z]{2}\d{3}[A-Z]{2})$/;

function soloAlfanumerico(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// equipo/buscar es aproximado: buscando "AA 123 AA" también devuelve "AF 123 AA".
// Si lo buscado es una patente completa, se descartan los resultados cuya descripción
// trae patentes y ninguna es esa. Si la descripción no trae patente, se conserva
// (puede haber coincidido por IMEI, serie o nombre).
function esOtraPatente(texto: string, descripcion: string): boolean {
  const buscada = soloAlfanumerico(texto);
  if (!PATENTE_EXACTA_RE.test(buscada)) return false;
  const compacta = soloAlfanumerico(descripcion);
  if (compacta.includes(buscada)) return false;
  return (descripcion.toUpperCase().replace(/[\s-]/g, '').match(PATENTE_RE) ?? []).length > 0;
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
  // Lo que bo3 muestra como "número de equipo" (ej. t14s398); la serie de fábrica es otra cosa (1711398).
  nombre: string | null;
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
  // `movil` es el NOMBRE de la unidad en bo3 (texto libre, a veces otra patente): para cruzar con una patente usar `matricula`.
  movil: { cliente: string; movil: string; matricula: string | null; baja: boolean; bajaCliente: boolean; corteDeServicio: boolean } | null;
  modulos: { fecha: string | null; detectados: ModuloDetectado[] };
  // Última posición del historial (el diagnóstico solo trae lat/lng): trae la cantidad de satélites,
  // que el técnico necesita en el control de instalación.
  gps: { satelites: number | null; hdop: number | null; fecha: string } | null;
  // Fecha de la última posición, sin coordenadas: vistaTecnico oculta `posicion` (dónde está el equipo) pero el
  // chequeo de GPS necesita saber SI hay posición y cuándo — sin esto un técnico veía siempre "sin posición".
  posicionFecha: string | null;
  eventosRecientes: EventoCrudo[];
  // De dónde salieron los datos. 'api+cookie': reporte de la API de preinstalación + identificadores/SIM/firmware/cliente
  // del diagnóstico de bo3. 'api': la cookie no respondió, el estado es parcial (`aviso` dice qué falta). 'cookie': solo bo3
  // (la API no está configurada o no respondió).
  origen: { fuente: 'api+cookie' | 'api' | 'cookie'; aviso: string | null };
}

// Camino completo por cookie (bo3): diagnóstico + módulos + historial. Es el respaldo cuando la API de preinstalación no
// está configurada o falla. `dgPrevio` evita repetir el diagnóstico si ya se pidió en paralelo.
async function consultarEstadoCookie(equipoId: number, dgPrevio?: DiagnosticoCrudo): Promise<EstadoEquipo> {
  const hoy = new Date();
  const ayer = new Date(hoy.getTime() - 86_400_000);
  const dia = (d: Date) => d.toISOString().slice(0, 10);

  // El historial es lo más pesado y solo aporta señal/batería/satélites y los eventos recientes: si ÉL es lo único que no
  // llega (connect timeout, timeout, HTTP) se devuelve igual lo del diagnóstico y los módulos, con un aviso, en vez de
  // fallar toda la consulta. Una sesión vencida o sin configurar sí corta (también afecta al resto).
  let historialFallo = false;
  const [dg, modulos, historialCrudo, matricula] = await Promise.all([
    dgPrevio ?? visionbloPostJson<DiagnosticoCrudo>('equipo/diagnostico', { equipo_id: String(equipoId) }),
    visionbloPostJson<{ modulos: string[]; fecha: string | null } | null>('equipo/modulos', { equipo_id: String(equipoId) }),
    visionbloPostJson<EventoCrudo[]>('equipo/historial', {
      equipo_id: String(equipoId),
      desde: dia(ayer),
      hasta: dia(hoy),
      debug: '',
      geocerca_id: null,
      utc: true,
      fecha_recepcion: false,
    }).catch((err: unknown) => {
      if (err instanceof VisionbloError && (err.code === 'NETWORK' || err.code === 'TIMEOUT' || err.code === 'HTTP')) {
        console.warn('VISIONBLO_HISTORIAL_FAILED', err.message);
        historialFallo = true;
        return [] as EventoCrudo[];
      }
      throw err;
    }),
    matriculaDeEquipo(equipoId).catch(() => null),
  ]);
  const historial = historialCrudo;

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
    nombre: eq.nombre?.trim() || null,
    serie: eq.serie,
    imei: eq.imei,
    iccid: eq.iccid,
    simTelefono: dg.sim ? (dg.sim.telefono ?? null) : null,
    simOperador: dg.sim ? (dg.sim.info?.operator?.name ?? null) : null,
    ultimoReporte: eq.fecha_ultimo_reporte,
    posicion:
      eq.latitud && eq.longitud ? { latitud: eq.latitud / 1e7, longitud: eq.longitud / 1e7, fecha: eq.fecha_posicion } : null,
    posicionFecha: eq.latitud && eq.longitud ? (eq.fecha_posicion ?? null) : null,
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
      ? { cliente: dg.movil.cliente, movil: dg.movil.movil, matricula, baja: dg.movil.baja, bajaCliente: dg.movil.baja_cliente, corteDeServicio: dg.movil.corte_de_servicio }
      : null,
    modulos: { fecha: modulos?.fecha ?? null, detectados: (modulos?.modulos ?? []).map(decodificarModulo) },
    gps: ultimaPosicion
      ? { satelites: numOrNull(ultimaPosicion.datos.satelites), hdop: numOrNull(ultimaPosicion.datos.hdop), fecha: ultimaPosicion.fecha }
      : null,
    eventosRecientes: recientes.slice(-EVENTOS_RECIENTES_MAX).reverse(),
    origen: {
      fuente: 'cookie',
      aviso: historialFallo ? 'Datos parciales: no se pudo leer el historial del equipo. Faltan señal, batería, satélites y eventos recientes.' : null,
    },
  };
}

function datosDe(e: EventoApi | undefined): Record<string, unknown> {
  return e && e.datos && !Array.isArray(e.datos) ? e.datos : {};
}

// Arma el estado desde la API de preinstalación (`ultimo_reporte`) y le suma lo que solo trae el diagnóstico de bo3 (`dg`):
// IMEI/serie/nombre, teléfono y operador de la SIM, versión de firmware, cliente/baja/corte de servicio. Con `dg` en null (la
// cookie no respondió) esos campos quedan en null y `origen.aviso` lo explica. Es pura: no toca la red.
//
// Diferencias con el camino por cookie: la API da el ÚLTIMO reporte de cada tipo de evento, no el historial completo, así que
// `eventosRecientes` trae a lo sumo un evento por tipo; y batería/dBm salen del último `estado_general` (el camino por cookie
// buscaba el último valor no nulo en 24 h).
export function estadoDesdeApi(
  equipoId: number,
  api: UltimoReporteApi,
  dg: DiagnosticoCrudo | null,
  matricula: string | null,
  avisoSinCookie: string | null,
  ahora: Date = new Date(),
): EstadoEquipo {
  const u = api.ultimo_reporte ?? {};
  const eq = dg?.equipo ?? null;
  const pos = datosDe(u.posicion);
  const est = datosDe(u.estado_general);
  const ign = datosDe(u.ignicion);
  const mod = datosDe(u.modulos);
  const simEv = datosDe(u.sim);
  const lat = numOrNull(pos.latitud);
  const lon = numOrNull(pos.longitud);
  const tienePosicion = !!(lat && lon);
  const desde = ahora.getTime() - EVENTOS_RECIENTES_HORAS * 3_600_000;

  const eventosRecientes: EventoCrudo[] = Object.entries(u)
    .filter(([evento, e]) => evento !== 'posicion' && evento !== 'debug' && new Date(e.fecha).getTime() >= desde)
    .sort(([, a], [, b]) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    .slice(0, EVENTOS_RECIENTES_MAX)
    .map(([evento, e]) => ({ fecha: e.fecha, evento, datos: datosDe(e) }));

  return {
    consultadoAt: ahora.toISOString(),
    equipoId,
    nombre: eq?.nombre?.trim() || null,
    serie: eq?.serie ?? null,
    imei: eq?.imei ?? null,
    // Sin diagnóstico, el ICCID se rescata del último evento `sim`.
    iccid: eq?.iccid ?? (typeof simEv.iccid === 'string' ? simEv.iccid : null),
    simTelefono: dg?.sim ? (dg.sim.telefono ?? null) : null,
    simOperador: dg?.sim ? (dg.sim.info?.operator?.name ?? null) : null,
    ultimoReporte: api.ultima_recepcion || null,
    posicion: tienePosicion ? { latitud: (lat as number) / 1e7, longitud: (lon as number) / 1e7, fecha: u.posicion?.fecha ?? null } : null,
    posicionFecha: tienePosicion ? (u.posicion?.fecha ?? null) : null,
    ignicion: typeof ign.presente === 'boolean' ? { encendida: ign.presente, fecha: u.ignicion?.fecha ?? null } : null,
    voltajeCargador: numOrNull(est.voltaje_cargador),
    bateriaInterna: numOrNull(est.voltaje_bateria),
    senalDbm: numOrNull(est.dbm_modem),
    firmware: {
      version: eq ? formatoFirmware(eq.firmware) : null,
      // El evento `firmware_actualizado` coincide con la fecha de firmware de bo3.
      fecha: eq?.fecha_firmware ?? u.firmware_actualizado?.fecha ?? null,
      actualizacionDisponible: dg?.actualizar_firmware?.ok === true,
      detalleActualizacion: dg?.actualizar_firmware?.error ?? null,
    },
    // Con diagnóstico, sus banderas mandan (son las que ya usaba la PWA); sin él, se deducen de si el equipo reportó alguna
    // vez ese evento. Para el corte de motor se mira el estado actual del último evento `corte_de_motor`.
    senalesVistas: {
      pantalla: dg ? !!dg.pantalla : !!u.pantalla,
      rfid: dg ? !!dg.rfid : !!u.rfid,
      fuel: dg ? !!dg.fuel : !!(u.fuel ?? u.combustible),
      sim: dg ? !!dg.sim : !!u.sim,
      corteMotor: dg ? !!dg.corte_motor : datosDe(u.corte_de_motor).corte === true,
      panico: u.panico?.fecha ?? (dg?.panico ? (dg.panico.fecha ?? null) : null),
    },
    movil: dg?.movil
      ? { cliente: dg.movil.cliente, movil: dg.movil.movil, matricula, baja: dg.movil.baja, bajaCliente: dg.movil.baja_cliente, corteDeServicio: dg.movil.corte_de_servicio }
      : null,
    modulos: {
      fecha: u.modulos?.fecha ?? null,
      detectados: (Array.isArray(mod.modulos) ? (mod.modulos as string[]) : []).map(decodificarModulo),
    },
    gps: u.posicion
      ? { satelites: numOrNull(pos.satelites), hdop: numOrNull(pos.hdop), fecha: u.posicion.fecha }
      : null,
    eventosRecientes,
    origen: { fuente: dg ? 'api+cookie' : 'api', aviso: avisoSinCookie },
  };
}

function motivoSinCookie(err: unknown): string {
  if (err instanceof VisionbloError) {
    if (err.code === 'SESSION_EXPIRED') return 'la sesión de VisionBLO venció';
    if (err.code === 'NOT_CONFIGURED') return 'la sesión de VisionBLO no está configurada';
  }
  return 'VisionBLO no respondió';
}

// La API de preinstalación manda; la cookie suma lo que la API no trae. Si la API no está configurada o falla, se cae al
// camino completo por cookie. Si fallan las dos, se informa el error de la cookie (con el de la API anexado).
async function consultarEstado(equipoId: number): Promise<EstadoEquipo> {
  if (!visionbloApiConfigurada()) return consultarEstadoCookie(equipoId);

  const [api, dg] = await Promise.allSettled([
    ultimoReporteApi(equipoId),
    visionbloPostJson<DiagnosticoCrudo>('equipo/diagnostico', { equipo_id: String(equipoId) }),
  ]);

  if (api.status === 'rejected') {
    console.warn('VISIONBLO_API_FAILED', api.reason instanceof Error ? api.reason.message : api.reason);
    if (dg.status === 'fulfilled') return consultarEstadoCookie(equipoId, dg.value);
    if (dg.reason instanceof VisionbloError) {
      const apiMsg = api.reason instanceof Error ? api.reason.message : String(api.reason);
      throw new VisionbloError(dg.reason.code, `${dg.reason.message} Tampoco respondió la API de preinstalación (${apiMsg}).`);
    }
    throw dg.reason;
  }

  let matricula: string | null = null;
  if (dg.status === 'fulfilled' && dg.value.movil) matricula = await matriculaDeEquipo(equipoId).catch(() => null);
  let aviso: string | null = null;
  if (dg.status === 'rejected') {
    console.warn('VISIONBLO_COOKIE_FAILED', dg.reason instanceof Error ? dg.reason.message : dg.reason);
    aviso = `Datos parciales: ${motivoSinCookie(dg.reason)}. Faltan cliente, SIM, firmware e identificadores del equipo.`;
  }
  return estadoDesdeApi(equipoId, api.value, dg.status === 'fulfilled' ? dg.value : null, matricula, aviso);
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

// Número de equipo (campo `serie` del diagnóstico) y nombre de varias unidades de una vez, para listas y
// documentos del panel. Es 1 pedido a bo3 por equipo (equipo/diagnostico, no los 3-4 del estado completo),
// con pocos en paralelo y una memoria de 24 h: la serie de un equipo no cambia.
export interface SerieEquipo {
  serie: string | null;
  nombre: string | null;
}
const SERIE_TTL_MS = 24 * 3_600_000;
const SERIE_PARALELO = 5;
const seriesCache = new Map<number, SerieEquipo & { at: number }>();

export async function getSeriesEquipos(ids: number[]): Promise<Record<number, SerieEquipo | null>> {
  const salida: Record<number, SerieEquipo | null> = {};
  const pendientes: number[] = [];
  for (const id of new Set(ids)) {
    const hit = seriesCache.get(id);
    if (hit && Date.now() - hit.at < SERIE_TTL_MS) salida[id] = { serie: hit.serie, nombre: hit.nombre };
    else pendientes.push(id);
  }
  let siguiente = 0;
  async function trabajador() {
    while (siguiente < pendientes.length) {
      const id = pendientes[siguiente++];
      try {
        const dg = await visionbloPostJson<DiagnosticoCrudo>('equipo/diagnostico', { equipo_id: String(id) });
        const r = { serie: dg.equipo.serie ?? null, nombre: dg.equipo.nombre?.trim() || null };
        seriesCache.set(id, { ...r, at: Date.now() });
        if (seriesCache.size > 5000) seriesCache.delete(seriesCache.keys().next().value as number);
        salida[id] = r;
      } catch (err) {
        // Sin sesión o sin configurar no sirve seguir: se corta todo. Un equipo puntual que falla queda en null.
        if (err instanceof VisionbloError && (err.code === 'NOT_CONFIGURED' || err.code === 'SESSION_EXPIRED' || err.code === 'NETWORK')) throw err;
        salida[id] = null;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(SERIE_PARALELO, pendientes.length) }, trabajador));
  return salida;
}
