// HTML de la constancia de visita fallida que se adjunta al ticket de Odoo: el técnico llegó a tiempo y la unidad
// no estaba. Es el respaldo para facturar VIS.003. Si la unidad no estaba porque el técnico llegó tarde, NO va esta
// constancia sino el PDF de reprogramación sin cargo (ver reprogramacionPdf.ts). Ver docs-visita-fallida-pdf.md.
import { formatoFechaHora, formatoHora } from './reprogramacionPdf.js';

export interface ConstanciaVisitaFallidaData {
  subtareaNombre: string;
  clienteNombre: string;
  ticketNumero: number;
  tecnicoNombre: string;
  horaAgendada?: Date | null;
  // Cuándo marcó "llegué" el técnico: la prueba de presencia.
  llegadaAt?: Date | null;
  reportadaAt: Date;
  motivo: string;
  // Si ya se reprogramó, para cuándo.
  nuevaInicio?: Date | null;
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function buildConstanciaVisitaFallidaHtml(data: ConstanciaVisitaFallidaData, logoDataUri?: string): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><style>
  body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; margin: 32px; font-size: 14px; }
  header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; }
  header img { height: 44px; }
  h1 { font-size: 20px; margin: 0; }
  .unidad { font-size: 28px; font-weight: bold; margin: 24px 0 4px; }
  .resumen { background: #fef2f2; border-left: 4px solid #b91c1c; padding: 12px 16px; margin: 20px 0; font-size: 16px; }
  .fecha { background: #f1f5f9; border-left: 4px solid #0f766e; padding: 12px 16px; margin: 20px 0; }
  table { border-collapse: collapse; width: 100%; margin-top: 16px; }
  td { padding: 6px 0; vertical-align: top; }
  td:first-child { width: 160px; color: #555; }
  .nota { color: #555; font-size: 12px; margin-top: 24px; }
</style></head><body>
  <header><h1>Constancia de visita fallida</h1>${logoDataUri ? `<img src="${logoDataUri}" alt="WARA">` : ''}</header>
  <div class="unidad">${esc(data.subtareaNombre || 'Unidad')}</div>
  <div>${esc(data.clienteNombre)} · Ticket #${esc(data.ticketNumero)}</div>
  <div class="resumen">El técnico se presentó en el lugar${data.horaAgendada ? ` a la hora agendada (${esc(formatoHora(data.horaAgendada))})` : ''} y la unidad no se encontraba. No fue posible realizar el trabajo.</div>
  <table>
    <tr><td>Motivo</td><td>${esc(data.motivo)}</td></tr>
    <tr><td>Técnico</td><td>${esc(data.tecnicoNombre)}</td></tr>
    ${data.horaAgendada ? `<tr><td>Hora agendada</td><td>${esc(formatoFechaHora(data.horaAgendada))}</td></tr>` : ''}
    ${data.llegadaAt ? `<tr><td>Llegada del técnico</td><td>${esc(formatoFechaHora(data.llegadaAt))}</td></tr>` : ''}
    <tr><td>Reportado</td><td>${esc(formatoFechaHora(data.reportadaAt))}</td></tr>
  </table>
  ${data.nuevaInicio ? `<div class="fecha">La visita se reprograma para el <b>${esc(formatoFechaHora(data.nuevaInicio))}</b>.</div>` : ''}
  <p class="nota">Esta visita se considera realizada y es facturable como visita fallida.</p>
</body></html>`;
}
