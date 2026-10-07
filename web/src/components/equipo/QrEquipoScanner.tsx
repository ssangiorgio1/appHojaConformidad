'use client';

import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { IconAlertTriangle, IconCamera, IconRefresh } from '@/components/ui/Icons';
import { getNumeroEquipoPorImei } from '@/lib/api';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';

// Mismo criterio que el escáner de la PWA: el QR trae "numequipo;imei" (o ":"), o solo el IMEI (15 dígitos), en cuyo
// caso se le pregunta a la API el número de equipo.
const QR_FORMAT = /^(\d+)[;:](\d+)$/;
const QR_SOLO_IMEI = /^\d{15}$/;

export interface QrEquipoResult {
  // Vacío cuando el QR trajo solo el IMEI y no se pudo resolver el número de equipo.
  numEquipo: string;
  imei: string;
}

export function QrScanButton({ onScan }: { onScan: (result: QrEquipoResult) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="ghost" className="border border-neutral-300" onClick={() => setOpen(true)}>
        <IconCamera size={16} /> Escanear QR
      </Button>
      {open && (
        <QrScanOverlay
          onCancel={() => setOpen(false)}
          onScan={(result) => {
            setOpen(false);
            onScan(result);
          }}
        />
      )}
    </>
  );
}

function QrScanOverlay({ onScan, onCancel }: { onScan: (result: QrEquipoResult) => void; onCancel: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  const [resolving, setResolving] = useState(false);
  const { getIdToken } = useAuth();

  useBodyScrollLock(true);

  useEffect(() => {
    cancelledRef.current = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Este navegador no permite acceder a la cámara (hace falta HTTPS).');
        return;
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (err: unknown) {
        if (cancelledRef.current) return;
        const name = (err as { name?: string })?.name;
        setCameraError(
          name === 'NotAllowedError' || name === 'PermissionDeniedError'
            ? 'Permiso de cámara denegado. Habilitalo en los permisos del navegador para escanear el QR.'
            : 'No se pudo inicializar la cámara para escanear el QR.',
        );
        return;
      }
      if (cancelledRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    }

    void start();

    return () => {
      cancelledRef.current = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const video = videoRef.current;
    if (!video) return;
    if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    function tick() {
      if (cancelledRef.current || !video || video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx!.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx!.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code?.data) {
        const texto = code.data.trim();
        const match = QR_FORMAT.exec(texto);
        if (match) {
          onScan({ numEquipo: match[1], imei: match[2] });
          return;
        }
        if (QR_SOLO_IMEI.test(texto)) {
          // Se corta el escaneo mientras se consulta; un error o "no encontrado" no bloquea la búsqueda.
          setResolving(true);
          void (async () => {
            let numEquipo: string | null = null;
            try {
              numEquipo = await getNumeroEquipoPorImei(await getIdToken(), texto);
            } catch {
              numEquipo = null;
            }
            if (!cancelledRef.current) onScan({ numEquipo: numEquipo ?? '', imei: texto });
          })();
          return;
        }
        // QR leído pero con otro formato: se avisa y se sigue escaneando.
        setUnreadable(true);
        setTimeout(() => {
          if (!cancelledRef.current) setUnreadable(false);
        }, 2500);
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onCancel}>
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-black" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 text-center text-xs font-semibold text-white/80">Escaneá el QR del equipo</div>

        {cameraError ? (
          <div className="flex flex-col items-center p-6 text-center text-white">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
              <IconAlertTriangle size={28} />
            </div>
            <h3 className="mb-2 text-base font-bold">Problema con la cámara</h3>
            <p className="mb-6 max-w-xs text-xs text-white/70">{cameraError}</p>
          </div>
        ) : (
          <div className="relative aspect-[4/3] overflow-hidden bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={() => setReady(true)}
              className="h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-48 w-48 rounded-lg border-4 border-white/70" />
            </div>
            {unreadable && (
              <div className="absolute bottom-4 left-0 right-0 px-6 text-center text-xs font-semibold text-white/90">
                Ese QR no tiene el formato esperado (número de equipo;IMEI o solo IMEI).
              </div>
            )}
            {resolving && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-white">
                <IconRefresh className="animate-spin" size={28} />
                <span className="text-xs font-semibold">Buscando número de equipo…</span>
              </div>
            )}
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center text-white">
                <IconRefresh className="animate-spin" size={28} />
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-center py-4">
          <button type="button" onClick={onCancel} className="text-sm font-semibold text-white">
            {cameraError ? 'Cerrar' : 'Cancelar'}
          </button>
        </div>
      </div>
    </div>
  );
}
