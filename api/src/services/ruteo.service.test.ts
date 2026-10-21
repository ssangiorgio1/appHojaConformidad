import { describe, expect, it } from 'vitest';
import { interpretarTrip, ordenMasCercano, repartirConTerritorios, repartirPorBarrido, recortarVia } from './ruteo.service.js';

describe('interpretarTrip', () => {
  const puntos = [
    { id: 'a', latitud: -33, longitud: -68 },
    { id: 'b', latitud: -34, longitud: -68 },
    { id: 'c', latitud: -35, longitud: -68 },
  ];
  // waypoints: [origen, a, b, c] con su posición en el recorrido (origen 0, luego c, a, b).
  const resp = {
    trips: [
      {
        distance: 100_000,
        duration: 6_000,
        legs: [
          { distance: 30_000, duration: 1_800 },
          { distance: 20_000, duration: 1_200 },
          { distance: 50_000, duration: 3_000 },
        ],
      },
    ],
    waypoints: [{ waypoint_index: 0 }, { waypoint_index: 2 }, { waypoint_index: 3 }, { waypoint_index: 1 }],
  };

  it('ordena las paradas por su posición y reparte los tramos', () => {
    const r = interpretarTrip(resp, puntos, false);
    expect(r.paradas.map((p) => p.id)).toEqual(['c', 'a', 'b']);
    expect(r.paradas.map((p) => p.kmDesdeAnterior)).toEqual([30, 20, 50]);
    expect(r.paradas.map((p) => p.kmAcumulado)).toEqual([30, 50, 100]);
    expect(r.totalKm).toBe(100);
    expect(r.totalMin).toBe(100);
    expect(r.vuelta).toBeNull();
    expect(r.geometria).toEqual([]);
  });

  it('trae la traza para dibujarla', () => {
    const conTraza = { ...resp, trips: [{ ...resp.trips[0], geometry: { coordinates: [[-68, -33], [-68, -35]] as Array<[number, number]> } }] };
    expect(interpretarTrip(conTraza, puntos, false).geometria).toEqual([[-68, -33], [-68, -35]]);
  });

  it('con vuelta separa el tramo de regreso', () => {
    const conVuelta = { ...resp, trips: [{ ...resp.trips[0], legs: [...resp.trips[0].legs, { distance: 40_000, duration: 2_400 }] }] };
    const r = interpretarTrip(conVuelta, puntos, true);
    expect(r.vuelta).toEqual({ km: 40, min: 40 });
    expect(r.paradas).toHaveLength(3);
  });

  it('falla si no hay recorrido', () => {
    expect(() => interpretarTrip({ trips: [], waypoints: [] }, puntos, false)).toThrow(/recorrido/);
  });
});

