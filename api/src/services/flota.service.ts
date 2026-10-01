import { extractJsArray, visionbloGet } from '../config/visionblo.js';
import { FlotaMetaModel, FlotaUnidadModel, type FlotaCategoria, type FlotaTramo } from '../models/FlotaUnidad.js';

// Mismos cortes que las capas del mapa de VisionBLO (ok / +1 día / +1 semana).
const UMBRAL_REPORTANDO_H = 24;
const UMBRAL_SEMANA_H = 24 * 7;

// bo3 es lento y pesado (movil/mapa ~4-5MB, posiciones de TODOS los clientes): se protege con
// cooldown + candado para que varios clics / usuarios no disparen scrapes en paralelo.
const COOLDOWN_MS = 2 * 60_000;
let enCurso: Promise<RefrescoResult> | null = null;
let ultimoRefrescoAt = 0;

interface MovilCrudo {
  id: number;
  baja: boolean;
  nombre: string;
  cliente_id: number;
  matricula: string | null;
  interno: string | null;
  equipo_id: number | null;
  latitud?: number | null;
  longitud?: number | null;
  ultimo_reporte?: number | null;
}

interface ClienteCrudo {
  id: number;
  nombre: string;
  nombre_interno: string;
  baja: boolean;
  corte_de_servicio: boolean;
}

export interface RefrescoResult {
  unidades: number;
  escritas: number;
  eliminadas: number;
  porCategoria: Record<string, number>;
  actualizadoAt: string;
}

// Huella de los campos que vienen de VisionBLO (sin actualizadoAt) para detectar qué cambió.
function firma(u: {
  equipoId?: number | null; nombre: string; matricula?: string | null; interno?: string | null; clienteId: number;
  clienteNombre?: string | null; movilBaja: boolean; clienteBaja?: boolean | null; corteDeServicio?: boolean | null;
  latitud?: number | null; longitud?: number | null; ultimoReporte?: Date | null; tramoReporte: string; categoria: string;
}): string {
  return JSON.stringify([
    u.equipoId, u.nombre, u.matricula, u.interno, u.clienteId, u.clienteNombre, u.movilBaja, u.clienteBaja,
    u.corteDeServicio, u.latitud, u.longitud, u.ultimoReporte ? new Date(u.ultimoReporte).getTime() : null,
    u.tramoReporte, u.categoria,
  ]);
}

function aGrados(v: number | null | undefined): number | null {
  return v ? v / 1e7 : null;
}

async function scrapeFlota(ahora: Date) {
  const [mapa, activos, baja] = await Promise.all([
    visionbloGet('movil/mapa'),
    visionbloGet('cliente/activo'),
    visionbloGet('cliente/baja'),
  ]);
  const moviles = extractJsArray<MovilCrudo>(mapa, 'moviles');
  const clientes = new Map<number, ClienteCrudo>();
  for (const c of extractJsArray<ClienteCrudo>(activos, 'clientes')) clientes.set(c.id, c);
  for (const c of extractJsArray<ClienteCrudo>(baja, 'clientes')) clientes.set(c.id, c);

  return moviles.map((m) => {
    const cliente = clientes.get(m.cliente_id);
    const ultimoReporte = m.ultimo_reporte ? new Date(m.ultimo_reporte * 1000) : null;
    const horas = ultimoReporte ? (ahora.getTime() - ultimoReporte.getTime()) / 3_600_000 : null;
    const reportando = horas !== null && horas <= UMBRAL_REPORTANDO_H;
    const tramoReporte: FlotaTramo =
      horas === null ? 'nunca' : horas >= UMBRAL_SEMANA_H ? 'mas_1_semana' : horas > UMBRAL_REPORTANDO_H ? 'mas_1_dia' : 'ok';
    const deBaja = m.baja || cliente?.baja === true;
    const corte = cliente?.corte_de_servicio === true;
    // Sin reportar, en tramos: 24–48 h / 48–72 h / +72 h (quien nunca reportó cae en +72 h).
    const sinReportar: FlotaCategoria =
      horas !== null && horas <= 48 ? 'sin_reportar_24h' : horas !== null && horas <= 72 ? 'sin_reportar_48h' : 'sin_reportar_72h';
    // Las etiquetas siguen el estado que muestra bo3 en el cliente: baja / corte de servicio.
    const categoria: FlotaCategoria = deBaja
      ? corte
        ? 'baja_con_corte'
        : 'baja'
      : corte
        ? reportando
          ? 'corte_reportando'
          : 'corte_sin_reportar'
        : reportando
          ? 'activo_reportando'
          : sinReportar;

    return {
      movilId: m.id,
      equipoId: m.equipo_id ?? null,
      nombre: m.nombre,
      matricula: m.matricula || null,
      interno: m.interno || null,
      clienteId: m.cliente_id,
      clienteNombre: cliente ? cliente.nombre || cliente.nombre_interno || null : null,
      movilBaja: m.baja,
      clienteBaja: cliente ? cliente.baja : null,
      corteDeServicio: cliente ? cliente.corte_de_servicio : null,
      latitud: aGrados(m.latitud),
      longitud: aGrados(m.longitud),
      ultimoReporte,
      tramoReporte,
      categoria,
      actualizadoAt: ahora,
    };
  });
}

