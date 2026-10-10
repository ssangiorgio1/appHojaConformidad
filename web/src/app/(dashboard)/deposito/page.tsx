'use client';

import { useMemo, useState } from 'react';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconAlertTriangle, IconChevronDown } from '@/components/ui/Icons';
import {
  CONSUMO_PREVISTO,
  PRODUCTOS,
  STOCK_DEPOSITO,
  STOCK_TECNICOS,
  TECNICOS,
  TRANSFERENCIAS,
  cantidadDe,
  productoPorId,
  type EstadoSerie,
  type ItemSerie,
  type Producto,
} from './mock';

type Vista = 'deposito' | 'tecnicos' | 'transferencias';

const ESTADO_SERIE: Record<EstadoSerie, { label: string; tone: BadgeTone }> = {
  disponible: { label: 'Disponible', tone: 'ok' },
  en_revision: { label: 'En revisión', tone: 'warn' },
  rma: { label: 'RMA', tone: 'bad' },
  en_tecnico: { label: 'En técnico', tone: 'neutral' },
};

const ESTADO_TRANSFERENCIA = {
  pendiente: { label: 'Pendiente de envío', tone: 'warn' as BadgeTone },
  en_transito: { label: 'En tránsito', tone: 'primary' as BadgeTone },
  recibida: { label: 'Recibida', tone: 'ok' as BadgeTone },
};

// Árbol grupo → categoría, armado a partir de los productos (en el módulo real viene de la categoría padre).
function armarArbol(productos: Producto[]) {
  const mapa = new Map<string, Set<string>>();
  for (const p of productos) {
    if (!mapa.has(p.grupo)) mapa.set(p.grupo, new Set());
    mapa.get(p.grupo)!.add(p.categoria);
  }
  return [...mapa.entries()].map(([grupo, cats]) => ({ grupo, categorias: [...cats] }));
}

type Seleccion = { grupo: string; categoria?: string } | null;

const coincide = (p: Producto, sel: Seleccion) => !sel || (p.grupo === sel.grupo && (!sel.categoria || p.categoria === sel.categoria));

// MAQUETA: datos de ejemplo de ./mock.ts. Ver docs-inventario-tecnico.md.
export default function DepositoPage() {
  const [vista, setVista] = useState<Vista>('deposito');

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="text-xl font-extrabold lg:text-2xl">Depósito</div>
        <div className="mt-0.5 text-sm font-semibold text-muted">
          Stock del depósito y inventario de cada técnico. Los equipos se llevan por número de serie e IMEI; sensores, módulos y ramales por
          cantidad.
        </div>
      </div>

      <Card className="flex items-start gap-2 border-l-4 border-warning-600 p-3 text-[12.5px] font-semibold text-warning-700">
        <IconAlertTriangle size={16} className="mt-0.5 flex-none" />
        Maqueta con datos de ejemplo: todavía no está conectada a la API ni a Odoo, y los botones no hacen nada.
      </Card>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['deposito', 'Depósito'],
            ['tecnicos', 'Técnicos'],
            ['transferencias', 'Transferencias'],
          ] as [Vista, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setVista(id)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              vista === id ? 'bg-primary-600 text-white' : 'bg-surface text-muted shadow-soft-sm hover:text-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {vista === 'deposito' && <VistaDeposito />}
      {vista === 'tecnicos' && <VistaTecnicos />}
      {vista === 'transferencias' && <VistaTransferencias />}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number | string; tone?: 'warn' | 'bad' }) {
  return (
    <Card small className="flex flex-col gap-0.5 p-3.5">
      <div className="text-[12px] font-bold uppercase tracking-wide text-muted">{label}</div>
      <div className={`text-2xl font-extrabold ${tone === 'warn' ? 'text-warning-700' : tone === 'bad' ? 'text-danger-700' : ''}`}>{value}</div>
    </Card>
  );
}

