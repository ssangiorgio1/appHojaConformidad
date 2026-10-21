// Lógica de la maqueta: movimientos de stock entre depósito, laboratorio y técnicos, todo en memoria (se pierde al recargar).
import {
  productoPorId,
  type ItemSerie,
  type LineaTransferencia,
  type Recambio,
  type SentidoTransferencia,
  type StockDeposito,
  type StockTecnico,
  type TransferenciaMock,
} from './mock';

export type Estado = {
  deposito: StockDeposito[];
  laboratorio: StockDeposito[];
  tecnicos: StockTecnico[];
  transferencias: TransferenciaMock[];
  recambios: Recambio[];
};

export type DatosRecambio = {
  tecnicoId: string;
  unidad: string;
  nuevoSerie: string;
  retirado: { productoId: string; serie: string; imei: string };
  fecha: string;
};

export type EstadoLab = 'en_revision' | 'en_reparacion' | 'listo';

export type Accion =
  | { tipo: 'crear'; sentido: SentidoTransferencia; tecnicoId: string; lineas: LineaTransferencia[]; fecha: string; ahora: string }
  | { tipo: 'cargar'; id: string; productoId: string }
  | { tipo: 'recibir'; id: string; ahora: string; firmas: { entrega: string; recibe: string } }
  | { tipo: 'cancelar'; id: string }
  | ({ tipo: 'recambio' } & DatosRecambio)
  | { tipo: 'labADeposito'; serie: string }
  | { tipo: 'labEstado'; serie: string; estado: EstadoLab }
  | { tipo: 'labBaja'; serie: string };

type Item = { productoId: string; cantidad?: number; series?: ItemSerie[] };

function sacar(items: Item[], l: LineaTransferencia): { items: Item[]; movidas: ItemSerie[] } {
  const movidas: ItemSerie[] = [];
  const nuevos = items.map((i) => {
    if (i.productoId !== l.productoId) return i;
    if (i.series) {
      const ids = l.series ?? [];
      movidas.push(...i.series.filter((s) => ids.includes(s.serie)));
      return { ...i, series: i.series.filter((s) => !ids.includes(s.serie)) };
    }
    return { ...i, cantidad: (i.cantidad ?? 0) - l.cantidad };
  });
  return { items: nuevos, movidas };
}

function poner(items: Item[], l: LineaTransferencia, movidas: ItemSerie[]): Item[] {
  const serializado = productoPorId(l.productoId).tipo === 'serializado';
  if (!items.some((i) => i.productoId === l.productoId)) {
    return [...items, serializado ? { productoId: l.productoId, series: movidas } : { productoId: l.productoId, cantidad: l.cantidad }];
  }
  return items.map((i) =>
    i.productoId !== l.productoId ? i : serializado ? { ...i, series: [...(i.series ?? []), ...movidas] } : { ...i, cantidad: (i.cantidad ?? 0) + l.cantidad },
  );
}

function aplicarRecepcion(estado: Estado, t: TransferenciaMock, nombreTecnico: string): Pick<Estado, 'deposito' | 'laboratorio' | 'tecnicos'> {
  let deposito: Item[] = estado.deposito;
  let laboratorio: Item[] = estado.laboratorio;
  let propio: Item[] = estado.tecnicos.filter((s) => s.tecnicoId === t.tecnicoId);
  const ajenos = estado.tecnicos.filter((s) => s.tecnicoId !== t.tecnicoId);

  for (const l of t.lineas) {
    if (t.sentido === 'a_tecnico') {
      const r = sacar(deposito, l);
      deposito = r.items;
      propio = poner(propio, l, r.movidas.map((s) => ({ ...s, estado: 'en_tecnico' as const, nota: undefined })));
    } else {
      const r = sacar(propio, l);
      propio = r.items;
      if (productoPorId(l.productoId).tipo === 'cantidad') {
        deposito = poner(deposito, l, []);
        continue;
      }
      // Lo retirado de una unidad va al laboratorio; lo que el técnico no usó vuelve al depósito.
      const retirados = r.movidas.filter((s) => s.estado === 'retirado');
      const sinUsar = r.movidas.filter((s) => s.estado !== 'retirado');
      if (retirados.length) {
        laboratorio = poner(
          laboratorio,
          { productoId: l.productoId, cantidad: retirados.length },
          retirados.map((s) => ({ ...s, estado: 'en_revision' as const, nota: `${s.nota ?? 'Retirado de unidad'} · trae ${nombreTecnico}` })),
        );
      }
      if (sinUsar.length) {
        deposito = poner(deposito, { productoId: l.productoId, cantidad: sinUsar.length }, sinUsar.map((s) => ({ ...s, estado: 'disponible' as const, nota: undefined })));
      }
    }
  }
  return {
    deposito: deposito as StockDeposito[],
    laboratorio: laboratorio as StockDeposito[],
    tecnicos: [...ajenos, ...propio.map((i) => ({ ...i, tecnicoId: t.tecnicoId }))],
  };
}

function buscarEnLab(lab: StockDeposito[], serie: string) {
  for (const i of lab) {
    const s = i.series?.find((x) => x.serie === serie);
    if (s) return { productoId: i.productoId, s };
  }
  return null;
}

