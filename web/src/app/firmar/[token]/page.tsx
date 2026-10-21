'use client';

import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FirmaPad } from '@/app/(dashboard)/deposito/FirmaPad';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ApiError, firmarPedidoPublico, getPedidoFirmaPublico, type PedidoFirmaPublico } from '@/lib/api';

// Página pública pensada para el celular del técnico: se abre desde el QR/link de la hoja de ruta, sin iniciar sesión.
export default function FirmarPage() {
  const { token } = useParams<{ token: string }>();
  const [pedido, setPedido] = useState<PedidoFirmaPublico | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [firma, setFirma] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    getPedidoFirmaPublico(token)
      .then(setPedido)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'No se pudo abrir la hoja. Revisá tu conexión.'));
  }, [token]);

  async function enviar() {
    if (!firma) return;
    setEnviando(true);
    try {
      await firmarPedidoPublico(token, firma);
      setListo(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo enviar la firma. Probá de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  const aTecnico = pedido?.sentido === 'a_tecnico';

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 bg-bg px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))]">
      <Image src="/logo-wara.png" alt="WARA" width={120} height={34} priority className="h-8 w-auto self-start" />

      {error && !listo && <Card className="border border-danger-300 p-4 text-sm font-semibold text-danger-700">{error}</Card>}

      {!pedido && !error && <div className="text-sm font-semibold text-muted">Cargando…</div>}

      {listo && (
        <Card className="flex flex-col items-center gap-2 border border-neutral-200 p-8 text-center shadow-none">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-600 text-2xl text-white">✓</div>
          <div className="text-lg font-extrabold">Firma enviada</div>
          <div className="text-sm font-semibold text-muted">Ya aparece en la hoja de ruta. Podés cerrar esta pantalla.</div>
        </Card>
      )}

      {pedido && pedido.firmada && !listo && (
        <Card className="border border-neutral-200 p-5 text-center text-sm font-semibold text-muted shadow-none">Esta hoja de ruta ya fue firmada.</Card>
      )}

      {pedido && !pedido.firmada && !listo && (
        <>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-primary-500">Hoja de ruta {pedido.transferenciaId}</div>
            <div className="text-xl font-extrabold">{aTecnico ? 'Firmá la recepción' : 'Firmá la devolución'}</div>
            <div className="text-[13px] font-semibold text-muted">
              {pedido.tecnicoNombre} · {aTecnico ? 'recibís del depósito' : 'entregás al depósito'}
            </div>
          </div>

          <Card className="flex flex-col border border-neutral-200 p-0 shadow-none">
            {pedido.lineas.map((l, i) => (
              <div key={i} className="border-t border-neutral-200 px-4 py-2.5 first:border-t-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[14px] font-bold">{l.nombre}</span>
                  <span className="text-lg font-extrabold">{l.cantidad}</span>
                </div>
                {l.series.length > 0 && <div className="font-mono text-[11px] font-semibold text-muted">{l.series.join(', ')}</div>}
              </div>
            ))}
          </Card>

          <FirmaPad titulo="Tu firma" nombre={pedido.tecnicoNombre} onChange={setFirma} />

          <Button className="w-full" disabled={!firma || enviando} onClick={enviar}>
            {enviando ? 'Enviando…' : 'Confirmar y firmar'}
          </Button>
        </>
      )}
    </div>
  );
}
