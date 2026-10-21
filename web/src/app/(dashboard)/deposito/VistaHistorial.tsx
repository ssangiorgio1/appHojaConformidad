'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { HojaRutaVisor } from './HojaRutaVisor';
import type { Estado } from './logica';
import { PRODUCTOS, TECNICOS, imei as imeiDeEjemplo, productoPorId, type SentidoTransferencia } from './mock';

type Movimiento = {
  key: string;
  transferenciaId: string;
  fecha: string; // día de la entrega firmada; si todavía está abierta, el de creación
  recibida: boolean;
  sentido: SentidoTransferencia;
  tecnicoId: string;
  tecnico: string;
  productoId: string;
  producto: string;
  codigo: string;
  serie?: string;
  imei?: string;
  cantidad: number;
};

type Filtros = { q: string; tecnicoId: string; sentido: '' | SentidoTransferencia; estado: '' | 'recibida' | 'abierta'; productoId: string; desde: string; hasta: string };

const SIN_FILTROS: Filtros = { q: '', tecnicoId: '', sentido: '', estado: '', productoId: '', desde: '', hasta: '' };

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const fechaCorta = (f: string) => f.split('-').reverse().join('/');

// Un movimiento por equipo (con serie e IMEI) o por línea cuando va por cantidad, así se busca "este equipo" y aparece cada vez que se movió.
function armarMovimientos(estado: Estado): Movimiento[] {
  const imeis = new Map<string, string>();
  for (const lista of [estado.deposito, estado.laboratorio, estado.tecnicos]) {
    for (const i of lista) i.series?.forEach((s) => imeis.set(s.serie, s.imei));
  }
  for (const r of estado.recambios) {
    imeis.set(r.nuevo.serie, r.nuevo.imei);
    imeis.set(r.retirado.serie, r.retirado.imei);
  }
  // En la maqueta el IMEI se deriva del número de serie; el equipo que ya no está en ninguna lista lo recupera de ahí.
  const imeiDe = (serie: string) => imeis.get(serie) ?? imeiDeEjemplo(Number(serie.slice(-5)));

  const filas: Movimiento[] = [];
  for (const t of estado.transferencias) {
    const tecnico = TECNICOS.find((x) => x.id === t.tecnicoId)?.nombre ?? t.tecnicoId;
    const fecha = (t.hitos.recibida ?? t.hitos.creada).slice(0, 10);
    for (const l of t.lineas) {
      const p = productoPorId(l.productoId);
      const base = { transferenciaId: t.id, fecha, recibida: t.estado === 'recibida', sentido: t.sentido, tecnicoId: t.tecnicoId, tecnico, productoId: p.id, producto: p.nombre, codigo: p.codigo };
      if (l.series?.length) {
        for (const serie of l.series) filas.push({ ...base, key: `${t.id}-${serie}`, serie, imei: imeiDe(serie), cantidad: 1 });
      } else {
        filas.push({ ...base, key: `${t.id}-${p.id}`, cantidad: l.cantidad });
      }
    }
  }
  return filas.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.transferenciaId.localeCompare(a.transferenciaId));
}

