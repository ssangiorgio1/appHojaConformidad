'use client';

import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/auth/AuthContext';
import { EstadoEquipoView } from '@/components/equipo/EstadoEquipoView';
import { GraficasEquipo } from '@/components/equipo/GraficasEquipo';
import { QrScanButton } from '@/components/equipo/QrEquipoScanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { IconSearch } from '@/components/ui/Icons';
import { buscarEquipos, getEstadoEquipo } from '@/lib/api';
import type { EquipoCoincidencia, EstadoEquipo } from '@/lib/types';

// Consulta en vivo de UN equipo contra bo3 (diagnóstico + módulos + historial). Nunca en lote:
// sólo se pide el equipo que se busca o el que se abre desde el mapa (?equipo=<id>).
function AtilioContenido() {
  const { getIdToken } = useAuth();
  const params = useSearchParams();
  const equipoInicial = Number(params.get('equipo')) || null;

  const [texto, setTexto] = useState('');
  const [coincidencias, setCoincidencias] = useState<EquipoCoincidencia[] | null>(null);
  const [estado, setEstado] = useState<EstadoEquipo | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const abrirEquipo = useCallback(
    async (equipoId: number, forzar = false) => {
      const id = ++reqId.current;
      setCargando(true);
      setError(null);
      setCoincidencias(null);
      try {
        const data = await getEstadoEquipo(await getIdToken(), equipoId, forzar);
        if (id === reqId.current) setEstado(data);
      } catch (err) {
        if (id === reqId.current) setError((err as Error).message);
      } finally {
        if (id === reqId.current) setCargando(false);
      }
    },
    [getIdToken],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- abre el equipo del ?equipo= al montar
    if (equipoInicial) void abrirEquipo(equipoInicial);
  }, [equipoInicial, abrirEquipo]);

  function onSubmitBuscar(e: FormEvent) {
    e.preventDefault();
    void buscar(texto);
  }

  async function buscar(consulta: string) {
    const q = consulta.trim();
    if (q.length < 3) {
      setError('Escribí al menos 3 caracteres (serie, IMEI, patente o nombre de unidad).');
      return;
    }
    const id = ++reqId.current;
    setCargando(true);
    setError(null);
    setEstado(null);
    try {
      const res = await buscarEquipos(await getIdToken(), q);
      if (id !== reqId.current) return;
      if (res.length === 0) {
        setCoincidencias([]);
      } else if (res.length === 1) {
        setCargando(false);
        await abrirEquipo(res[0].equipoId);
        return;
      } else {
        setCoincidencias(res);
      }
    } catch (err) {
      if (id === reqId.current) setError((err as Error).message);
    } finally {
      if (id === reqId.current) setCargando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-extrabold text-text">Atilio</h1>
        <p className="text-sm text-muted">Estado de reporte y módulos de un equipo, en vivo desde VisionBLO.</p>
      </div>

      <Card className="p-4">
        <form onSubmit={onSubmitBuscar} className="flex flex-wrap items-center gap-3">
          <Input
            className="max-w-md"
            placeholder="Serie, IMEI, patente o nombre de unidad…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <Button type="submit" disabled={cargando}>
            <IconSearch /> {cargando ? 'Consultando…' : 'Consultar'}
          </Button>
          <QrScanButton
            onScan={({ numEquipo, imei }) => {
              // Si el QR trajo solo el IMEI y no se resolvió el número, la búsqueda también resuelve por IMEI.
              const consulta = numEquipo || imei;
              setTexto(consulta);
              void buscar(consulta);
            }}
          />
        </form>
      </Card>

      {error && <Card className="p-4 text-sm font-medium text-danger-700">{error}</Card>}

      {coincidencias && coincidencias.length === 0 && (
        <Card className="p-4 text-sm text-muted">No se encontró ningún equipo con ese dato.</Card>
      )}

      {coincidencias && coincidencias.length > 1 && (
        <Card className="flex flex-col gap-1 p-2">
          <div className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted">
            {coincidencias.length} coincidencias — elegí una
          </div>
          {coincidencias.map((c) => (
            <button
              key={c.equipoId}
              type="button"
              onClick={() => abrirEquipo(c.equipoId)}
              className="rounded-md px-3 py-2 text-left text-sm font-medium text-text transition hover:bg-neutral-100"
            >
              {c.descripcion}
            </button>
          ))}
        </Card>
      )}

      {estado && <EstadoEquipoView estado={estado} cargando={cargando} onActualizar={() => abrirEquipo(estado.equipoId, true)} />}
      {estado && (
        <Card className="p-5">
          <GraficasEquipo key={estado.equipoId} equipoId={estado.equipoId} />
        </Card>
      )}
    </div>
  );
}

export default function AtilioPage() {
  return (
    <Suspense fallback={null}>
      <AtilioContenido />
    </Suspense>
  );
}
