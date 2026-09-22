import type { TipoServicio } from './types.js';

// The two legs of a cambio_equipo are, in effect, a plain desinstalación and
// a plain instalación — instead of branching the wizard on the 4 raw
// TipoServicio values, it branches on this 3-value effective mode.
export type ServiceMode = 'instalacion' | 'retiro' | 'reparacion';

export function getServiceMode(record: {
  tipoServicio: TipoServicio | null;
  cambioEquipo?: { rol?: 'retiro' | 'instalacion' | null } | null;
}): ServiceMode {
  if (record.tipoServicio === 'cambio_equipo') {
    return record.cambioEquipo?.rol === 'retiro' ? 'retiro' : 'instalacion';
  }
  if (record.tipoServicio === 'desinstalacion') return 'retiro';
  if (record.tipoServicio === 'reparacion') return 'reparacion';
  return 'instalacion';
}