describe('repartirPorBarrido', () => {
  const oficina = { latitud: -32.88, longitud: -68.86 };
  const punto = (id: string, dLat: number, dLng: number) => ({ id, latitud: oficina.latitud + dLat, longitud: oficina.longitud + dLng });
  // Dos al norte, dos al sur, dos al este, dos al oeste.
  const puntos = [
    punto('n1', 0.3, 0.01), punto('n2', 0.5, -0.01),
    punto('s1', -0.3, 0.01), punto('s2', -0.6, -0.01),
    punto('e1', 0.01, 0.3), punto('e2', -0.01, 0.6),
    punto('o1', 0.01, -0.3), punto('o2', -0.01, -0.6),
  ];

  it('con un solo técnico devuelve todo junto', () => {
    expect(repartirPorBarrido(oficina, puntos, 1)).toEqual([puntos]);
  });

  it('reparte sin perder ni repetir puntos y ningún técnico queda vacío', () => {
    const g = repartirPorBarrido(oficina, puntos, 3);
    expect(g).toHaveLength(3);
    expect(g.every((x) => x.length > 0)).toBe(true);
    expect(g.flat().map((p) => p.id).sort()).toEqual(puntos.map((p) => p.id).sort());
  });

  it('equilibra la carga: unas pocas unidades lejanas pesan como varias cercanas', () => {
    const cerca = Array.from({ length: 6 }, (_, i) => punto(`c${i}`, 0.01 * (i + 1), 0.02));
    const lejos = [punto('l1', 1.5, 0.05), punto('l2', 1.6, 0.04)];
    const g = repartirPorBarrido(oficina, [...cerca, ...lejos], 2);
    const ids = (x: { id: string | number }[]) => x.map((p) => p.id);
    expect(ids(g.find((x) => x.some((p) => p.id === 'l1')) ?? [])).toContain('l2');
    const conLejos = g.find((x) => x.some((p) => p.id === 'l1')) ?? [];
    expect(conLejos.length).toBeLessThan(g.flat().length - conLejos.length);
  });

  it('cada grupo es una porción continua del mapa: los puntos del mismo lado quedan juntos', () => {
    const g = repartirPorBarrido(oficina, puntos, 4);
    const lado = (id: string) => g.findIndex((x) => x.some((p) => p.id === id));
    expect(lado('n1')).toBe(lado('n2'));
    expect(lado('s1')).toBe(lado('s2'));
    expect(lado('e1')).toBe(lado('e2'));
    expect(lado('o1')).toBe(lado('o2'));
    expect(new Set(['n1', 's1', 'e1', 'o1'].map(lado)).size).toBe(4);
  });

  it('no arma más grupos que puntos', () => {
    expect(repartirPorBarrido(oficina, puntos.slice(0, 2), 5)).toHaveLength(2);
  });
});

describe('ordenMasCercano', () => {
  // 0 = origen. 1 cerca del origen, 2 cerca de 1, 3 lejos de todos.
  const d = [
    [0, 5, 20, 90],
    [5, 0, 8, 80],
    [20, 8, 0, 60],
    [90, 80, 60, 0],
  ];

  it('va siempre a la más cercana de las que faltan: de lo cercano a lo lejano', () => {
    expect(ordenMasCercano(d)).toEqual([1, 2, 3]);
  });

  it('no deja una cercana para el final aunque convenga al total', () => {
    // Desde el origen, la 2 está a 4 y la 1 a 10; después de la 2, la 1 está a 1.
    const m = [
      [0, 10, 4, 50],
      [10, 0, 1, 45],
      [4, 1, 0, 48],
      [50, 45, 48, 0],
    ];
    expect(ordenMasCercano(m)).toEqual([2, 1, 3]);
  });

  it('manda al final los puntos sin camino (distancia null)', () => {
    const m = [
      [0, null, 7],
      [null, 0, null],
      [7, null, 0],
    ];
    expect(ordenMasCercano(m)).toEqual([2, 1]);
  });
});

describe('ordenMasCercano con primera visita elegida', () => {
  const d = [
    [0, 5, 20, 90],
    [5, 0, 8, 80],
    [20, 8, 0, 60],
    [90, 80, 60, 0],
  ];
  it('arranca en la elegida y sigue por cercanía desde ahí', () => {
    // Elegida la 2: desde la 2 la más cercana es la 1 (8) y después la 3.
    expect(ordenMasCercano(d, 2)).toEqual([2, 1, 3]);
  });
  it('si la elegida es la 3 sigue por la más cercana a ella (la 2, luego la 1)', () => {
    expect(ordenMasCercano(d, 3)).toEqual([3, 2, 1]);
  });
});