function ChipsSerie({ series }: { series: ItemSerie[] }) {
  return (
    <div className="mt-2 overflow-x-auto rounded-md border border-neutral-200">
      <table className="w-full min-w-[520px] text-left text-[12.5px]">
        <thead className="bg-neutral-100 text-[11px] uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2">Nº de serie</th>
            <th className="px-3 py-2">IMEI</th>
            <th className="px-3 py-2">Estado</th>
            <th className="px-3 py-2">Nota</th>
          </tr>
        </thead>
        <tbody>
          {series.map((s) => (
            <tr key={s.serie} className="border-t border-neutral-200">
              <td className="px-3 py-1.5 font-semibold">{s.serie}</td>
              <td className="px-3 py-1.5 font-mono">{s.imei}</td>
              <td className="px-3 py-1.5">
                <Badge tone={ESTADO_SERIE[s.estado].tone}>{ESTADO_SERIE[s.estado].label}</Badge>
              </td>
              <td className="px-3 py-1.5 text-muted">{s.nota ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilaProducto({
  producto,
  cantidad,
  series,
  minimo,
  extra,
}: {
  producto: Producto;
  cantidad: number;
  series?: ItemSerie[];
  minimo?: number;
  extra?: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const bajo = minimo !== undefined && cantidad < minimo;
  const disponibles = series?.filter((s) => s.estado === 'disponible' || s.estado === 'en_tecnico').length;
  return (
    <div className="border-t border-neutral-200 px-4 py-3 first:border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[14px] font-bold">{producto.nombre}</div>
          <div className="text-[12px] font-semibold text-muted">
            {producto.codigo} · {producto.tipo === 'serializado' ? 'con nº de serie e IMEI' : 'por cantidad'}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {extra}
          {series && disponibles !== undefined && disponibles !== series.length && (
            <span className="text-[12px] font-semibold text-muted">{disponibles} disponibles</span>
          )}
          {bajo && <Badge tone="bad">Stock bajo (mín. {minimo})</Badge>}
          <span className="min-w-[2.5rem] text-right text-xl font-extrabold">{cantidad}</span>
          {series && (
            <button
              type="button"
              onClick={() => setAbierto((v) => !v)}
              className="flex items-center gap-1 rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-bold text-muted hover:text-text"
            >
              Series
              <IconChevronDown size={14} className={abierto ? 'rotate-180' : ''} />
            </button>
          )}
        </div>
      </div>
      {series && abierto && <ChipsSerie series={series} />}
    </div>
  );
}

function VistaDeposito() {
  const [sel, setSel] = useState<Seleccion>(null);
  const arbol = useMemo(() => armarArbol(PRODUCTOS), []);

  const filas = STOCK_DEPOSITO.filter((s) => coincide(productoPorId(s.productoId), sel));
  const totalEquipos = STOCK_DEPOSITO.reduce((n, s) => n + (s.series?.length ?? 0), 0);
  const enRevision = STOCK_DEPOSITO.reduce((n, s) => n + (s.series?.filter((x) => x.estado !== 'disponible').length ?? 0), 0);
  const stockBajo = STOCK_DEPOSITO.filter((s) => cantidadDe(s) < productoPorId(s.productoId).minimo).length;
  const cantidadGrupo = (grupo: string, categoria?: string) =>
    STOCK_DEPOSITO.filter((s) => coincide(productoPorId(s.productoId), { grupo, categoria })).reduce((n, s) => n + cantidadDe(s), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Equipos con serie" value={totalEquipos} />
        <Kpi label="En revisión / RMA" value={enRevision} tone="warn" />
        <Kpi label="Productos con stock bajo" value={stockBajo} tone="bad" />
        <Kpi label="Transferencias abiertas" value={TRANSFERENCIAS.filter((t) => t.estado !== 'recibida').length} />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <Card className="flex w-full flex-none flex-col gap-1 p-3 lg:w-[260px]">
          <div className="px-2 pb-1 text-[12px] font-bold uppercase tracking-wide text-muted">Árbol de productos</div>
          <button
            type="button"
            onClick={() => setSel(null)}
            className={`flex items-center justify-between rounded-md px-2.5 py-2 text-left text-sm font-bold ${!sel ? 'bg-primary-50 text-primary-700' : 'text-text hover:bg-neutral-100'}`}
          >
            Todo el depósito
            <span className="text-xs">{cantidadGrupo('')}</span>
          </button>
          {arbol.map(({ grupo, categorias }) => (
            <div key={grupo} className="flex flex-col">
              <button
                type="button"
                onClick={() => setSel({ grupo })}
                className={`flex items-center justify-between rounded-md px-2.5 py-2 text-left text-sm font-bold ${
                  sel?.grupo === grupo && !sel.categoria ? 'bg-primary-50 text-primary-700' : 'text-text hover:bg-neutral-100'
                }`}
              >
                {grupo}
                <span className="text-xs font-semibold text-muted">{cantidadGrupo(grupo)}</span>
              </button>
              <div className="ml-3 flex flex-col border-l border-neutral-200 pl-2">
                {categorias.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSel({ grupo, categoria: c })}
                    className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[13px] font-semibold ${
                      sel?.grupo === grupo && sel.categoria === c ? 'bg-primary-50 text-primary-700' : 'text-muted hover:bg-neutral-100 hover:text-text'
                    }`}
                  >
                    {c}
                    <span className="text-xs">{cantidadGrupo(grupo, c)}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </Card>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[15px] font-extrabold">{sel ? `${sel.grupo}${sel.categoria ? ` › ${sel.categoria}` : ''}` : 'Todo el depósito'}</div>
            <div className="flex gap-2">
              <Button variant="ghost" className="border border-neutral-300 text-xs">
                Ingresar stock
              </Button>
              <Button className="text-xs">Transferir a técnico</Button>
            </div>
          </div>
          <Card className="overflow-hidden">
            {filas.map((s) => {
              const p = productoPorId(s.productoId);
              return <FilaProducto key={s.productoId} producto={p} cantidad={cantidadDe(s)} series={s.series} minimo={p.minimo} />;
            })}
          </Card>
        </div>
      </div>
    </div>
  );
}

function VistaTecnicos() {
  const [tecnicoId, setTecnicoId] = useState(TECNICOS[0].id);
  const tecnico = TECNICOS.find((t) => t.id === tecnicoId)!;
  const stock = STOCK_TECNICOS.filter((s) => s.tecnicoId === tecnicoId);
  const faltantes = CONSUMO_PREVISTO.map((c) => {
    const tiene = cantidadDe(STOCK_TECNICOS.find((s) => s.tecnicoId === c.tecnicoId && s.productoId === c.productoId));
    return { ...c, tiene, falta: Math.max(0, c.cantidad - tiene) };
  }).filter((c) => c.falta > 0);
  const faltantesDe = (id: string) => faltantes.filter((f) => f.tecnicoId === id);
  const totalDe = (id: string) => STOCK_TECNICOS.filter((s) => s.tecnicoId === id).reduce((n, s) => n + cantidadDe(s), 0);

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <Card className="flex w-full flex-none flex-col gap-1 p-3 lg:w-[290px]">
        <div className="px-2 pb-1 text-[12px] font-bold uppercase tracking-wide text-muted">Técnicos</div>
        {TECNICOS.map((t) => {
          const f = faltantesDe(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTecnicoId(t.id)}
              className={`flex flex-col gap-0.5 rounded-md px-2.5 py-2 text-left ${tecnicoId === t.id ? 'bg-primary-50' : 'hover:bg-neutral-100'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`text-sm font-bold ${tecnicoId === t.id ? 'text-primary-700' : ''}`}>{t.nombre}</span>
                <span className="text-xs font-semibold text-muted">{totalDe(t.id)} ítems</span>
              </div>
              <div className="flex items-center justify-between text-[12px] font-semibold text-muted">
                {t.zona}
                {f.length > 0 && <span className="text-danger-700">Le falta stock</span>}
              </div>
            </button>
          );
        })}
      </Card>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[15px] font-extrabold">Inventario de {tecnico.nombre}</div>
            <div className="text-[12.5px] font-semibold text-muted">Lo que tiene en su poder para trabajar. Solo puede instalar con esto.</div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" className="border border-neutral-300 text-xs">
              Recibir devolución
            </Button>
            <Button className="text-xs">Transferir desde depósito</Button>
          </div>
        </div>

        {faltantesDe(tecnicoId).length > 0 && (
          <Card className="flex flex-col gap-1.5 border-l-4 border-danger-600 p-3.5">
            <div className="flex items-center gap-1.5 text-[13px] font-extrabold text-danger-700">
              <IconAlertTriangle size={15} />
              Faltante para las visitas asignadas
            </div>
            {faltantesDe(tecnicoId).map((f) => (
              <div key={f.productoId} className="text-[13px] font-semibold">
                Faltan {f.falta} de {productoPorId(f.productoId).nombre} (necesita {f.cantidad}, tiene {f.tiene}).{' '}
                <span className="text-muted">{f.detalle}</span>
              </div>
            ))}
          </Card>
        )}

        <Card className="overflow-hidden">
          {stock.map((s) => (
            <FilaProducto
              key={s.productoId}
              producto={productoPorId(s.productoId)}
              cantidad={cantidadDe(s)}
              series={s.series}
              extra={cantidadDe(s) === 0 ? <Badge tone="bad">Sin stock</Badge> : undefined}
            />
          ))}
          {!stock.length && <div className="p-4 text-sm font-semibold text-muted">Sin inventario.</div>}
        </Card>
      </div>
    </div>
  );
}

function VistaTransferencias() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[13px] font-semibold text-muted">
          Remitos depósito → técnico. Al confirmarse la recepción se genera el movimiento de stock.
        </div>
        <Button className="text-xs">Nueva transferencia</Button>
      </div>
      {TRANSFERENCIAS.map((t) => {
        const tecnico = TECNICOS.find((x) => x.id === t.tecnicoId)!;
        return (
          <Card key={t.id} className="flex flex-col gap-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[14px] font-bold">
                  {t.id} · Depósito → {tecnico.nombre}
                </div>
                <div className="text-[12.5px] font-semibold text-muted">{t.fecha}</div>
              </div>
              <Badge tone={ESTADO_TRANSFERENCIA[t.estado].tone}>{ESTADO_TRANSFERENCIA[t.estado].label}</Badge>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] font-semibold">
              {t.lineas.map((l) => (
                <li key={l.productoId}>
                  {l.cantidad} × {productoPorId(l.productoId).nombre}
                </li>
              ))}
            </ul>
            {t.estado !== 'recibida' && (
              <div className="flex gap-2">
                <Button variant="ghost" className="border border-neutral-300 text-xs">
                  {t.estado === 'pendiente' ? 'Marcar enviada' : 'Confirmar recepción'}
                </Button>
                <Button variant="ghost" className="border border-neutral-300 text-xs">
                  Cancelar
                </Button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
