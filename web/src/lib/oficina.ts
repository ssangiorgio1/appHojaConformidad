// Punto de partida de los técnicos: la oficina de WARA, en Ciudad de Mendoza, sobre Av. Juan B. Justo, casi
// llegando a Paso de los Andes. Las coordenadas son aproximadas (esquina de esas dos calles, un poco al este):
// ajustarlas acá si hace falta; las usan el orden por cercanía y la distancia que se muestra en las listas.
export const OFICINA = {
  nombre: 'Oficina (Juan B. Justo, casi Paso de los Andes)',
  latitud: -32.8838,
  longitud: -68.857,
} as const;

// Zonas por radio: círculos concentrados en la oficina, medidos en línea recta (km). Cada anillo es una zona
// de tarifa: la primera llega hasta el primer radio, la última es "más de" el último. VALORES PROVISORIOS:
// cambiarlos acá para ver el efecto en las listas y en el mapa (más adelante podrían salir de una pantalla).
export const RADIOS_KM: readonly number[] = [10, 25, 50, 100];

export interface ZonaRadio {
  /** 0 = la más cercana a la oficina. */
  indice: number;
  nombre: string;
  rango: string;
}

export function zonaPorRadio(km: number): ZonaRadio {
  let indice = RADIOS_KM.findIndex((r) => km <= r);
  if (indice === -1) indice = RADIOS_KM.length;
  const desde = indice === 0 ? 0 : RADIOS_KM[indice - 1];
  const rango = indice === RADIOS_KM.length ? `más de ${desde} km` : `${desde} a ${RADIOS_KM[indice]} km`;
  return { indice, nombre: `Zona ${indice + 1}`, rango };
}
