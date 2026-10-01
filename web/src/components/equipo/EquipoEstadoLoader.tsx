'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { getEstadoEquipo } from '@/lib/api';
import type { EstadoEquipo } from '@/lib/types';
import { EstadoEquipoView } from './EstadoEquipoView';

// Carga y muestra el estado en vivo de UN equipo (bo3). Se consulta recién al montarse: quien lo
// use decide cuándo (panel abierto, fila desplegada) — nunca en lote.
export function EquipoEstadoLoader({ equipoId }: { equipoId: number }) {
  const { getIdToken } = useAuth();
  const [estado, setEstado] = useState<EstadoEquipo | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const cargar = useCallback(
    async (forzar: boolean) => {
      const id = ++reqId.current;
      setCargando(true);
      setError(null);
      try {
        const data = await getEstadoEquipo(await getIdToken(), equipoId, forzar);
        if (id === reqId.current) setEstado(data);
      } catch (err) {
        if (id === reqId.current) setError((err as Error).message);
      } finally {
        if (id === reqId.current) setCargando(false);
      }
    },
    [equipoId, getIdToken],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga el equipo al abrir/cambiar
    setEstado(null);
    void cargar(false);
  }, [cargar]);

  return (
    <>
      {error && <div className="text-sm font-medium text-danger-700">{error}</div>}
      {!estado && cargando && <div className="text-sm text-muted">Consultando a VisionBLO…</div>}
      {estado && <EstadoEquipoView estado={estado} cargando={cargando} onActualizar={() => cargar(true)} compact />}
    </>
  );
}