async function ejecutarRefresco(): Promise<RefrescoResult> {
  const ahora = new Date();
  const unidades = await scrapeFlota(ahora);

  // Atlas gratis (M0) limita el ritmo de escritura: sólo se escribe lo que cambió respecto de lo
  // ya guardado (una unidad estacionada no cambia entre refrescos), y se borran por id las que
  // VisionBLO ya no lista.
  const existentes = new Map<number, string>();
  for (const d of await FlotaUnidadModel.find({}, { _id: 0, actualizadoAt: 0 }).lean()) {
    existentes.set(d.movilId, firma(d));
  }
  const cambiadas = unidades.filter((u) => existentes.get(u.movilId) !== firma(u));
  const vistas = new Set(unidades.map((u) => u.movilId));
  const obsoletas = [...existentes.keys()].filter((id) => !vistas.has(id));

  const CHUNK = 5000;
  for (let i = 0; i < cambiadas.length; i += CHUNK) {
    await FlotaUnidadModel.bulkWrite(
      cambiadas.slice(i, i + CHUNK).map((u) => ({
        updateOne: { filter: { movilId: u.movilId }, update: { $set: u }, upsert: true },
      })),
      { ordered: false },
    );
  }
  if (obsoletas.length > 0) await FlotaUnidadModel.deleteMany({ movilId: { $in: obsoletas } });
  await FlotaMetaModel.updateOne({ _id: 'flota' }, { $set: { actualizadoAt: ahora } }, { upsert: true });

  const porCategoria: Record<string, number> = {};
  for (const u of unidades) porCategoria[u.categoria] = (porCategoria[u.categoria] ?? 0) + 1;
  return {
    unidades: unidades.length,
    escritas: cambiadas.length,
    eliminadas: obsoletas.length,
    porCategoria,
    actualizadoAt: ahora.toISOString(),
  };
}

// Devuelve { cooldown: segundos } si se refrescó hace poco en vez de volver a pegarle a VisionBLO.
export async function refrescarFlota(): Promise<RefrescoResult | { cooldown: number }> {
  if (enCurso) return enCurso;
  const restante = COOLDOWN_MS - (Date.now() - ultimoRefrescoAt);
  if (restante > 0) return { cooldown: Math.ceil(restante / 1000) };
  enCurso = ejecutarRefresco()
    .then((r) => {
      ultimoRefrescoAt = Date.now();
      return r;
    })
    .finally(() => {
      enCurso = null;
    });
  return enCurso;
}

export async function listFlota() {
  const [docs, meta] = await Promise.all([
    FlotaUnidadModel.find(
      { latitud: { $ne: null } },
      {
        _id: 0,
        movilId: 1,
        equipoId: 1,
        nombre: 1,
        matricula: 1,
        interno: 1,
        clienteId: 1,
        clienteNombre: 1,
        latitud: 1,
        longitud: 1,
        ultimoReporte: 1,
        categoria: 1,
        tramoReporte: 1,
      },
    ).lean(),
    FlotaMetaModel.findById('flota').lean(),
  ]);
  // Antes del primer refresco con la meta, cae a la unidad modificada más reciente.
  const ultimo = meta ?? (await FlotaUnidadModel.findOne({}, { actualizadoAt: 1 }).sort({ actualizadoAt: -1 }).lean());
  return {
    actualizadoAt: ultimo?.actualizadoAt?.toISOString() ?? null,
    unidades: docs.map((d) => ({
      ...d,
      ultimoReporte: d.ultimoReporte ? Math.floor(d.ultimoReporte.getTime() / 1000) : null,
    })),
  };
}
