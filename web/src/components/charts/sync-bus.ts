// Cursor compartido entre gráficos sin pasar por el estado de React: el gráfico bajo el mouse hace
// `emit(instante)` y los demás (suscriptos) mueven su tooltip directamente. Así un movimiento del
// mouse no vuelve a renderizar el componente padre ni los gráficos que no cambian.
export interface SyncBus {
  emit: (t: number | null) => void;
  subscribe: (fn: (t: number | null) => void) => () => void;
}

export function createSyncBus(): SyncBus {
  const subs = new Set<(t: number | null) => void>();
  return {
    emit: (t) => subs.forEach((fn) => fn(t)),
    subscribe: (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}