export function reducer(estado: Estado, a: Accion, nombreTecnico: (id: string) => string): Estado {
  switch (a.tipo) {
    case 'crear': {
      const n = Math.max(...estado.transferencias.map((t) => Number(t.id.slice(2))), 0) + 1;
      const t: TransferenciaMock = {
        id: `T-${String(n).padStart(4, '0')}`,
        fecha: a.fecha,
        tecnicoId: a.tecnicoId,
        sentido: a.sentido,
        estado: 'pendiente',
        lineas: a.lineas,
        cargadas: [],
        hitos: { creada: a.ahora },
      };
      return { ...estado, transferencias: [t, ...estado.transferencias] };
    }
    case 'cargar':
      return {
        ...estado,
        transferencias: estado.transferencias.map((t) =>
          t.id !== a.id || t.estado !== 'pendiente'
            ? t
            : { ...t, cargadas: t.cargadas.includes(a.productoId) ? t.cargadas.filter((p) => p !== a.productoId) : [...t.cargadas, a.productoId] },
        ),
      };
    case 'cancelar':
      return { ...estado, transferencias: estado.transferencias.filter((t) => t.id !== a.id) };
    case 'recibir': {
      const t = estado.transferencias.find((x) => x.id === a.id);
      if (!t || t.estado === 'recibida' || !t.lineas.every((l) => t.cargadas.includes(l.productoId))) return estado;
      const stock = aplicarRecepcion(estado, t, nombreTecnico(t.tecnicoId));
      return { ...estado, ...stock, transferencias: estado.transferencias.map((x) => (x.id === a.id ? { ...x, estado: 'recibida', firmas: a.firmas, hitos: { ...x.hitos, recibida: a.ahora } } : x)) };
    }
    case 'recambio': {
      // Sale el equipo nuevo del inventario del técnico (queda instalado en la unidad) y entra el retirado, que el técnico trae al laboratorio.
      const propio: Item[] = estado.tecnicos.filter((s) => s.tecnicoId === a.tecnicoId);
      const ajenos = estado.tecnicos.filter((s) => s.tecnicoId !== a.tecnicoId);
      const origen = propio.find((i) => i.series?.some((s) => s.serie === a.nuevoSerie));
      const nuevo = origen?.series?.find((s) => s.serie === a.nuevoSerie);
      if (!origen || !nuevo) return estado;
      const sinNuevo = sacar(propio, { productoId: origen.productoId, cantidad: 1, series: [a.nuevoSerie] }).items;
      const conRetirado = poner(
        sinNuevo,
        { productoId: a.retirado.productoId, cantidad: 1 },
        [{ serie: a.retirado.serie, imei: a.retirado.imei, estado: 'retirado', nota: `Retirado de ${a.unidad}` }],
      );
      const n = Math.max(...estado.recambios.map((r) => Number(r.id.slice(3))), 0) + 1;
      const recambio: Recambio = {
        id: `RC-${String(n).padStart(4, '0')}`,
        fecha: a.fecha,
        tecnicoId: a.tecnicoId,
        unidad: a.unidad,
        nuevo: { productoId: origen.productoId, serie: nuevo.serie, imei: nuevo.imei },
        retirado: a.retirado,
      };
      return {
        ...estado,
        tecnicos: [...ajenos, ...conRetirado.map((i) => ({ ...i, tecnicoId: a.tecnicoId }))],
        recambios: [recambio, ...estado.recambios],
      };
    }
    case 'labADeposito': {
      const f = buscarEnLab(estado.laboratorio, a.serie);
      if (!f) return estado;
      const lab = sacar(estado.laboratorio, { productoId: f.productoId, cantidad: 1, series: [a.serie] }).items;
      const dep = poner(estado.deposito, { productoId: f.productoId, cantidad: 1 }, [{ ...f.s, estado: 'disponible', nota: undefined }]);
      return { ...estado, laboratorio: lab as StockDeposito[], deposito: dep as StockDeposito[] };
    }
    case 'labEstado':
      return {
        ...estado,
        laboratorio: estado.laboratorio.map((i) =>
          i.series ? { ...i, series: i.series.map((s) => (s.serie === a.serie ? { ...s, estado: a.estado } : s)) } : i,
        ),
      };
    case 'labBaja': {
      const f = buscarEnLab(estado.laboratorio, a.serie);
      if (!f) return estado;
      return { ...estado, laboratorio: sacar(estado.laboratorio, { productoId: f.productoId, cantidad: 1, series: [a.serie] }).items as StockDeposito[] };
    }
  }
}

// Lo ya prometido en transferencias abiertas desde un origen, para no comprometer dos veces lo mismo.
function comprometido(estado: Estado, sentido: SentidoTransferencia, tecnicoId: string, productoId: string) {
  const series = new Set<string>();
  let cantidad = 0;
  for (const t of estado.transferencias) {
    if (t.estado === 'recibida' || t.sentido !== sentido) continue;
    if (sentido === 'a_deposito' && t.tecnicoId !== tecnicoId) continue;
    for (const l of t.lineas) {
      if (l.productoId !== productoId) continue;
      cantidad += l.cantidad;
      l.series?.forEach((s) => series.add(s));
    }
  }
  return { series, cantidad };
}

export type DisponibleOrigen = { productoId: string; cantidad: number; series?: ItemSerie[] };

// Qué se puede sacar hoy del origen: el depósito solo tiene equipos disponibles; del técnico sale todo lo que tiene
// (nuevos sin usar y retirados de unidades) que no esté ya en otra transferencia abierta.
export function disponiblesOrigen(estado: Estado, sentido: SentidoTransferencia, tecnicoId: string): DisponibleOrigen[] {
  const fuente: Item[] = sentido === 'a_tecnico' ? estado.deposito : estado.tecnicos.filter((s) => s.tecnicoId === tecnicoId);
  const res: DisponibleOrigen[] = [];
  for (const i of fuente) {
    const c = comprometido(estado, sentido, tecnicoId, i.productoId);
    if (i.series) {
      const series = i.series.filter((s) => !c.series.has(s.serie));
      if (series.length) res.push({ productoId: i.productoId, cantidad: series.length, series });
    } else {
      const cantidad = (i.cantidad ?? 0) - c.cantidad;
      if (cantidad > 0) res.push({ productoId: i.productoId, cantidad });
    }
  }
  return res;
}
