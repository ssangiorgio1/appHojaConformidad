// Tipo de servicio que la PWA precarga al abrir una tarea, para que el técnico no tenga que elegirlo de cero. Es solo
// una sugerencia: el técnico siempre puede cambiarla. Ver docs-retiro-entrega-equipo.md.
//
// Se decide por el producto de la unidad (orden de venta) y, si no alcanza, por la etiqueta de la tarea en Odoo.
// El producto manda: la etiqueta es una clasificación manual y a veces ambigua (ej. "RETIRAR EQUIPO GPS" se usa tanto
// para desinstalar de la unidad como para retirar un equipo que ya está en manos del cliente).
import type { EsperadoUnidad } from '../config/productoMapeo.js';

export type TipoServicioSugerido = 'instalacion' | 'desinstalacion' | 'reparacion' | 'cambio_equipo' | 'cambio_unidad' | 'retiro_entrega';

export interface SugerenciaTipoServicio {
  tipo: TipoServicioSugerido;
  // De dónde sale: el producto es más confiable que la etiqueta. 'odoo' es el campo "Tipo de servicio" de la tarea
  // (ver tipoServicioDeOdoo): no es una sugerencia sino el tipo definido por coordinación, y el técnico no lo cambia.
  fuente: 'producto' | 'etiqueta' | 'odoo';
  // Solo con tipo 'cambio_unidad' (ver marcarCambioUnidad): qué pata es esta unidad.
  rolCambioUnidad?: 'origen' | 'destino';
}

// project.tags de Odoo (ids de producción, al 2026-10-07). A confirmar con coordinación: son las etiquetas que hoy se
// usan en la práctica, no una lista cerrada. Un id sin listar simplemente no sugiere nada.
export const ETIQUETAS_TIPO_SERVICIO: Record<number, TipoServicioSugerido> = {
  // Desinstalación
  125: 'desinstalacion', // RETIRAR EQUIPO GPS (ambigua: ver arriba)
  49: 'desinstalacion', // RETIRO DE EQUIPOS
  41: 'desinstalacion', // DESINSTALACIONES
  // Instalación
  1: 'instalacion', // Instalaciones
  56: 'instalacion', // INSTALA
  59: 'instalacion', // ISNTA
  52: 'instalacion', // Instalación gps+sensores
  140: 'instalacion', // Instalación RFID
  // Cambio de equipo
  42: 'cambio_equipo', // cambio de equipo
  102: 'cambio_equipo', // cambio de equipos
  // Reparación
  2: 'reparacion', // Reparación
  35: 'reparacion', // REPARACIÓN
  48: 'reparacion', // REPARA
  116: 'reparacion', // REPARARA
  // 'retiro_entrega' por etiqueta: pendiente de crear una etiqueta propia en Odoo (hoy "RETIRAR EQUIPO GPS" no
  // distingue el retiro en mano de la desinstalación). Mientras tanto se sugiere por producto.
};

// Campo de Odoo Studio "Tipo de servicio" (selección, obligatorio, uno por tarea). Los valores no cambian: Instalación,
// Desintalación (así, con el error de tipeo), Intervención y Cambio de Unidad. Se acepta también "Desinstalación" por si
// algún día se corrige el texto en Odoo.
export const TIPO_SERVICIO_ODOO_FIELD = 'x_studio_tipo_de_servicio';

const TIPOS_ODOO = new Map<string, TipoServicioSugerido>([
  ['instalacion', 'instalacion'],
  ['desintalacion', 'desinstalacion'],
  ['desinstalacion', 'desinstalacion'],
  ['intervencion', 'reparacion'],
  ['cambio de unidad', 'cambio_unidad'],
]);

// null = vacío (tareas viejas) o un valor que no se conoce: ahí no se fija nada y vale lo de siempre.
export function tipoServicioDeOdoo(valor: unknown): TipoServicioSugerido | null {
  if (typeof valor !== 'string') return null;
  const clave = valor.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  return TIPOS_ODOO.get(clave) ?? null;
}

// El tipo de Odoo manda sobre producto y etiqueta. Única excepción: el retiro/entrega de equipo por producto, que no es
// un PRE y no tiene valor propio en el campo. En "Cambio de Unidad" se conserva qué pata es (origen/destino) si el
// producto ya la dedujo; si no, la elige el técnico.
export function fijarTipoOdoo(sugerencia: SugerenciaTipoServicio | null, tipoOdoo: TipoServicioSugerido | null): SugerenciaTipoServicio | null {
  if (!tipoOdoo || sugerencia?.tipo === 'retiro_entrega') return sugerencia;
  if (tipoOdoo === 'cambio_unidad') {
    const rol = sugerencia?.tipo === 'cambio_unidad' ? sugerencia.rolCambioUnidad : undefined;
    return { tipo: 'cambio_unidad', fuente: 'odoo', ...(rol ? { rolCambioUnidad: rol } : {}) };
  }
  return { tipo: tipoOdoo, fuente: 'odoo' };
}

export function sugerirTipoServicio(esperado: EsperadoUnidad | null, etiquetaIds: number[]): SugerenciaTipoServicio | null {
  if (esperado) {
    if (esperado.recepcionEquipo) return { tipo: 'retiro_entrega', fuente: 'producto' };
    const instala = esperado.instalar.equipo || Object.keys(esperado.instalar.casillas).length > 0;
    const retira = esperado.retirar.equipo || Object.keys(esperado.retirar.casillas).length > 0;
    // Retirar e instalar en la MISMA unidad es una intervención (equipo nuevo en la misma unidad); un cambio de unidad
    // son dos unidades distintas, una que solo retira y otra que solo instala — ver marcarCambioUnidad.
    if (instala && retira) return { tipo: 'reparacion', fuente: 'producto' };
    if (retira) return { tipo: 'desinstalacion', fuente: 'producto' };
    if (instala) return { tipo: 'instalacion', fuente: 'producto' };
  }
  for (const id of etiquetaIds) {
    const tipo = ETIQUETAS_TIPO_SERVICIO[id];
    if (tipo) return { tipo, fuente: 'etiqueta' };
  }
  return null;
}

// Un cambio de unidad llega a Odoo como una subtarea por unidad bajo la misma tarea: una que solo desinstala el equipo
// (origen) y otra que solo instala uno nuevo (destino). Solo se marca cuando hay EXACTAMENTE una de cada una (por
// producto) — con varios pares en la misma tarea no se adivina cuál va con cuál y queda el tipo suelto de cada unidad.
export function marcarCambioUnidad(unidades: Array<{ tipoServicioSugerido: SugerenciaTipoServicio | null }>): void {
  const porProducto = (tipo: TipoServicioSugerido) =>
    unidades.filter((u) => u.tipoServicioSugerido?.fuente === 'producto' && u.tipoServicioSugerido.tipo === tipo);
  const origenes = porProducto('desinstalacion');
  const destinos = porProducto('instalacion');
  if (origenes.length !== 1 || destinos.length !== 1) return;
  origenes[0].tipoServicioSugerido = { tipo: 'cambio_unidad', fuente: 'producto', rolCambioUnidad: 'origen' };
  destinos[0].tipoServicioSugerido = { tipo: 'cambio_unidad', fuente: 'producto', rolCambioUnidad: 'destino' };
}
