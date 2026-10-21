// Hoja de ruta impresa: misma paleta y estructura que la hoja de conformidad (packages/shared/src/printHtml.ts).
import type { Estado } from './logica';
import { TECNICOS, productoPorId, type TransferenciaMock } from './mock';

export type PasoHoja = { label: string; hecho: boolean; cuando?: string };

const ESTADO_LABEL: Record<TransferenciaMock['estado'], string> = {
  pendiente: 'Preparando carga',
  recibida: 'Recibida',
};

const firma = (img?: string) => (img ? `<img src="${img}" alt="Firma"><div style="border-bottom:1px solid #22293F;margin-bottom:4px"></div>` : '<div class="sig-line"></div>');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function fechaHora(iso?: string) {
  if (!iso) return null;
  const [f, h] = iso.split('T');
  const [, m, d] = f.split('-');
  return `${d}/${m} ${h.slice(0, 5)}`;
}

// Lo que el técnico trae en una devolución: lo retirado de unidades va al laboratorio, lo no usado vuelve al depósito.
export function destinoDevolucion(estado: Estado, t: TransferenciaMock, productoId: string, series?: string[]) {
  const item = estado.tecnicos.find((s) => s.tecnicoId === t.tecnicoId && s.productoId === productoId);
  if (!item?.series) return 'Depósito';
  const elegidas = item.series.filter((s) => !series || series.includes(s.serie));
  const lab = elegidas.filter((s) => s.estado === 'retirado').length;
  if (!lab) return 'Depósito';
  return lab === elegidas.length ? 'Laboratorio' : `Laboratorio (${lab}) y depósito`;
}

const ESTILOS = `
  :root { --primary:#AD1838; --secondary:#9D273C; --dark:#22293F; --tint:#FBEFF1; --border:#DCD4D6; --ok:#1f7a3d; --okBg:#e6f4ea; }
  @page { size: A4; margin: 0; }
  html { color-scheme: light; background:#fff; }
  * { box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { font-family:'Segoe UI',Arial,Helvetica,sans-serif; color:var(--dark); font-size:11.5px; margin:0; padding:14mm 12mm; background:#fff; }
  .header { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
  .logo-img { height:30px; display:block; }
  .numero-badge { background:var(--dark); color:#fff; font-weight:700; font-size:12.5px; padding:6px 14px; border-radius:4px; }
  .title-banner { background:var(--primary); color:#fff; border-radius:6px; padding:9px 14px; display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
  .title-banner .t { font-weight:800; font-size:15px; letter-spacing:.3px; text-transform:uppercase; }
  .pill { background:rgba(255,255,255,.18); border:1px solid rgba(255,255,255,.5); border-radius:20px; padding:3px 11px; font-size:10.5px; font-weight:600; }
  .info { width:100%; border-collapse:collapse; margin-bottom:12px; }
  .info td { border:1px solid var(--border); padding:6px 9px; }
  .info .k { background:var(--tint); font-weight:700; color:var(--secondary); width:15%; white-space:nowrap; }
  .section-banner { background:var(--secondary); color:#fff; font-weight:700; font-size:12px; text-transform:uppercase; letter-spacing:.3px; padding:6px 10px; border-radius:4px; margin:10px 0 6px; }
  .pasos { display:flex; gap:7px; }
  .paso { flex:1; border:1px solid var(--border); border-radius:5px; padding:6px 8px; display:flex; flex-direction:column; gap:2px; font-size:10.5px; color:#6b6367; }
  .paso b { color:var(--dark); } .paso.hecho { background:var(--okBg); border-color:var(--ok); } .paso.hecho b { color:var(--ok); }
  .paso .n { font-size:11px; font-weight:800; color:var(--ok); min-height:13px; }
  table.lineas { width:100%; border-collapse:collapse; font-size:11px; }
  .lineas th { background:var(--tint); border:1px solid var(--border); padding:6px 8px; text-align:left; font-size:10px; text-transform:uppercase; }
  .lineas td { border:1px solid var(--border); padding:6px 8px; vertical-align:top; }
  .lineas tr { break-inside:avoid; } .c { text-align:center; width:34px; } .mono { font-family:Consolas,monospace; font-size:10px; }
  .obs { border:1px solid var(--border); border-radius:5px; min-height:44px; padding:8px 10px; }
  .sig-row { display:flex; gap:20px; margin-top:6px; break-inside:avoid; }
  .sig img { max-width:100%; max-height:72px; display:block; margin:0 auto; background:#fff; }
  .sig { flex:1; text-align:center; } .sig-line { border-bottom:1px solid var(--dark); height:72px; margin-bottom:4px; }
  .sig-caption { font-size:10px; color:#6b6367; font-weight:600; }
`;

