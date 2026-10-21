// Recorrido por calle listo para dibujar en los mapas de zonas: la traza y las paradas numeradas de cada técnico.
export interface RutaMapa {
  /** Etiqueta del técnico (o "Recorrido" si es uno solo sin nombre). */
  etiqueta: string;
  /** Color de la traza y de las paradas. */
  color: string;
  /** [longitud, latitud]. */
  geometria: Array<[number, number]>;
  paradas: Array<{ posicion: number; latitud: number; longitud: number; titulo: string }>;
}

// Un color por técnico (distinguibles entre sí sobre el mapa claro y el satélite).
export const COLORES_TECNICO = ['#2563eb', '#d97706', '#16a34a', '#9333ea', '#dc2626', '#0891b2', '#be185d', '#4b5563'] as const;
export const colorTecnico = (indice: number) => COLORES_TECNICO[indice % COLORES_TECNICO.length];