describe('repartirConTerritorios', () => {
  const oficina = { latitud: -32.88, longitud: -68.86 };
  const p = (id: string, dLat: number, dLng: number, tecnico?: number | number[]) => ({ id, latitud: oficina.latitud + dLat, longitud: oficina.longitud + dLng, tecnicos: tecnico === undefined ? undefined : Array.isArray(tecnico) ? tecnico : [tecnico] });

  it('los puntos con territorio van a su técnico y el resto a los que no tienen', () => {
    const puntos = [p('a', 0.5, 0, 0), p('b', 0.6, 0.01, 0), p('x', -0.5, 0), p('y', -0.6, 0.01), p('z', 0.01, 0.6)];
    const g = repartirConTerritorios(oficina, puntos, 3);
    expect(g[0].map((q) => q.id).sort()).toEqual(['a', 'b']);
    // El técnico 0 tiene territorio: x, y, z se reparten entre los técnicos 1 y 2.
    expect([...g[1], ...g[2]].map((q) => q.id).sort()).toEqual(['x', 'y', 'z']);
    expect(g[1].length).toBeGreaterThan(0);
    expect(g[2].length).toBeGreaterThan(0);
  });

  it('si todos los técnicos tienen territorio, lo libre va al técnico con el grupo más cercano', () => {
    const puntos = [p('n1', 0.5, 0, 0), p('s1', -0.5, 0, 1), p('libre-norte', 0.45, 0.02), p('libre-sur', -0.55, 0.02)];
    const g = repartirConTerritorios(oficina, puntos, 2);
    expect(g[0].map((q) => q.id).sort()).toEqual(['libre-norte', 'n1']);
    expect(g[1].map((q) => q.id).sort()).toEqual(['libre-sur', 's1']);
  });

  it('un técnico sin nada asignado ni libres queda con su grupo vacío', () => {
    const g = repartirConTerritorios(oficina, [p('a', 0.5, 0, 0)], 2);
    expect(g[1]).toEqual([]);
  });
});

describe('repartirConTerritorios: zona compartida por varios técnicos', () => {
  const oficina = { latitud: -32.88, longitud: -68.86 };
  const punto = (id: string, dLat: number, dLng: number, tecnicos?: number[]) => ({ id, latitud: oficina.latitud + dLat, longitud: oficina.longitud + dLng, tecnicos });

  it('dos técnicos en la misma zona se reparten sus unidades', () => {
    // Seis unidades de la misma zona (norte), compartida por los técnicos 0 y 1; el técnico 2 no tiene zona.
    const zona = [0.2, 0.25, 0.3, 0.35, 0.4, 0.45].map((d, i) => punto(`n${i}`, d, (i % 2 ? 1 : -1) * 0.02 * (i + 1), [0, 1]));
    const g = repartirConTerritorios(oficina, [...zona, punto('libre', -0.4, 0)], 3);
    expect(g[0].length).toBeGreaterThan(0);
    expect(g[1].length).toBeGreaterThan(0);
    expect(g[0].length + g[1].length).toBeGreaterThanOrEqual(6);
    // El técnico 2 se queda con lo que no tiene dueño.
    expect(g[2].map((q) => q.id)).toEqual(['libre']);
    // Ninguna unidad se pierde ni se repite.
    expect(g.flat().map((q) => q.id).sort()).toEqual([...zona.map((q) => q.id), 'libre'].sort());
  });

  it('el reparto de una zona compartida es parejo en cantidad', () => {
    const zona = Array.from({ length: 8 }, (_, i) => punto(`z${i}`, 0.2 + i * 0.01, 0.01 * i, [0, 1]));
    const g = repartirConTerritorios(oficina, zona, 2);
    expect(Math.abs(g[0].length - g[1].length)).toBeLessThanOrEqual(2);
  });

  it('una zona de un solo técnico no se comparte', () => {
    const g = repartirConTerritorios(oficina, [punto('a', 0.3, 0, [1]), punto('b', 0.31, 0, [1])], 2);
    expect(g[1]).toHaveLength(2);
    expect(g[0]).toHaveLength(0);
  });
});

describe('recortarVia', () => {
  const via: Array<[number, number]> = [[-58.4, -34.6], [-58.6, -34.6], [-58.8, -34.6]];
  const desde = { latitud: -34.6, longitud: -58.38 };
  it('corta en el punto clave más cercano a la visita más lejana', () => {
    const grupo = [{ id: 1, latitud: -34.61, longitud: -58.45 }, { id: 2, latitud: -34.6, longitud: -58.62 }];
    expect(recortarVia(via, grupo, desde)).toEqual([via[0], via[1]]);
  });
  it('sin visitas no fuerza ningún paso', () => {
    expect(recortarVia(via, [], desde)).toEqual([]);
  });
});
