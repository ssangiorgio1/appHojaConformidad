import type { TipoServicio } from './types.js';

// The two legs of a cambio_equipo del esquema VIEJO (2 hojas vinculadas,
// cambioEquipo.rol seteado) son, en efecto, una desinstalación y una
// instalación planas — ver el retiro/instalacion de abajo. El esquema NUEVO
// de cambio_equipo (una sola hoja, cambioEquipo.rol sin setear) es un modo
// propio: pide evidencia de equipo retirado E instalado en el mismo POST —
// ver photoSlots.ts. cambioEquipo.rol sigue existiendo solo para leer hojas
// viejas, no se escribe más al crear una hoja nueva.
export type ServiceMode = 'instalacion' | 'retiro' | 'reparacion' | 'cambio_equipo';

export function getServiceMode(record: {
  tipoServicio: TipoServicio | null;
  cambioEquipo?: { rol?: 'retiro' | 'instalacion' | null } | null;
}): ServiceMode {
  if (record.tipoServicio === 'cambio_equipo') {
    if (record.cambioEquipo?.rol === 'retiro') return 'retiro';
    if (record.cambioEquipo?.rol === 'instalacion') return 'instalacion';
    return 'cambio_equipo';
  }
  if (record.tipoServicio === 'desinstalacion') return 'retiro';
  if (record.tipoServicio === 'reparacion') return 'reparacion';
  return 'instalacion';
}
