'use client';

import { useState } from 'react';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { Accion, Estado } from './logica';
import { TECNICOS, productoPorId, type TransferenciaMock } from './mock';
import { FirmarPanel } from './FirmarPanel';
import { destinoDevolucion, fechaHora, imprimirHojaRuta, pasosDe } from './imprimirHojaRuta';
import { HojaRutaVisor } from './HojaRutaVisor';
import type { PresetTransferencia } from './TransferenciaPanel';

const ESTADO: Record<TransferenciaMock['estado'], { label: string; tone: BadgeTone }> = {
  pendiente: { label: 'Preparando carga', tone: 'warn' },
  recibida: { label: 'Recibida', tone: 'ok' },
};

type Filtro = 'abiertas' | 'recibidas' | 'todas';

const ahora = () => new Date().toISOString();

function Pasos({ t }: { t: TransferenciaMock }) {
  const pasos = pasosDe(t);
  const actual = pasos.findIndex((p) => !p.hecho);
  return (
    <ol className="grid grid-cols-2 gap-y-3 sm:grid-cols-3">
      {pasos.map((p, i) => (
        <li key={p.label} className="flex flex-col gap-1.5 pr-3">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-5 w-5 flex-none items-center justify-center rounded-full border text-[10px] font-extrabold ${
                p.hecho ? 'border-success-600 bg-success-600 text-white' : i === actual ? 'border-primary-500 text-primary-500' : 'border-neutral-300 text-muted'
              }`}
            >
              {p.hecho ? '✓' : i + 1}
            </span>
            {i < pasos.length - 1 && <span className={`hidden h-px flex-1 sm:block ${p.hecho ? 'bg-success-600' : 'bg-neutral-200'}`} />}
          </div>
          <div>
            <div className={`text-[12.5px] font-bold ${p.hecho || i === actual ? '' : 'text-muted'}`}>{p.label}</div>
            <div className="text-[11.5px] font-semibold text-muted">{fechaHora(p.cuando) ?? (i === actual ? 'Pendiente' : '—')}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function VistaTransferencias({
  estado,
  despachar,
  abrirPanel,
}: {
  estado: Estado;
  despachar: (a: Accion, mensaje: string) => void;
  abrirPanel: (p: PresetTransferencia) => void;
}) {
  const [filtro, setFiltro] = useState<Filtro>('abiertas');
  const [firmando, setFirmando] = useState<string | null>(null);
  const [viendo, setViendo] = useState<string | null>(null);
  const aVer = estado.transferencias.find((x) => x.id === viendo);
  const aFirmar = estado.transferencias.find((x) => x.id === firmando);
  const abiertas = estado.transferencias.filter((t) => t.estado !== 'recibida');
  const recibidas = estado.transferencias.filter((t) => t.estado === 'recibida');
  const lista = filtro === 'abiertas' ? abiertas : filtro === 'recibidas' ? recibidas : estado.transferencias;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="max-w-2xl text-[13px] font-semibold text-muted">
          Cada transferencia es una hoja de ruta: se carga lo que va y se cierra en el momento, con la firma de los dos al entregar en mano. El stock se mueve recién
          al firmar; mientras tanto lo prometido no se ofrece en otra transferencia.
        </div>
        <Button className="flex-none text-xs" onClick={() => abrirPanel({ sentido: 'a_tecnico' })}>
          Nueva transferencia
        </Button>
      </div>

      <div className="flex gap-2">
        {(
          [
            ['abiertas', `Abiertas (${abiertas.length})`],
            ['recibidas', `Recibidas (${recibidas.length})`],
            ['todas', 'Todas'],
          ] as [Filtro, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFiltro(id)}
            className={`rounded-full px-3 py-1 text-xs font-bold ${filtro === id ? 'bg-neutral-800 text-white' : 'bg-surface text-muted shadow-soft-sm hover:text-text'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {lista.map((t) => {
        const tecnico = TECNICOS.find((x) => x.id === t.tecnicoId)!;
        const aTecnico = t.sentido === 'a_tecnico';
        const pendiente = t.estado === 'pendiente';
        const cargadas = t.lineas.filter((l) => t.cargadas.includes(l.productoId)).length;
        const completa = cargadas === t.lineas.length;
        return (
          <Card key={t.id} className="flex flex-col gap-4 border border-neutral-200 p-0 shadow-none">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-neutral-200 px-4 py-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-primary-500">
                  Hoja de ruta {t.id} · {t.fecha}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[15px] font-extrabold">
                  <span>{aTecnico ? 'Depósito' : tecnico.nombre}</span>
                  <span className="text-muted">→</span>
                  <span>{aTecnico ? tecnico.nombre : 'Depósito / Laboratorio'}</span>
                </div>
                <div className="text-[12.5px] font-semibold text-muted">
                  {tecnico.zona} · {aTecnico ? 'Entrega de stock' : 'Devolución'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={ESTADO[t.estado].tone}>{ESTADO[t.estado].label}</Badge>
                <button
                  type="button"
                  onClick={() => setViendo(t.id)}
                  className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-bold text-muted hover:text-text"
                >
                  Ver
                </button>
                <button
                  type="button"
                  onClick={() => imprimirHojaRuta(estado, t)}
                  className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-bold text-muted hover:text-text"
                >
                  Imprimir
                </button>
              </div>
            </div>

            <div className="px-4">
              <Pasos t={t} />
            </div>

            <div className="mx-4 overflow-x-auto rounded-md border border-neutral-200">
              <table className="w-full min-w-[520px] text-left text-[12.5px]">
                <thead className="bg-neutral-50 text-[11px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="w-10 px-3 py-2" />
                    <th className="px-3 py-2">Producto</th>
                    <th className="px-3 py-2">Cant.</th>
                    <th className="px-3 py-2">Series</th>
                    {!aTecnico && <th className="px-3 py-2">Destino</th>}
                  </tr>
                </thead>
                <tbody>
                  {t.lineas.map((l) => {
                    const hecha = t.cargadas.includes(l.productoId);
                    return (
                      <tr key={l.productoId} className="border-t border-neutral-200">
                        <td className="px-3 py-1.5">
                          <input
                            type="checkbox"
                            checked={hecha || !pendiente}
                            disabled={!pendiente}
                            onChange={() => despachar({ tipo: 'cargar', id: t.id, productoId: l.productoId }, '')}
                            aria-label={`${aTecnico ? 'Cargado' : 'Recolectado'}: ${productoPorId(l.productoId).nombre}`}
                          />
                        </td>
                        <td className={`px-3 py-1.5 font-semibold ${hecha || !pendiente ? '' : 'text-text'}`}>{productoPorId(l.productoId).nombre}</td>
                        <td className="px-3 py-1.5 font-extrabold">{l.cantidad}</td>
                        <td className="px-3 py-1.5 font-mono text-[11.5px] text-muted">{l.series?.join(', ') ?? '—'}</td>
                        {!aTecnico && <td className="px-3 py-1.5 font-semibold">{destinoDevolucion(estado, t, l.productoId, l.series)}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {t.firmas && (
              <div className="mx-4 grid grid-cols-2 gap-3">
                {([['Entrega', aTecnico ? 'Depósito' : tecnico.nombre, t.firmas.entrega], ['Recibe', aTecnico ? tecnico.nombre : 'Depósito / Laboratorio', t.firmas.recibe]] as const).map(([rol, quien, img]) => (
                  <div key={rol} className="rounded-md border border-neutral-200 p-2 text-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt={`Firma de ${quien}`} className="mx-auto h-14 object-contain" />
                    <div className="mt-1 border-t border-neutral-200 pt-1 text-[11px] font-semibold text-muted">
                      {rol}: {quien}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {t.estado !== 'recibida' && (
              <div className="flex flex-wrap items-center gap-2 border-t border-neutral-200 px-4 py-3">
                <Button
                  className="text-xs"
                  disabled={!completa}
                  title={completa ? undefined : `Tildá todo lo que ${aTecnico ? 'se carga' : 'se recolecta'} para poder firmar`}
                  onClick={() => setFirmando(t.id)}
                >
                  Firmar entrega
                </Button>
                <span className="text-[12px] font-semibold text-muted">
                  {cargadas} de {t.lineas.length} {aTecnico ? 'cargados' : 'recolectados'}
                </span>
                <Button variant="ghost" className="border border-neutral-300 text-xs" onClick={() => despachar({ tipo: 'cancelar', id: t.id }, `${t.id} cancelada.`)}>
                  Cancelar
                </Button>
              </div>
            )}
          </Card>
        );
      })}
      {aVer && <HojaRutaVisor estado={estado} transferencia={aVer} onClose={() => setViendo(null)} />}
      {aFirmar && (
        <FirmarPanel
          transferencia={aFirmar}
          onClose={() => setFirmando(null)}
          onConfirmar={(firmas) => {
            const tec = TECNICOS.find((x) => x.id === aFirmar.tecnicoId)!;
            despachar(
              { tipo: 'recibir', id: aFirmar.id, ahora: ahora(), firmas },
              aFirmar.sentido === 'a_tecnico'
                ? `${aFirmar.id} firmada: el stock pasó al inventario de ${tec.nombre}.`
                : `${aFirmar.id} firmada: lo retirado de unidades quedó en el laboratorio y lo no usado en el depósito.`,
            );
            setFirmando(null);
          }}
        />
      )}
      {!lista.length && <Card className="p-4 text-sm font-semibold text-muted">No hay transferencias {filtro === 'abiertas' ? 'abiertas' : 'en esta lista'}.</Card>}
    </div>
  );
}
