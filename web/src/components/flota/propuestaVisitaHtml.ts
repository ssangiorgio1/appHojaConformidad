import type { FlotaCategoria, FlotaUnidad } from '@/lib/types';

// Lo que sale hacia el cliente: sus unidades, el día y franja propuestos, el técnico y qué tener listo.
// No lleva coordenadas, otros clientes ni datos internos.
export interface PropuestaCliente {
  clienteNombre: string;
  unidades: { u: FlotaUnidad; zona: string | null; distrito: string | null }[];
  fecha: string; // yyyy-mm-dd o ''
  franja: string;
  // Datos propios de cada documento.
  tecnico: string;
  contacto: string;
  queTenerListo: string;
}

export interface PropuestaComun {
  /** N° de equipo (serie del diagnóstico) por `equipoId`; se muestra una columna si se pasa. */
  series?: Record<number, { serie: string | null } | null>;
}

const ESTADO_PARA_CLIENTE: Partial<Record<FlotaCategoria, string>> = {
  sin_reportar_24h: 'Sin reportar hace 1 a 2 días',
  sin_reportar_48h: 'Sin reportar hace 2 a 3 días',
  sin_reportar_72h: 'Sin reportar hace más de 3 días',
  corte_sin_reportar: 'Sin reportar',
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function fechaLarga(iso: string): string {
  if (!iso) return 'A coordinar con usted';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function ultimoReporte(ts: number | null): string {
  return ts
    ? new Date(ts * 1000).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour12: false, dateStyle: 'short', timeStyle: 'short' })
    : 'Sin registro';
}

function lugares(p: PropuestaCliente): string {
  const z = new Set<string>();
  for (const { zona, distrito } of p.unidades) {
    if (!zona) continue;
    z.add(distrito ? `${zona} (${distrito.split('|')[1]})` : zona);
  }
  return [...z].join(', ');
}

function logoUrl(): string {
  return typeof window !== 'undefined' ? `${window.location.origin}/logo-wara.png` : '';
}

