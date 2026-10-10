import { ConformidadModel } from '../models/Conformidad.js';
import { escapeRegExp } from '../utils/regex.js';

// Historial de servicios de UNA unidad (por matrícula) para la pantalla Atilio de la PWA: cuántas intervenciones tuvo y
// qué servicios se le hicieron. Cuenta solo hojas completas — un borrador o un POST pendiente todavía no es un servicio
// hecho. Una "intervención" es una reparación o un cambio de equipo en la misma unidad (el esquema viejo de
// cambio_equipo; hoy eso se carga como intervención con motivo "cambio de equipo").

export interface HojaHistorial {
  tipoServicio: string | null;
  fecha: string;
  fechaHora?: Date | null;
  motivoIntervencion?: string | null;
}

export interface HistorialUnidad {
  matricula: string;
  total: number;
  intervenciones: number;
  // Cantidad de servicios por tipo (solo los tipos que tuvieron al menos uno; hojas sin tipo cuentan como 'sin_tipo').
  porTipo: Record<string, number>;
  // El servicio más reciente de la unidad.
  ultimo: { tipoServicio: string | null; fecha: string; motivoIntervencion: string | null } | null;
}

const TIPOS_INTERVENCION = new Set(['reparacion', 'cambio_equipo']);

export function resumirHistorial(matricula: string, hojas: HojaHistorial[]): HistorialUnidad {
  const porTipo: Record<string, number> = {};
  let intervenciones = 0;
  for (const h of hojas) {
    const tipo = h.tipoServicio ?? 'sin_tipo';
    porTipo[tipo] = (porTipo[tipo] ?? 0) + 1;
    if (h.tipoServicio && TIPOS_INTERVENCION.has(h.tipoServicio)) intervenciones++;
  }
  const orden = (h: HojaHistorial) => (h.fechaHora ? new Date(h.fechaHora).getTime() : Date.parse(h.fecha) || 0);
  const reciente = [...hojas].sort((a, b) => orden(b) - orden(a))[0];
  return {
    matricula,
    total: hojas.length,
    intervenciones,
    porTipo,
    ultimo: reciente
      ? { tipoServicio: reciente.tipoServicio ?? null, fecha: reciente.fecha, motivoIntervencion: reciente.motivoIntervencion ?? null }
      : null,
  };
}

// La unidad de bo3 y la matrícula de la hoja pueden diferir en separadores ("AB 123 CD" vs "AB123CD"), así que se
// compara ignorando espacios y guiones.
export function matriculaRegex(matricula: string): RegExp {
  const limpia = matricula.replace(/[\s-]/g, '');
  return new RegExp(`^${[...limpia].map(escapeRegExp).join('[\\s-]*')}$`, 'i');
}

export async function getHistorialUnidad(matricula: string): Promise<HistorialUnidad> {
  const hojas = await ConformidadModel.find(
    { deletedAt: null, status: 'completo', matricula: matriculaRegex(matricula) },
    { tipoServicio: 1, fecha: 1, fechaHora: 1, motivoIntervencion: 1 },
  ).lean<HojaHistorial[]>();
  return resumirHistorial(matricula, hojas);
}
