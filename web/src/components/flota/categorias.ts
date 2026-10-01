import type { FlotaCategoria } from '@/lib/types';

// Las etiquetas siguen el estado que muestra bo3 en el cliente: "baja" y "corte de servicio"
// (flag `corte_de_servicio`). Orden = prioridad de atención para coordinación: primero lo cortado
// que sigue transmitiendo, después las fallas técnicas por antigüedad, al final lo sano.
export const FLOTA_CATEGORIAS_ORDEN: FlotaCategoria[] = [
  'corte_reportando',
  'corte_sin_reportar',
  'baja_con_corte',
  'baja',
  'sin_reportar_72h',
  'sin_reportar_48h',
  'sin_reportar_24h',
  'activo_reportando',
];

export const FLOTA_CATEGORIA_LABEL: Record<FlotaCategoria, string> = {
  corte_reportando: 'Corte de servicio, sigue reportando',
  corte_sin_reportar: 'Corte de servicio, sin reportar',
  baja_con_corte: 'Baja con corte de servicio',
  baja: 'Baja',
  sin_reportar_72h: 'Activo, sin reportar +72 h',
  sin_reportar_48h: 'Activo, sin reportar 48–72 h',
  sin_reportar_24h: 'Activo, sin reportar 24–48 h',
  activo_reportando: 'Activo, reportando',
};

export const FLOTA_CATEGORIA_DESC: Record<FlotaCategoria, string> = {
  corte_reportando: 'Cliente con corte de servicio, pero el equipo transmitió en las últimas 24 h.',
  corte_sin_reportar: 'Cliente con corte de servicio y el equipo no reporta hace más de 24 h.',
  baja_con_corte: 'Unidad o cliente de baja, y el cliente además tiene corte de servicio.',
  baja: 'Unidad o cliente de baja, sin corte de servicio.',
  sin_reportar_72h: 'Cliente activo (sin corte) cuyo equipo no reporta hace más de 72 h (o nunca reportó).',
  sin_reportar_48h: 'Cliente activo (sin corte) cuyo equipo no reporta hace entre 48 y 72 h.',
  sin_reportar_24h: 'Cliente activo (sin corte) cuyo equipo no reporta hace entre 24 y 48 h.',
  activo_reportando: 'Cliente activo (sin corte) y el equipo reportó en las últimas 24 h.',
};

export const FLOTA_CATEGORIA_COLOR: Record<FlotaCategoria, string> = {
  corte_reportando: '#b61e16',
  corte_sin_reportar: '#763597',
  baja_con_corte: '#3f3f46',
  baja: '#9ca3af',
  sin_reportar_72h: '#7c2d12',
  sin_reportar_48h: '#d9691c',
  sin_reportar_24h: '#e0a020',
  activo_reportando: '#38946e',
};