// Los pasos de la hoja de ruta; el segundo cambia según el sentido (cargar en el depósito o recolectar del técnico).
export function pasosDe(t: TransferenciaMock): PasoHoja[] {
  const aTecnico = t.sentido === 'a_tecnico';
  const cargada = t.lineas.every((l) => t.cargadas.includes(l.productoId));
  return [
    { label: 'Creada', hecho: true, cuando: t.hitos.creada },
    { label: aTecnico ? 'Cargada' : 'Recolectada', hecho: cargada || t.estado !== 'pendiente' },
    { label: 'Entregada y firmada', hecho: t.estado === 'recibida', cuando: t.hitos.recibida },
  ];
}

// El documento completo (HTML autónomo): se muestra en el visor o se manda a la impresora.
export function htmlHojaRuta(estado: Estado, t: TransferenciaMock, conImpresion = false) {
  const pasos = pasosDe(t);
  const tecnico = TECNICOS.find((x) => x.id === t.tecnicoId)!;
  const aTecnico = t.sentido === 'a_tecnico';
  const origen = aTecnico ? 'Depósito' : tecnico.nombre;
  const destino = aTecnico ? tecnico.nombre : 'Depósito / Laboratorio';

  const filas = t.lineas
    .map((l) => {
      const p = productoPorId(l.productoId);
      const hecha = t.cargadas.includes(l.productoId) || t.estado !== 'pendiente';
      const dest = aTecnico ? '' : `<td>${esc(destinoDevolucion(estado, t, l.productoId, l.series))}</td>`;
      return `<tr><td class="c">${hecha ? '☑' : '☐'}</td><td>${esc(p.codigo)}</td><td>${esc(p.nombre)}</td><td class="c"><b>${l.cantidad}</b></td><td class="mono">${esc(l.series?.join(', ') ?? '—')}</td>${dest}</tr>`;
    })
    .join('');
  const pasosHtml = pasos
    .map((p) => `<div class="paso${p.hecho ? ' hecho' : ''}"><span class="n">${p.hecho ? '✓' : ''}</span><b>${esc(p.label)}</b><span>${fechaHora(p.cuando) ?? '&nbsp;'}</span></div>`)
    .join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Hoja de ruta ${esc(t.id)}</title><style>${ESTILOS}</style></head><body>
    <div class="header">
      <img class="logo-img" src="${location.origin}/logo-wara.png" alt="WARA">
      <div class="numero-badge">N° ${esc(t.id)}</div>
    </div>
    <div class="title-banner"><span class="t">Hoja de Ruta</span><div><span class="pill">${aTecnico ? 'Entrega de stock' : 'Devolución'}</span> <span class="pill">${ESTADO_LABEL[t.estado]}</span></div></div>
    <table class="info">
      <tr><td class="k">Origen</td><td>${esc(origen)}</td><td class="k">Destino</td><td>${esc(destino)}</td></tr>
      <tr><td class="k">Técnico</td><td>${esc(tecnico.nombre)}</td><td class="k">Zona</td><td>${esc(tecnico.zona)}</td></tr>
      <tr><td class="k">Creada</td><td>${fechaHora(t.hitos.creada)}</td><td class="k">Ítems</td><td>${t.lineas.length} ${t.lineas.length === 1 ? 'línea' : 'líneas'}</td></tr>
    </table>
    <div class="section-banner">Seguimiento</div><div class="pasos">${pasosHtml}</div>
    <div class="section-banner">${aTecnico ? 'Carga a entregar' : 'Equipos y materiales a recolectar'}</div>
    <table class="lineas"><thead><tr><th class="c"></th><th>Código</th><th>Producto</th><th class="c">Cant.</th><th>Nº de serie</th>${aTecnico ? '' : '<th>Destino</th>'}</tr></thead><tbody>${filas}</tbody></table>
    <div class="section-banner">Observaciones</div><div class="obs"></div>
    <div class="section-banner">Conformidad</div>
    <div class="sig-row">
      <div class="sig">${firma(t.firmas?.entrega)}<div class="sig-caption">Entrega: ${esc(origen)}</div></div>
      <div class="sig">${firma(t.firmas?.recibe)}<div class="sig-caption">Recibe: ${esc(destino)}</div></div>
    </div>
    ${conImpresion ? '<script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>' : ''}</body></html>`;
  return html;
}

export function imprimirHojaRuta(estado: Estado, t: TransferenciaMock) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(htmlHojaRuta(estado, t, true));
  w.document.close();
}
