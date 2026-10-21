// Ordena unidades para recorrerlas saliendo de un punto (la oficina): primero la más cercana a ese punto y de ahí
// siempre a la más cercana que falta, así la lista se lee como un recorrido y no salta de un extremo al otro.
// Sin punto de partida arranca por la más alejada del centro del grupo. Las que no tienen posición van al final.
interface ConPosicion {
  latitud: number;
  longitud: number;
}

/** Distancia en línea recta, en km. */
export function kmEntre(a: ConPosicion, b: ConPosicion): number {
  const R = 6371;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.latitud - a.latitud);
  const dLng = rad(b.longitud - a.longitud);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitud)) * Math.cos(rad(b.latitud)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function ordenarPorCercania<T>(items: T[], posicion: (item: T) => ConPosicion, origen?: ConPosicion): T[] {
  const validos = items.filter((i) => Number.isFinite(posicion(i).latitud) && Number.isFinite(posicion(i).longitud));
  const sinPosicion = items.filter((i) => !validos.includes(i));
  if (validos.length <= (origen ? 1 : 2)) return [...validos, ...sinPosicion];

  const centro = {
    latitud: validos.reduce((n, i) => n + posicion(i).latitud, 0) / validos.length,
    longitud: validos.reduce((n, i) => n + posicion(i).longitud, 0) / validos.length,
  };
  const pendientes = [...validos];
  let actual = origen
    ? pendientes.reduce((mejor, i) => (kmEntre(posicion(i), origen) < kmEntre(posicion(mejor), origen) ? i : mejor))
    : pendientes.reduce((mejor, i) => (kmEntre(posicion(i), centro) > kmEntre(posicion(mejor), centro) ? i : mejor));
  const orden: T[] = [];
  while (true) {
    orden.push(actual);
    pendientes.splice(pendientes.indexOf(actual), 1);
    if (pendientes.length === 0) break;
    actual = pendientes.reduce((mejor, i) => (kmEntre(posicion(i), posicion(actual)) < kmEntre(posicion(mejor), posicion(actual)) ? i : mejor));
  }
  return [...orden, ...sinPosicion];
}

/**
 * Ordena por zona de radio (de la más cercana a la oficina a la más lejana) y, dentro de cada zona, como
 * recorrido: primero la más cercana al último punto visitado y de ahí a la más cercana que falte.
 */
export function ordenarPorAnillos<T>(items: T[], posicion: (item: T) => ConPosicion, origen: ConPosicion, anillo: (km: number) => number): T[] {
  const validos = items.filter((i) => Number.isFinite(posicion(i).latitud) && Number.isFinite(posicion(i).longitud));
  const sinPosicion = items.filter((i) => !validos.includes(i));
  const grupos = new Map<number, T[]>();
  for (const i of validos) {
    const a = anillo(kmEntre(origen, posicion(i)));
    grupos.set(a, [...(grupos.get(a) ?? []), i]);
  }
  const salida: T[] = [];
  let desde: ConPosicion = origen;
  for (const a of [...grupos.keys()].sort((x, y) => x - y)) {
    const cadena = ordenarPorCercania(grupos.get(a) ?? [], posicion, desde);
    salida.push(...cadena);
    if (cadena.length > 0) desde = posicion(cadena[cadena.length - 1]);
  }
  return [...salida, ...sinPosicion];
}