function fechaCorta(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function pagina(p: PropuestaCliente, c: PropuestaComun, logo: string): string {
  const filas = p.unidades
    .map(
      ({ u }) => `<tr>
        <td>${esc(u.nombre)}</td>
        <td>${esc(u.matricula ?? '—')}</td>
        <td>${esc(u.interno ?? '—')}</td>
        ${c.series ? `<td>${esc((u.equipoId !== null && c.series[u.equipoId]?.serie) || '—')}</td>` : ''}
        <td>${esc(ESTADO_PARA_CLIENTE[u.categoria] ?? 'Sin reportar')}</td>
        <td>${esc(ultimoReporte(u.ultimoReporte))}</td>
      </tr>`,
    )
    .join('');
  const lista = p.queTenerListo
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<li>${esc(l)}</li>`)
    .join('');
  const zonas = lugares(p);
  const emitido = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const franja = p.franja || 'A coordinar';
  const n = p.unidades.length;
  return `<section class="pagina">
    <div class="header">
      ${logo ? `<img class="logo-img" src="${esc(logo)}" alt="WARA">` : '<div class="logo-fallback">WARA · Seguimiento y Control</div>'}
      <div class="header-badges">
        <div class="ticket-badge">${n} unidad${n === 1 ? '' : 'es'} a revisar</div>
        <div class="numero-badge">${esc(emitido)}</div>
      </div>
    </div>
    <div class="title-banner">
      <span class="t">Propuesta de visita técnica</span>
      <div class="banner-pills">
        <span class="status-pill">${p.fecha ? esc(fechaCorta(p.fecha)) : 'Día a coordinar'}</span>
        <span class="status-pill">${esc(franja)}</span>
      </div>
    </div>

    <div class="keep-together">
      <table class="info-table">
        <tr><td class="k">Cliente</td><td class="v" colspan="3">${esc(p.clienteNombre)}</td></tr>
        <tr><td class="k">Día propuesto</td><td class="v">${esc(fechaLarga(p.fecha))}</td><td class="k">Franja horaria</td><td class="v">${esc(franja)}</td></tr>
        <tr><td class="k">Técnico</td><td class="v"${zonas ? '' : ' colspan="3"'}>${esc(p.tecnico || 'A designar')}</td>${zonas ? `<td class="k">Zona</td><td class="v">${esc(zonas)}</td>` : ''}</tr>
      </table>
    </div>

    <p class="intro">Detectamos que ${n === 1 ? 'la siguiente unidad dejó' : 'las siguientes unidades dejaron'} de reportar su posición. Para revisar y dejar ${n === 1 ? 'el equipo' : 'los equipos'} funcionando, le proponemos la siguiente visita.</p>

    <div class="keep-together">
      <div class="section-banner">Unidades a revisar</div>
      <table class="check-table">
        <thead><tr><th>Unidad</th><th>Patente</th><th>Interno</th>${c.series ? '<th>N° de equipo</th>' : ''}<th>Estado</th><th>Último reporte</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>

    ${lista ? `<div class="keep-together"><div class="section-banner">Qué tener listo</div><ul class="lista">${lista}</ul></div>` : ''}

    <div class="keep-together">
      <div class="section-banner">Cómo confirmar</div>
      <div class="obs-box">Para confirmar, cambiar el día o la hora, o indicarnos dónde estará la unidad, comuníquese con ${esc(p.contacto || 'coordinación de WARA')}.</div>
      <div class="pie">Si la unidad ya no está en servicio o fue retirada, avísenos para actualizar sus datos.</div>
    </div>
  </section>`;
}

// Mismo estilo que el PDF de las hojas de conformidad (packages/shared/src/printHtml.ts).
export function propuestasHtml(propuestas: PropuestaCliente[], c: PropuestaComun): string {
  const logo = logoUrl();
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Propuesta de visita</title><style>
  :root {
    --primary: #AD1838;
    --secondary: #9D273C;
    --dark: #22293F;
    --tint: #FBEFF1;
    --border: #DCD4D6;
    color-scheme: light;
  }
  /* Margen 0 en la hoja: así Chrome no imprime la fecha, el título ni la dirección arriba y abajo. El margen real lo da cada .pagina. */
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { background: #fff; }
  body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: var(--dark); font-size: 11.5px; margin: 0; padding: 0; }
  .pagina { padding: 14mm 12mm; page-break-after: always; break-after: page; }
  .pagina:last-child { page-break-after: auto; break-after: auto; }

  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .logo-img { height: 30px; display: block; }
  .logo-fallback { font-weight: 800; color: var(--primary); font-size: 17px; }
  .header-badges { display: flex; align-items: center; gap: 8px; }
  .ticket-badge { background: var(--tint); border: 1px solid var(--secondary); color: var(--secondary); font-weight: 700; font-size: 11.5px; padding: 5px 12px; border-radius: 4px; letter-spacing: 0.2px; }
  .numero-badge { background: var(--dark); color: #fff; font-weight: 700; font-size: 12.5px; padding: 6px 14px; border-radius: 4px; letter-spacing: 0.3px; }

  .title-banner { background: var(--primary); color: #fff; border-radius: 6px; padding: 9px 14px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .title-banner .t { font-weight: 800; font-size: 15px; letter-spacing: 0.3px; text-transform: uppercase; }
  .banner-pills { display: flex; align-items: center; gap: 6px; }
  .status-pill { background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.5); border-radius: 20px; padding: 3px 11px; font-size: 10.5px; font-weight: 600; }

  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11.5px; }
  .info-table td { border: 1px solid var(--border); padding: 6px 9px; }
  .info-table .k { background: var(--tint); font-weight: 700; color: var(--secondary); width: 15%; white-space: nowrap; }
  .info-table .v { width: 35%; }

  .intro { margin: 0 0 6px; font-size: 11.5px; }
  .section-banner { background: var(--secondary); color: #fff; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px; padding: 6px 10px; border-radius: 4px; margin: 10px 0 6px; }
  .check-table { width: 100%; border-collapse: collapse; font-size: 10.8px; margin-bottom: 4px; }
  .check-table th { background: var(--tint); color: var(--dark); border: 1px solid var(--border); padding: 6px 8px; text-align: left; }
  .check-table td { border: 1px solid var(--border); padding: 5px 8px; vertical-align: top; }
  .lista { margin: 4px 0 0; padding-left: 20px; font-size: 11px; }
  .lista li { margin-bottom: 3px; }
  .obs-box { border: 1px solid var(--border); border-radius: 5px; padding: 8px 10px; font-size: 11px; min-height: 34px; margin-bottom: 8px; background: #fff; }
  .pie { color: #6b7280; font-size: 10.5px; margin-top: 6px; }
  .keep-together { display: flow-root; page-break-inside: avoid; break-inside: avoid; }
</style></head><body>${propuestas.map((p) => pagina(p, c, logo)).join('')}</body></html>`;
}

/** Abre el documento en una pestaña y lanza el diálogo de impresión (ahí se elige "Guardar como PDF"). */
export function imprimirPropuestas(propuestas: PropuestaCliente[], c: PropuestaComun): boolean {
  // Se abre y escribe de forma síncrona: un window.open posterior a un await lo bloquea el navegador.
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.open();
  win.document.write(propuestasHtml(propuestas, c));
  win.document.close();
  win.focus();
  // Se espera al logo para que salga en el PDF (con un tope por si no carga).
  const imprimir = () => win.print();
  const img = win.document.querySelector('img');
  if (img && !img.complete) {
    const t = setTimeout(imprimir, 2500);
    img.addEventListener('load', () => {
      clearTimeout(t);
      setTimeout(imprimir, 100);
    });
    img.addEventListener('error', () => {
      clearTimeout(t);
      imprimir();
    });
  } else {
    setTimeout(imprimir, 300);
  }
  return true;
}
