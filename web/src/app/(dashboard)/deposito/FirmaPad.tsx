'use client';

import { useEffect, useRef, useState } from 'react';

// Recuadro para firmar con el dedo, lápiz o mouse. Devuelve la firma como PNG (data URL) o null si está vacío.
export function FirmaPad({ titulo, nombre, onChange }: { titulo: string; nombre: string; onChange: (png: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const [vacio, setVacio] = useState(true);

  useEffect(() => {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = r.width * dpr;
    c.height = r.height * dpr;
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#22293F';
  }, []);

  const punto = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function empezar(e: React.PointerEvent) {
    ref.current!.setPointerCapture(e.pointerId);
    dibujando.current = true;
    const { x, y } = punto(e);
    const ctx = ref.current!.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.01, y);
    ctx.stroke();
  }

  function mover(e: React.PointerEvent) {
    if (!dibujando.current) return;
    const { x, y } = punto(e);
    const ctx = ref.current!.getContext('2d')!;
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function terminar() {
    if (!dibujando.current) return;
    dibujando.current = false;
    setVacio(false);
    onChange(ref.current!.toDataURL('image/png'));
  }

  function borrar() {
    const c = ref.current!;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    setVacio(true);
    onChange(null);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-primary-500">{titulo}</div>
          <div className="text-[13px] font-bold">{nombre}</div>
        </div>
        <button type="button" onClick={borrar} disabled={vacio} className="text-xs font-bold text-muted hover:text-text disabled:opacity-30">
          Borrar
        </button>
      </div>
      <div className="relative rounded-md border border-neutral-300 bg-white">
        <canvas
          ref={ref}
          className="block h-36 w-full touch-none cursor-crosshair"
          onPointerDown={empezar}
          onPointerMove={mover}
          onPointerUp={terminar}
          onPointerCancel={terminar}
        />
        {vacio && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[12px] font-semibold text-neutral-400">Firmá acá</div>}
        <div className="pointer-events-none absolute inset-x-4 bottom-6 border-b border-neutral-200" />
      </div>
    </div>
  );
}
