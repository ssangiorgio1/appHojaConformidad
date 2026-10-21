'use client';

import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconX } from '@/components/ui/Icons';
import { crearPedidoFirma, getEstadoPedidoFirma } from '@/lib/api';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import { FirmaPad } from './FirmaPad';
import { productoPorId, TECNICOS, type TransferenciaMock } from './mock';

// Firma del técnico desde su celular: se pide un link (QR), el técnico firma ahí y la firma vuelve sola.
function FirmaPorCelular({ transferencia: t, titulo, nombre, onChange }: { transferencia: TransferenciaMock; titulo: string; nombre: string; onChange: (png: string | null) => void }) {
  const { getIdToken } = useAuth();
  const [estado, setEstado] = useState<'generando' | 'esperando' | 'firmada' | 'error'>('generando');
  const [link, setLink] = useState('');
  const [qr, setQr] = useState('');
  const [firma, setFirma] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let vivo = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    (async () => {
      try {
        const idToken = await getIdToken();
        if (!idToken) throw new Error('sin sesión');
        const tecnico = TECNICOS.find((x) => x.id === t.tecnicoId)!;
        const { token } = await crearPedidoFirma(idToken, {
          transferenciaId: t.id,
          tecnicoNombre: tecnico.nombre,
          sentido: t.sentido,
          lineas: t.lineas.map((l) => ({ nombre: productoPorId(l.productoId).nombre, cantidad: l.cantidad, series: l.series })),
        });
        const url = `${window.location.origin}/firmar/${token}`;
        const img = await QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: '#22293F', light: '#ffffff' } });
        if (!vivo) return;
        setLink(url);
        setQr(img);
        setEstado('esperando');
        timer = setInterval(async () => {
          try {
            const r = await getEstadoPedidoFirma((await getIdToken()) ?? '', token);
            if (!vivo || !r.firmada || !r.firma) return;
            clearInterval(timer);
            setFirma(r.firma);
            setEstado('firmada');
            onChange(r.firma);
          } catch {
            // Un corte de red no cancela el pedido: se reintenta en el próximo ciclo.
          }
        }, 3000);
      } catch {
        if (vivo) setEstado('error');
      }
    })();
    return () => {
      vivo = false;
      clearInterval(timer);
    };
    // El pedido se crea una sola vez al elegir "desde el celular".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[11px] font-bold uppercase tracking-wider text-primary-500">{titulo}</div>
      <div className="text-[13px] font-bold">{nombre}</div>
      <div className="flex flex-col items-center gap-2 rounded-md border border-neutral-300 p-4 text-center">
        {estado === 'generando' && <div className="text-[13px] font-semibold text-muted">Generando el link…</div>}
        {estado === 'error' && <div className="text-[13px] font-semibold text-danger-700">No se pudo generar el link. Cerrá y probá de nuevo, o firmá en esta pantalla.</div>}
        {estado === 'esperando' && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR para firmar desde el celular" className="h-40 w-40" />
            <div className="text-[13px] font-semibold">Pedile a {nombre} que escanee el QR con su celular.</div>
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-muted">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary-500" />
              Esperando la firma…
            </div>
            <button
              type="button"
              className="text-xs font-bold text-primary-500"
              onClick={() => {
                navigator.clipboard?.writeText(link).then(() => setCopiado(true));
              }}
            >
              {copiado ? 'Link copiado' : 'Copiar link'}
            </button>
          </>
        )}
        {estado === 'firmada' && firma && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={firma} alt={`Firma de ${nombre}`} className="h-20 object-contain" />
            <div className="text-[12.5px] font-bold text-success-600">✓ Firmada desde el celular</div>
          </>
        )}
      </div>
    </div>
  );
}

// El técnico firma en pantalla o desde su celular.
function FirmaTecnico(props: { transferencia: TransferenciaMock; titulo: string; nombre: string; onChange: (png: string | null) => void }) {
  const [modo, setModo] = useState<'pantalla' | 'celular'>('pantalla');
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1 rounded-md bg-neutral-100 p-0.5 text-xs font-bold">
        {(
          [
            ['pantalla', 'Firmar acá'],
            ['celular', 'Desde su celular'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              props.onChange(null);
              setModo(id);
            }}
            className={`flex-1 rounded px-2 py-1.5 transition ${modo === id ? 'bg-surface text-text shadow-soft-sm' : 'text-muted hover:text-text'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {modo === 'pantalla' ? <FirmaPad titulo={props.titulo} nombre={props.nombre} onChange={props.onChange} /> : <FirmaPorCelular {...props} />}
    </div>
  );
}

// Entrega en mano: firman los dos, en el momento. Al confirmar se mueve el stock.
export function FirmarPanel({
  transferencia: t,
  onClose,
  onConfirmar,
}: {
  transferencia: TransferenciaMock;
  onClose: () => void;
  onConfirmar: (firmas: { entrega: string; recibe: string }) => void;
}) {
  useBodyScrollLock();
  const tecnico = TECNICOS.find((x) => x.id === t.tecnicoId)!;
  const aTecnico = t.sentido === 'a_tecnico';
  const [entrega, setEntrega] = useState<string | null>(null);
  const [recibe, setRecibe] = useState<string | null>(null);

  const entregaPad = aTecnico ? (
    <FirmaPad titulo="Entrega" nombre="Depósito" onChange={setEntrega} />
  ) : (
    <FirmaTecnico transferencia={t} titulo="Entrega" nombre={tecnico.nombre} onChange={setEntrega} />
  );
  const recibePad = aTecnico ? (
    <FirmaTecnico transferencia={t} titulo="Recibe" nombre={tecnico.nombre} onChange={setRecibe} />
  ) : (
    <FirmaPad titulo="Recibe" nombre="Depósito / Laboratorio" onChange={setRecibe} />
  );

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center lg:items-center">
      <div className="absolute inset-0 animate-sheet-fade bg-black/45" onClick={onClose} />
      <Card className="relative flex max-h-[92dvh] w-full flex-col gap-4 overflow-y-auto rounded-b-none p-5 animate-sheet-up lg:max-w-xl lg:animate-none lg:rounded-b-lg">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-primary-500">Hoja de ruta {t.id}</div>
            <div className="text-lg font-extrabold">Firmar la entrega</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition hover:text-text">
            <IconX size={18} />
          </button>
        </div>

        <ul className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-[12.5px] font-semibold">
          {t.lineas.map((l) => (
            <li key={l.productoId}>
              {l.cantidad} × {productoPorId(l.productoId).nombre}
              {l.series && <span className="font-mono text-[11px] text-muted"> ({l.series.join(', ')})</span>}
            </li>
          ))}
        </ul>

        {entregaPad}
        {recibePad}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!entrega || !recibe} onClick={() => onConfirmar({ entrega: entrega!, recibe: recibe! })}>
            Confirmar y firmar
          </Button>
        </div>
      </Card>
    </div>
  );
}
