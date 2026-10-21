import {
  ADICIONAL_ZONA,
  CASILLA_A_ITEM,
  COEFICIENTES_ITEM,
  COEFICIENTES_TRABAJO,
  VALOR_COEFICIENTE,
} from '../config/liquidacion.js';
import type { CasillaInstalable } from '../config/productoMapeo.js';

// Lo que se pagó por un trabajo = valor del producto en Odoo + extra (puntos de coeficiente × valor del punto)
// + adicional fijo si el trabajo cae en una zona con adicional. Cada técnico cobra su trabajo completo, incluso en
// una tarea compartida (anotado en docs-liquidacion-coeficientes.md).

export interface TrabajoLiquidable {
  tipoServicio: 'instalacion' | 'desinstalacion' | 'reparacion' | 'cambio_equipo' | 'cambio_unidad';
  visitaFallida?: boolean;
  /** Se instaló un equipo GPS en la visita. */
  equipoGps?: boolean;
  /** Casillas instaladas (módulos y sensores) con su cantidad. */
  casillas?: Partial<Record<CasillaInstalable, number>>;
  /** Valor del/los producto(s) en Odoo para este trabajo; si no se conoce, el monto base queda en blanco. */
  baseOdoo?: number | null;
  /** 0 = Zona 1 (la más cercana a la oficina). Si no se conoce, no se aplica adicional. */
  zonaIndice?: number | null;
}

export interface LineaPuntos {
  concepto: string;
  puntos: number;
  nota?: string;
}

export interface Liquidacion {
  lineas: LineaPuntos[];
  puntos: number;
  /** Casillas instaladas sin coeficiente en la tabla: no suman, hay que definir su valor. */
  sinCoeficiente: CasillaInstalable[];
  baseOdoo: number | null;
  /** puntos × valor del punto; null si el valor del punto no está definido. */
  extraCoeficiente: number | null;
  adicionalZona: number | null;
  /** null si falta algún componente (base de Odoo o valor del punto). */
  total: number | null;
}

export interface ParametrosPago {
  valorCoeficiente: number | null;
  adicionalZona: ReadonlyArray<number | null>;
}

const redondear = (n: number) => Math.round(n * 100) / 100;

export function calcularPuntos(t: TrabajoLiquidable): Pick<Liquidacion, 'lineas' | 'puntos' | 'sinCoeficiente'> {
  const lineas: LineaPuntos[] = [];
  const sinCoeficiente: CasillaInstalable[] = [];

  if (t.visitaFallida) {
    lineas.push({ concepto: 'Visita fallida', puntos: COEFICIENTES_TRABAJO.visitaFallida });
  } else if (t.tipoServicio === 'desinstalacion' || t.tipoServicio === 'cambio_unidad') {
    lineas.push({ concepto: 'Desinstalación / cambio de unidad', puntos: COEFICIENTES_TRABAJO.desinstalacion });
  } else if (t.tipoServicio === 'cambio_equipo') {
    lineas.push({ concepto: 'Reparación: cambio de equipo', puntos: COEFICIENTES_TRABAJO.reparacionCambioEquipo });
  } else if (t.tipoServicio === 'reparacion') {
    lineas.push({ concepto: 'Reparación técnica', puntos: COEFICIENTES_TRABAJO.reparacionTecnica });
  }
  if (lineas.length) return { lineas, puntos: redondear(lineas.reduce((s, l) => s + l.puntos, 0)), sinCoeficiente };

  // Instalación: ítems con coeficiente (uno por casilla, por su cantidad) y casillas sin coeficiente.
  const items: Array<{ nombre: string; solo: number; conGps: number; cantidad: number; nota?: string }> = [];
  for (const [key, cant] of Object.entries(t.casillas ?? {}) as Array<[CasillaInstalable, number]>) {
    if (!cant || cant <= 0) continue;
    const m = CASILLA_A_ITEM[key];
    if (!m) {
      sinCoeficiente.push(key);
      continue;
    }
    items.push({ ...COEFICIENTES_ITEM[m.item], cantidad: cant, nota: m.revisar });
  }

  let usadoConGps = -1;
  if (t.equipoGps) {
    lineas.push({ concepto: 'Instalación de equipo GPS', puntos: COEFICIENTES_TRABAJO.instalacionGps });
    // Con GPS se usa la columna "+ Equipo GPS" de un solo ítem (el de mayor valor); los demás van "solos".
    // Esta regla es una suposición: la tabla no dice qué pasa con varios sensores juntos.
    let mejor = -1;
    items.forEach((it, i) => {
      if (mejor === -1 || it.conGps > items[mejor].conGps) mejor = i;
    });
    usadoConGps = mejor;
  }
  items.forEach((it, i) => {
    if (i === usadoConGps) {
      // La columna "+ Equipo GPS" ya trae el 1,00 del equipo: se descuenta de la línea del GPS.
      const extra = it.conGps - COEFICIENTES_TRABAJO.instalacionGps + (it.cantidad - 1) * it.solo;
      lineas.push({ concepto: `${it.nombre}${it.cantidad > 1 ? ` ×${it.cantidad}` : ''} (con equipo GPS)`, puntos: redondear(extra), nota: it.nota });
    } else {
      lineas.push({ concepto: `${it.nombre}${it.cantidad > 1 ? ` ×${it.cantidad}` : ''}`, puntos: redondear(it.solo * it.cantidad), nota: it.nota });
    }
  });

  return { lineas, puntos: redondear(lineas.reduce((s, l) => s + l.puntos, 0)), sinCoeficiente };
}

export function liquidarTrabajo(
  t: TrabajoLiquidable,
  params: ParametrosPago = { valorCoeficiente: VALOR_COEFICIENTE, adicionalZona: ADICIONAL_ZONA },
): Liquidacion {
  const { lineas, puntos, sinCoeficiente } = calcularPuntos(t);
  const baseOdoo = t.baseOdoo ?? null;
  const extraCoeficiente = params.valorCoeficiente == null ? null : redondear(puntos * params.valorCoeficiente);
  const adicionalZona = t.zonaIndice == null ? 0 : (params.adicionalZona[t.zonaIndice] ?? null);
  const total = baseOdoo == null || extraCoeficiente == null || adicionalZona == null ? null : redondear(baseOdoo + extraCoeficiente + adicionalZona);
  return { lineas, puntos, sinCoeficiente, baseOdoo, extraCoeficiente, adicionalZona, total };
}
