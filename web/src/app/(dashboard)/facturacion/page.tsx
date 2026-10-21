'use client';

import { useMemo, useState } from 'react';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconAlertTriangle, IconCheck, IconDownload, IconLock, IconPlus, IconSearch, IconX } from '@/components/ui/Icons';
import {
  CATALOGO,
  FACTURABLES,
  productoPorCodigo,
  type CargoExtra,
  type EstadoFactura,
  type EstadoHoja,
  type LineaUnidad,
  type ProductoOdoo,
  type TicketFacturable,
  type TipoProducto,
} from './mock';

const IVA = 0.21;

const ESTADO_FACTURA: Record<EstadoFactura, { label: string; tone: BadgeTone }> = {
  por_facturar: { label: 'Por facturar', tone: 'warn' },
  borrador: { label: 'Borrador de factura', tone: 'primary' },
  facturada: { label: 'Facturada', tone: 'ok' },
};

const ESTADO_HOJA: Record<EstadoHoja, { label: string; tone: BadgeTone }> = {
  sin_hoja: { label: 'Sin hacer', tone: 'neutral' },
  en_curso: { label: 'En curso', tone: 'warn' },
  completa: { label: 'Hecho', tone: 'ok' },
};

const TIPO_LABEL: Record<TipoProducto, string> = {
  instala: 'Instalación',
  retira: 'Desinstalación',
  servicio: 'Servicio',
  accesorio: 'Accesorio',
  abono: 'Abono',
};

const peso = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

type LineaAgregada = { id: string; codigo: string; cantidad: number };

// MAQUETA: nada se guarda ni se lee de Odoo. Ver los datos de ejemplo en ./mock.ts.
export default function FacturacionPage() {
  const [filtro, setFiltro] = useState<EstadoFactura | 'todas'>('todas');
  const [seleccionado, setSeleccionado] = useState(FACTURABLES[0].id);
  const lista = FACTURABLES.filter((t) => filtro === 'todas' || t.estado === filtro);
  const ticket = FACTURABLES.find((t) => t.id === seleccionado) ?? FACTURABLES[0];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="text-xl font-extrabold lg:text-2xl">Facturación</div>
        <div className="mt-0.5 text-sm font-semibold text-muted">
          Productos de Odoo por unidad, cargos extra y estado de la factura de cada ticket. Maqueta con datos de ejemplo: no lee ni escribe en Odoo.
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {(['todas', 'por_facturar', 'borrador', 'facturada'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFiltro(f)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${filtro === f ? 'bg-primary-600 text-white' : 'bg-surface text-muted shadow-soft-sm'}`}
              >
                {f === 'todas' ? 'Todas' : ESTADO_FACTURA[f].label}
              </button>
            ))}
          </div>
          {lista.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSeleccionado(t.id)}
              className={`rounded-lg p-3 text-left transition ${t.id === ticket.id ? 'bg-primary-50 shadow-soft' : 'bg-surface shadow-soft-sm'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-extrabold">#{t.id}</span>
                <Badge tone={ESTADO_FACTURA[t.estado].tone}>{ESTADO_FACTURA[t.estado].label}</Badge>
              </div>
              <div className="mt-1 text-xs font-bold">{t.titulo}</div>
              <div className="text-xs font-semibold text-muted">{t.cliente}</div>
            </button>
          ))}
          {!lista.length && <Card className="p-4 text-sm font-semibold text-muted">No hay tickets con ese estado.</Card>}
        </div>

        <DetalleTicket key={ticket.id} ticket={ticket} />
      </div>
    </div>
  );
}

