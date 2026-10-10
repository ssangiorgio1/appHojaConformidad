// HTML del acta de retiro o de entrega de equipo (el título sale de la modalidad) que se adjunta al ticket de Odoo. Ver docs-retiro-entrega-equipo.md.
import { formatoFechaHora } from './reprogramacionPdf.js';

export interface RetiroEquipoPdfData {
  subtareaNombre: string;
  clienteNombre: string;
  ticketNumero: number | null;
  tecnicoNombre: string;
  modalidad: 'entrega' | 'deja_para_retirar';
  fechaHora: Date;
  equipo: { numero?: string | null; imei?: string | null; estado?: string | null };
  equiposExtra?: Array<{ numero?: string | null; imei?: string | null }> | null;
  adicionales: Array<{ nombre: string; recibido: boolean }>;
  entrega: { nombre?: string | null; telefono?: string | null; lugar?: string | null };
  observaciones?: string | null;
  firma?: { url?: string | null; nombreFirmante?: string | null; motivo?: string | null } | null;
  fotos?: Array<{ url: string }> | null;
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

const ESTADO: Record<string, string> = { completo: 'Completo', danado: 'Dañado', incompleto: 'Incompleto' };

function fila(etiqueta: string, valor: string | null | undefined): string {
  return valor ? `<tr><td>${esc(etiqueta)}</td><td>${esc(valor)}</td></tr>` : '';
}

export function buildRetiroEquipoHtml(data: RetiroEquipoPdfData, logoDataUri?: string): string {
  const resumen =
    data.modalidad === 'entrega'
      ? 'El cliente entregó el equipo en mano al técnico. No se intervino la unidad.'
      : 'El técnico dejó el equipo entregado. No se intervino la unidad.';
  const recibidos = data.adicionales.filter((a) => a.recibido);
  const faltantes = data.adicionales.filter((a) => !a.recibido);
  const adicionales = data.adicionales.length
    ? `<h2>Adicionales</h2>
  <table>
    ${recibidos.length ? `<tr><td>Recibidos</td><td>${esc(recibidos.map((a) => a.nombre).join(', '))}</td></tr>` : ''}
    ${faltantes.length ? `<tr><td class="falta">Faltantes</td><td class="falta">${esc(faltantes.map((a) => a.nombre).join(', '))}</td></tr>` : ''}
  </table>`
    : '';
  const firma = data.firma?.url
    ? `<img class="firma" src="${esc(data.firma.url)}" alt="Firma">${data.firma.nombreFirmante ? `<div>${esc(data.firma.nombreFirmante)}</div>` : ''}`
    : `<div class="sinfirma">Sin persona para firmar${data.firma?.motivo ? `: ${esc(data.firma.motivo)}` : ''}</div>`;
  const fotos = data.fotos?.length
    ? `<h2>Fotos</h2>
  <div class="fotos">${data.fotos.map((f) => `<img src="${esc(f.url)}" alt="Foto">`).join('')}</div>`
    : '';
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><style>
  body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; margin: 32px; font-size: 14px; }
  header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; }
  header img { height: 44px; }
  h1 { font-size: 20px; margin: 0; }
  h2 { font-size: 15px; margin: 22px 0 0; }
  .unidad { font-size: 28px; font-weight: bold; margin: 24px 0 4px; }
  .resumen { background: #f1f5f9; border-left: 4px solid #0f766e; padding: 12px 16px; margin: 20px 0; font-size: 16px; }
  table { border-collapse: collapse; width: 100%; margin-top: 8px; }
  td { padding: 6px 0; vertical-align: top; }
  td:first-child { width: 160px; color: #555; }
  .falta { color: #b91c1c; font-weight: bold; }
  .firma { height: 90px; margin-top: 8px; border-bottom: 1px solid #1a1a1a; }
  .fotos { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
  .fotos img { width: 48%; max-height: 320px; object-fit: contain; border: 1px solid #ddd; }
  .sinfirma { margin-top: 8px; padding: 10px 12px; border: 1px dashed #888; color: #555; }
</style></head><body>
  <header><h1>${data.modalidad === 'entrega' ? 'Acta de retiro de equipo' : 'Acta de entrega de equipo'}</h1>${logoDataUri ? `<img src="${logoDataUri}" alt="WARA">` : ''}</header>
  <div class="unidad">${esc(data.subtareaNombre || 'Equipo')}</div>
  <div>${esc(data.clienteNombre)}${data.ticketNumero ? ` · Ticket #${esc(data.ticketNumero)}` : ''}</div>
  <div class="resumen">${esc(resumen)}</div>
  <table>
    <tr><td>Modalidad</td><td>${data.modalidad === 'entrega' ? 'El cliente lo entrega' : 'El técnico lo deja entregado'}</td></tr>
    ${fila('Equipo N°', data.equipo.numero)}
    ${fila('IMEI', data.equipo.imei)}
    ${(data.equiposExtra ?? [])
      .map((e, i) => fila(`Equipo ${i + 2} N°`, e.numero) + fila(`Equipo ${i + 2} IMEI`, e.imei))
      .join('')}
    ${fila('Estado', data.equipo.estado ? (ESTADO[data.equipo.estado] ?? data.equipo.estado) : '')}
    ${fila(data.modalidad === 'entrega' ? 'Entrega' : 'Queda con', data.entrega.nombre)}
    ${fila('Teléfono', data.entrega.telefono)}
    ${fila('Lugar', data.entrega.lugar)}
    ${fila('Observaciones', data.observaciones)}
    <tr><td>Técnico</td><td>${esc(data.tecnicoNombre)}</td></tr>
    <tr><td>Fecha y hora</td><td>${esc(formatoFechaHora(data.fechaHora))}</td></tr>
  </table>
  ${adicionales}
  ${fotos}
  <h2>Firma</h2>
  ${firma}
</body></html>`;
}