function aplicar(filas: Movimiento[], f: Filtros) {
  const q = normalizar(f.q.trim());
  return filas.filter((m) => {
    if (f.tecnicoId && m.tecnicoId !== f.tecnicoId) return false;
    if (f.sentido && m.sentido !== f.sentido) return false;
    if (f.estado && (f.estado === 'recibida') !== m.recibida) return false;
    if (f.productoId && m.productoId !== f.productoId) return false;
    if (f.desde && m.fecha < f.desde) return false;
    if (f.hasta && m.fecha > f.hasta) return false;
    if (q && !normalizar([m.serie, m.imei, m.producto, m.codigo, m.transferenciaId, m.tecnico].filter(Boolean).join(' ')).includes(q)) return false;
    return true;
  });
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

export function VistaHistorial({ estado }: { estado: Estado }) {
  const [f, setF] = useState<Filtros>(SIN_FILTROS);
  const [viendo, setViendo] = useState<string | null>(null);
  const aVer = estado.transferencias.find((x) => x.id === viendo);
  const todos = useMemo(() => armarMovimientos(estado), [estado]);
  const filas = useMemo(() => aplicar(todos, f), [todos, f]);
  const set = <K extends keyof Filtros>(k: K, v: Filtros[K]) => setF((x) => ({ ...x, [k]: v }));
  const hayFiltros = JSON.stringify(f) !== JSON.stringify(SIN_FILTROS);
  const unidades = filas.reduce((n, m) => n + m.cantidad, 0);

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3 border border-neutral-200 p-4 shadow-none">
        <Input
          value={f.q}
          onChange={(e) => set('q', e.target.value)}
          placeholder="Buscar por nº de serie, IMEI, producto, técnico o nº de transferencia"
          aria-label="Buscar movimientos"
        />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <Campo label="Técnico">
            <Select value={f.tecnicoId} onChange={(e) => set('tecnicoId', e.target.value)}>
              <option value="">Todos</option>
              {TECNICOS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo label="Sentido">
            <Select value={f.sentido} onChange={(e) => set('sentido', e.target.value as Filtros['sentido'])}>
              <option value="">Ambos</option>
              <option value="a_tecnico">Salió del depósito</option>
              <option value="a_deposito">Volvió al depósito</option>
            </Select>
          </Campo>
          <Campo label="Estado">
            <Select value={f.estado} onChange={(e) => set('estado', e.target.value as Filtros['estado'])}>
              <option value="">Todos</option>
              <option value="recibida">Firmadas</option>
              <option value="abierta">Abiertas</option>
            </Select>
          </Campo>
          <Campo label="Producto">
            <Select value={f.productoId} onChange={(e) => set('productoId', e.target.value)}>
              <option value="">Todos</option>
              {PRODUCTOS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo label="Desde">
            <Input type="date" value={f.desde} max={f.hasta || undefined} onChange={(e) => set('desde', e.target.value)} className="py-2.5" />
          </Campo>
          <Campo label="Hasta">
            <Input type="date" value={f.hasta} min={f.desde || undefined} onChange={(e) => set('hasta', e.target.value)} className="py-2.5" />
          </Campo>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="text-[12.5px] font-semibold text-muted">
            {filas.length} {filas.length === 1 ? 'movimiento' : 'movimientos'} · {unidades} {unidades === 1 ? 'unidad' : 'unidades'}
          </div>
          {hayFiltros && (
            <Button variant="ghost" className="border border-neutral-300 text-xs" onClick={() => setF(SIN_FILTROS)}>
              Limpiar filtros
            </Button>
          )}
        </div>
      </Card>

      <Card className="overflow-x-auto border border-neutral-200 shadow-none">
        <table className="w-full min-w-[820px] text-left text-[12.5px]">
          <thead className="bg-neutral-50 text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Movimiento</th>
              <th className="px-3 py-2">Técnico</th>
              <th className="px-3 py-2">Producto</th>
              <th className="px-3 py-2">Nº de serie</th>
              <th className="px-3 py-2">IMEI</th>
              <th className="px-3 py-2 text-right">Cant.</th>
              <th className="px-3 py-2">Hoja</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((m) => (
              <tr key={m.key} className="border-t border-neutral-200">
                <td className="whitespace-nowrap px-3 py-2 font-semibold">{fechaCorta(m.fecha)}</td>
                <td className="px-3 py-2">
                  <Badge tone={m.sentido === 'a_tecnico' ? 'primary' : 'neutral'}>{m.sentido === 'a_tecnico' ? 'Depósito → técnico' : 'Técnico → depósito'}</Badge>
                </td>
                <td className="px-3 py-2 font-semibold">{m.tecnico}</td>
                <td className="px-3 py-2">
                  {m.producto}
                  <div className="text-[11px] font-semibold text-muted">{m.codigo}</div>
                </td>
                <td className="px-3 py-2 font-semibold">
                  {m.serie ? (
                    <button type="button" title="Ver todos los movimientos de este equipo" onClick={() => set('q', m.serie!)} className="text-primary-500 hover:underline">
                      {m.serie}
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-[11.5px] text-muted">{m.imei ?? '—'}</td>
                <td className="px-3 py-2 text-right font-extrabold">{m.cantidad}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  <button type="button" title="Ver la hoja de ruta firmada" onClick={() => setViendo(m.transferenciaId)} className="font-semibold text-primary-500 hover:underline">
                    {m.transferenciaId}
                  </button>
                  {!m.recibida && <span className="ml-1.5 text-[11px] font-bold text-warning-700">abierta</span>}
                </td>
              </tr>
            ))}
            {!filas.length && (
              <tr>
                <td colSpan={8} className="p-4 text-sm font-semibold text-muted">
                  No hay movimientos con esos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      {aVer && <HojaRutaVisor estado={estado} transferencia={aVer} onClose={() => setViendo(null)} />}
    </div>
  );
}