function DetalleTicket({ ticket }: { ticket: TicketFacturable }) {
  const editable = ticket.estado !== 'facturada';
  const [extras, setExtras] = useState<CargoExtra[]>(ticket.extras);
  const [agregadas, setAgregadas] = useState<LineaAgregada[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);

  const precio = (codigo: string) => productoPorCodigo(codigo)?.precio ?? 0;

  // Solo se factura lo hecho; lo pedido y no hecho queda pendiente.
  const hechas = ticket.unidades.filter((u) => u.hecho);
  const pendientes = ticket.unidades.filter((u) => !u.hecho);
  const subtotal = useMemo(
    () =>
      hechas.reduce((n, u) => n + precio(u.hecho!) * u.cantidad, 0) +
      extras.filter((e) => e.incluir).reduce((n, e) => n + precio(e.codigo) * e.cantidad, 0) +
      agregadas.reduce((n, l) => n + precio(l.codigo) * l.cantidad, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [extras, agregadas],
  );

  const accion = (texto: string) => setAviso(`Maqueta: ${texto}. No se guardó nada en Odoo ni en la base.`);

  // Lo que entra al PDF: unidades hechas, cargos extra tildados y líneas agregadas a mano.
  const lineasPdf: LineaPdf[] = [
    ...hechas.map((u) => ({ concepto: u.patente, codigo: u.hecho!, cantidad: u.cantidad, unitario: precio(u.hecho!) })),
    ...extras.filter((e) => e.incluir).map((e) => ({ concepto: e.origen, codigo: e.codigo, cantidad: e.cantidad, unitario: precio(e.codigo) })),
    ...agregadas.map((l) => ({ concepto: 'Agregado a mano', codigo: l.codigo, cantidad: l.cantidad, unitario: precio(l.codigo) })),
  ];
  const [verPdf, setVerPdf] = useState(false);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card className="p-4 lg:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-extrabold">
              Ticket #{ticket.id} · {ticket.titulo}
            </div>
            <div className="text-xs font-semibold text-muted">
              {ticket.cliente} · CUIT {ticket.cuit} · Orden de venta {ticket.orden}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge tone={ESTADO_FACTURA[ticket.estado].tone}>{ESTADO_FACTURA[ticket.estado].label}</Badge>
            {ticket.factura && (
              <span className="text-xs font-semibold text-muted">
                {ticket.factura.numero} · {ticket.factura.fecha}
              </span>
            )}
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between bg-bg px-4 py-3">
          <div className="text-sm font-extrabold">Unidades: pedido frente a lo hecho</div>
          <Badge tone="neutral">
            <IconLock size={12} /> Productos de la orden {ticket.orden}
          </Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase text-muted">
                <th className="px-4 py-2">Unidad</th>
                <th className="px-3 py-2">Producto pedido</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2 text-right">Precio</th>
                <th className="px-4 py-2 text-right">Importe</th>
              </tr>
            </thead>
            <tbody>
              {ticket.unidades.map((u) => (
                <FilaUnidad key={u.id} u={u} precio={precio} />
              ))}
            </tbody>
          </table>
        </div>
        {pendientes.length > 0 && (
          <div className="flex items-start gap-2 border-t border-line bg-warning-50 px-4 py-2.5 text-xs font-semibold text-warning-700">
            <IconAlertTriangle size={14} className="mt-0.5 shrink-0" />
            {pendientes.length === 1 ? 'Hay 1 unidad pedida que todavía no se hizo' : `Hay ${pendientes.length} unidades pedidas que todavía no se hicieron`}: no se incluye en
            el total hasta que su hoja esté completa.
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="bg-bg px-4 py-3 text-sm font-extrabold">Cargos extra detectados en campo</div>
        {extras.length === 0 ? (
          <div className="px-4 py-3 text-sm font-semibold text-muted">Ninguna hoja de este ticket generó cargos fuera de la orden.</div>
        ) : (
          extras.map((e) => {
            const p = productoPorCodigo(e.codigo);
            return (
              <label key={e.id} className="flex cursor-pointer items-center gap-3 border-t border-line px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  disabled={!editable}
                  checked={e.incluir}
                  onChange={() => setExtras((prev) => prev.map((x) => (x.id === e.id ? { ...x, incluir: !x.incluir } : x)))}
                />
                <span className="min-w-0 flex-1">
                  <span className="font-extrabold">{e.codigo}</span> <span className="text-muted">{p?.nombre}</span>
                  <span className="block text-xs font-semibold text-muted">{e.origen}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-muted">× {e.cantidad}</span>
                <span className="w-24 shrink-0 text-right font-bold">{peso(precio(e.codigo) * e.cantidad)}</span>
              </label>
            );
          })
        )}
      </Card>

      {editable && <AgregarDesdeCatalogo onAgregar={(p) => setAgregadas((prev) => [...prev, { id: `${p.codigo}-${prev.length}`, codigo: p.codigo, cantidad: 1 }])} />}

      {agregadas.length > 0 && (
        <Card className="overflow-hidden">
          <div className="bg-bg px-4 py-3 text-sm font-extrabold">Líneas agregadas a mano</div>
          {agregadas.map((l) => (
            <div key={l.id} className="flex items-center gap-3 border-t border-line px-4 py-2.5 text-sm">
              <span className="min-w-0 flex-1">
                <span className="font-extrabold">{l.codigo}</span> <span className="text-muted">{productoPorCodigo(l.codigo)?.nombre}</span>
              </span>
              <input
                type="number"
                min={1}
                value={l.cantidad}
                onChange={(ev) => setAgregadas((prev) => prev.map((x) => (x.id === l.id ? { ...x, cantidad: Math.max(1, Number(ev.target.value) || 1) } : x)))}
                className="w-16 rounded-md border border-line bg-surface px-2 py-1 text-center text-sm font-semibold"
              />
              <span className="w-24 shrink-0 text-right font-bold">{peso(precio(l.codigo) * l.cantidad)}</span>
              <button type="button" aria-label="Quitar línea" onClick={() => setAgregadas((prev) => prev.filter((x) => x.id !== l.id))} className="text-muted hover:text-text">
                <IconX size={14} />
              </button>
            </div>
          ))}
        </Card>
      )}

      <Card className="p-4">
        <div className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <span className="font-semibold text-muted">Neto</span>
            <span className="font-bold">{peso(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-muted">IVA 21%</span>
            <span className="font-bold">{peso(subtotal * IVA)}</span>
          </div>
          <div className="flex justify-between border-t border-line pt-2 text-base">
            <span className="font-extrabold">Total a facturar</span>
            <span className="font-extrabold">{peso(subtotal * (1 + IVA))}</span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {ticket.estado === 'por_facturar' && (
            <Button onClick={() => accion('se generaría el borrador de factura en Odoo')} className="!px-4 !py-2">
              <IconCheck size={14} />
              Generar borrador de factura
            </Button>
          )}
          {ticket.estado === 'borrador' && (
            <>
              <Button onClick={() => accion('se actualizaría el borrador con los cambios')} className="!px-4 !py-2">
                Actualizar borrador
              </Button>
              <Button variant="ghost" onClick={() => accion('se abriría el borrador en Odoo')} className="!px-3 !py-2">
                Ver en Odoo
              </Button>
            </>
          )}
          <Button variant="ghost" onClick={() => setVerPdf(true)} className="!px-3 !py-2">
            <IconDownload size={14} />
            Generar PDF
          </Button>
          {ticket.estado === 'facturada' && <span className="text-xs font-semibold text-muted">Factura emitida: las líneas no se pueden modificar.</span>}
          {aviso && <span className="text-xs font-bold text-warning-700">{aviso}</span>}
        </div>
      </Card>

      {verPdf && <VistaPreviaPdf ticket={ticket} lineas={lineasPdf} pendientes={pendientes} onCerrar={() => setVerPdf(false)} />}
    </div>
  );
}

type LineaPdf = { concepto: string; codigo: string; cantidad: number; unitario: number };

// Mismo lenguaje visual que las hojas de conformidad (packages/shared/src/printHtml.ts): misma paleta, cabecera con
// logo e insignias, banner de título, tabla de datos con claves en tinte y banners de sección.
const ESTILO_PDF = `
  .pdf-fact { --primary:#AD1838; --secondary:#9D273C; --dark:#22293F; --tint:#FBEFF1; --border:#DCD4D6; background:#fff; color:var(--dark); font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:11.5px; padding:24px; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .pdf-fact * { box-sizing:border-box; }
  .pf-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
  .pf-logo { height:30px; display:block; }
  .pf-header-badges { display:flex; align-items:center; gap:8px; }
  .pf-ticket-badge { background:var(--tint); border:1px solid var(--secondary); color:var(--secondary); font-weight:700; font-size:11.5px; padding:5px 12px; border-radius:4px; letter-spacing:.2px; }
  .pf-numero-badge { background:var(--dark); color:#fff; font-weight:700; font-size:12.5px; padding:6px 14px; border-radius:4px; letter-spacing:.3px; }
  .pf-title-banner { background:var(--primary); color:#fff; border-radius:6px; padding:9px 14px; display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
  .pf-t { font-weight:800; font-size:15px; letter-spacing:.3px; text-transform:uppercase; }
  .pf-pills { display:flex; align-items:center; gap:6px; }
  .pf-pill { background:rgba(255,255,255,.18); border:1px solid rgba(255,255,255,.5); border-radius:20px; padding:3px 11px; font-size:10.5px; font-weight:600; }
  .pf-info { width:100%; border-collapse:collapse; margin-bottom:12px; font-size:11.5px; break-inside:avoid; }
  .pf-info td { border:1px solid var(--border); padding:6px 9px; }
  .pf-info .k { background:var(--tint); font-weight:700; color:var(--secondary); width:15%; white-space:nowrap; }
  .pf-info .v { width:35%; }
  .pf-section { background:var(--secondary); color:#fff; font-weight:700; font-size:12px; text-transform:uppercase; letter-spacing:.3px; padding:6px 10px; border-radius:4px; margin:10px 0 6px; }
  .pf-table { width:100%; border-collapse:collapse; font-size:10.8px; margin-bottom:8px; }
  .pf-table th { background:var(--tint); color:var(--dark); border:1px solid var(--border); padding:6px 8px; text-align:left; }
  .pf-table td { border:1px solid var(--border); padding:5px 8px; vertical-align:top; }
  .pf-table tr { break-inside:avoid; }
  .pf-table .c { text-align:center; } .pf-table .r { text-align:right; }
  .pf-totales { margin-left:auto; width:260px; border-collapse:collapse; font-size:11.5px; break-inside:avoid; }
  .pf-totales td { border:1px solid var(--border); padding:6px 9px; }
  .pf-totales .k { background:var(--tint); font-weight:700; color:var(--secondary); }
  .pf-totales .v { text-align:right; font-weight:700; }
  .pf-totales .tot .k { background:var(--dark); color:#fff; } .pf-totales .tot .v { background:var(--dark); color:#fff; font-size:13px; }
  .pf-keep { break-inside:avoid; }
  .pf-obs-label { font-weight:700; color:var(--secondary); font-size:11px; margin:12px 0 4px; text-transform:uppercase; letter-spacing:.2px; }
  .pf-obs-box { border:1px solid var(--border); border-radius:5px; padding:8px 10px; font-size:11px; background:#fff; }
  .pf-foot { margin-top:18px; border-top:1px solid var(--border); padding-top:8px; text-align:center; font-size:10px; color:#6b6367; }
`;

// MAQUETA del PDF: vista previa en pantalla y "Imprimir / guardar como PDF" con el diálogo del navegador. La versión real
// lo generaría la API (como el resto de los PDF, con renderPdfBuffer) y lo adjuntaría al ticket de Odoo.
// El @media print oculta todo menos el documento, así el PDF sale solo con la hoja.
function VistaPreviaPdf({
  ticket,
  lineas,
  pendientes,
  onCerrar,
}: {
  ticket: TicketFacturable;
  lineas: LineaPdf[];
  pendientes: LineaUnidad[];
  onCerrar: () => void;
}) {
  const neto = lineas.reduce((n, l) => n + l.unitario * l.cantidad, 0);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60 print:static print:bg-transparent">
      <style>{`@media print { body * { visibility: hidden !important; } #pdf-facturacion, #pdf-facturacion * { visibility: visible !important; } #pdf-facturacion { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; padding: 14mm !important; box-sizing: border-box; } @page { size: A4; margin: 0; } }`}</style>
      <div className="flex items-center justify-between gap-3 bg-surface px-4 py-3 print:hidden">
        <div className="text-sm font-extrabold">Vista previa del PDF · Ticket #{ticket.id}</div>
        <div className="flex items-center gap-2">
          <Button onClick={() => window.print()} className="!px-4 !py-2">
            <IconDownload size={14} />
            Imprimir / guardar como PDF
          </Button>
          <Button variant="ghost" onClick={onCerrar} className="!px-3 !py-2">
            Cerrar
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 print:overflow-visible print:p-0">
        <style>{ESTILO_PDF}</style>
        <div id="pdf-facturacion" className="pdf-fact mx-auto w-full max-w-[794px] shadow-soft">
          <div className="pf-header">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="pf-logo" src="/logo-wara.png" alt="WARA" />
            <div className="pf-header-badges">
              <div className="pf-ticket-badge">Ticket Odoo: #{ticket.id}</div>
              <div className="pf-numero-badge">OV {ticket.orden}</div>
            </div>
          </div>
          <div className="pf-title-banner">
            <span className="pf-t">Detalle de facturación</span>
            <div className="pf-pills">
              <span className="pf-pill">Ticket #{ticket.id}</span>
              <span className="pf-pill">{ESTADO_FACTURA[ticket.estado].label}</span>
            </div>
          </div>

          <table className="pf-info">
            <tbody>
              <tr>
                <td className="k">Cliente</td>
                <td className="v">{ticket.cliente}</td>
                <td className="k">CUIT</td>
                <td className="v">{ticket.cuit}</td>
              </tr>
              <tr>
                <td className="k">Servicio</td>
                <td className="v">{ticket.titulo}</td>
                <td className="k">Orden de venta</td>
                <td className="v" style={{ fontWeight: 700, color: 'var(--secondary)' }}>
                  {ticket.orden}
                </td>
              </tr>
              {ticket.factura && (
                <tr>
                  <td className="k">Factura</td>
                  <td className="v">{ticket.factura.numero}</td>
                  <td className="k">Fecha</td>
                  <td className="v">{ticket.factura.fecha}</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="pf-section">Productos y servicios a facturar</div>
          <table className="pf-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Descripción</th>
                <th>Unidad / concepto</th>
                <th className="c">Cant.</th>
                <th className="r">Unitario</th>
                <th className="r">Importe</th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 700 }}>{l.codigo}</td>
                  <td>{productoPorCodigo(l.codigo)?.nombre}</td>
                  <td style={{ color: '#6b6367' }}>{l.concepto}</td>
                  <td className="c">{l.cantidad}</td>
                  <td className="r">{peso(l.unitario)}</td>
                  <td className="r" style={{ fontWeight: 700 }}>
                    {peso(l.unitario * l.cantidad)}
                  </td>
                </tr>
              ))}
              {!lineas.length && (
                <tr>
                  <td colSpan={6} className="c" style={{ color: '#6b6367' }}>
                    No hay líneas para facturar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <table className="pf-totales">
            <tbody>
              <tr>
                <td className="k">Neto</td>
                <td className="v">{peso(neto)}</td>
              </tr>
              <tr>
                <td className="k">IVA 21%</td>
                <td className="v">{peso(neto * IVA)}</td>
              </tr>
              <tr className="tot">
                <td className="k">Total</td>
                <td className="v">{peso(neto * (1 + IVA))}</td>
              </tr>
            </tbody>
          </table>

          {pendientes.length > 0 && (
            <div className="pf-keep">
              <div className="pf-obs-label">Pedidas y no incluidas en este detalle</div>
              <div className="pf-obs-box">
                {pendientes.map((u) => (
                  <div key={u.id}>
                    {u.patente}: {u.pedido} {productoPorCodigo(u.pedido)?.nombre}
                    {u.nota ? ` (${u.nota})` : ''}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pf-foot">Documento de maqueta: no es un comprobante fiscal. Los precios son de ejemplo.</div>
        </div>
      </div>
    </div>
  );
}

function FilaUnidad({ u, precio }: { u: LineaUnidad; precio: (codigo: string) => number }) {
  const p = productoPorCodigo(u.pedido);
  const distinto = u.hecho !== null && u.hecho !== u.pedido;
  return (
    <tr className="border-t border-line align-top">
      <td className="px-4 py-2.5">
        <div className="font-extrabold">{u.patente}</div>
        {u.nota && <div className="text-xs font-semibold text-muted">{u.nota}</div>}
      </td>
      <td className="px-3 py-2.5">
        <span className="font-bold">{u.pedido}</span> <span className="text-muted">{p?.nombre}</span>
        {distinto && <div className="text-xs font-bold text-warning-700">Se hizo {u.hecho}</div>}
      </td>
      <td className="px-3 py-2.5">
        <Badge tone={ESTADO_HOJA[u.hoja].tone}>{ESTADO_HOJA[u.hoja].label}</Badge>
      </td>
      <td className="px-3 py-2.5 text-right">{peso(precio(u.pedido))}</td>
      <td className={`px-4 py-2.5 text-right font-bold ${u.hecho ? '' : 'text-muted line-through'}`}>{peso(precio(u.hecho ?? u.pedido) * u.cantidad)}</td>
    </tr>
  );
}

function AgregarDesdeCatalogo({ onAgregar }: { onAgregar: (p: ProductoOdoo) => void }) {
  const [q, setQ] = useState('');
  const resultados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return CATALOGO.filter((p) => p.codigo.toLowerCase().includes(t) || p.nombre.toLowerCase().includes(t)).slice(0, 6);
  }, [q]);

  return (
    <Card className="p-4">
      <div className="text-sm font-extrabold">Agregar producto del catálogo de Odoo</div>
      <div className="relative mt-2">
        <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por código o nombre (ej. VIS.003, cámara, desinstalación)"
          className="w-full rounded-md border border-line bg-surface py-2 pl-9 pr-3 text-sm font-semibold"
        />
      </div>
      {resultados.length > 0 && (
        <div className="mt-2 flex flex-col overflow-hidden rounded-md border border-line">
          {resultados.map((p) => (
            <button
              key={p.codigo}
              type="button"
              onClick={() => {
                onAgregar(p);
                setQ('');
              }}
              className="flex items-center justify-between gap-3 border-b border-line px-3 py-2 text-left text-sm last:border-b-0 hover:bg-bg"
            >
              <span className="min-w-0">
                <span className="font-extrabold">{p.codigo}</span> <span className="text-muted">{p.nombre}</span>
                <span className="block text-xs font-semibold text-muted">{TIPO_LABEL[p.tipo]}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2 font-bold">
                {peso(p.precio)} <IconPlus size={14} />
              </span>
            </button>
          ))}
        </div>
      )}
      {q.trim() && !resultados.length && <div className="mt-2 text-xs font-semibold text-muted">Ningún producto coincide.</div>}
    </Card>
  );
}
