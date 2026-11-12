import { ConformidadModel } from '../models/Conformidad.js';
import { UsuarioModel } from '../models/Usuario.js';

// Quién hizo (o está haciendo) cada unidad de una tarea compartida. La ficha de la agenda de la PWA solo conoce las hojas
// del propio celular, así que una unidad que terminó o empezó el compañero le seguía figurando "Empezar" al otro: se podía
// hacer dos veces, y no contaba como resuelta para "Finalizar visita". Va dentro de GET /api/visitas/:tareaOdooId.
export interface EstadoUnidad {
  subtareaOdooId: number;
  // 'completo' = hoja terminada; 'en_curso' = PRE o POST empezado (todavía sin terminar).
  estado: 'completo' | 'en_curso';
  nombre: string;
  esUnoMismo: boolean;
}

export interface HojaDeUnidad {
  subtareaOdoo?: { id?: number } | null;
  status?: string;
  tecnicoId?: unknown;
  tecnicoIdPost?: unknown;
  updatedAt?: Date;
}

// Puro (se prueba solo). Por unidad: una hoja completa manda sobre una en curso; entre iguales, la más reciente. Quién: el
// que cerró el POST si fue otro técnico (`tecnicoIdPost`), si no el que la empezó.
export function estadosPorUnidad(hojas: HojaDeUnidad[], nombrePorUsuario: Map<string, string>, yoUsuarioId: string): EstadoUnidad[] {
  const elegida = new Map<number, HojaDeUnidad>();
  const peso = (h: HojaDeUnidad) => (h.status === 'completo' ? 1 : 0);
  for (const h of hojas) {
    const id = h.subtareaOdoo?.id;
    if (typeof id !== 'number') continue;
    const previa = elegida.get(id);
    if (
      !previa ||
      peso(h) > peso(previa) ||
      (peso(h) === peso(previa) && (h.updatedAt?.getTime() ?? 0) >= (previa.updatedAt?.getTime() ?? 0))
    ) {
      elegida.set(id, h);
    }
  }
  const out: EstadoUnidad[] = [];
  for (const [subtareaOdooId, h] of elegida) {
    const quien = String(h.tecnicoIdPost ?? h.tecnicoId ?? '');
    const nombre = quien && nombrePorUsuario.get(quien);
    if (!nombre) continue;
    out.push({ subtareaOdooId, estado: h.status === 'completo' ? 'completo' : 'en_curso', nombre, esUnoMismo: quien === yoUsuarioId });
  }
  return out;
}

// Best-effort: si Mongo falla, la ficha sigue con lo que sabe el celular.
export async function estadosUnidadesDeTarea(tareaOdooId: number, yoUsuarioId: string): Promise<EstadoUnidad[]> {
  try {
    const hojas = (await ConformidadModel.find(
      { 'tareaOdoo.id': tareaOdooId, 'subtareaOdoo.id': { $ne: null }, deletedAt: null },
      { subtareaOdoo: 1, status: 1, tecnicoId: 1, tecnicoIdPost: 1, updatedAt: 1 },
    ).lean()) as HojaDeUnidad[];
    if (!hojas.length) return [];
    const usuarios = new Set<string>();
    for (const h of hojas) for (const u of [h.tecnicoIdPost, h.tecnicoId]) if (u) usuarios.add(String(u));
    const filas = (await UsuarioModel.find({ _id: { $in: [...usuarios] } }, { nombre: 1 }).lean()) as Array<{ _id: unknown; nombre?: string }>;
    const nombres = new Map<string, string>();
    for (const f of filas) if (f.nombre?.trim()) nombres.set(String(f._id), f.nombre.trim());
    return estadosPorUnidad(hojas, nombres, yoUsuarioId);
  } catch (err) {
    console.error('VISITA_ESTADOS_UNIDADES_FAILED', tareaOdooId, err);
    return [];
  }
}
