// HTML de la constancia de reprogramación a pedido del cliente: el técnico fue al lugar y el cliente pidió pasar la
// visita a otro día. Lleva la fecha que eligió el cliente y su firma (o "no hay quien firme"). Se adjunta al ticket de
// Odoo apenas se reporta; si coordinación después elige otra fecha, se deja una nota en el ticket, no otro PDF.
import { formatoFechaHora, formatoHora } from './reprogramacionPdf.js';

export interface ReprogramacionClienteData {
  subtareaNombre: string;
  clienteNombre: string;
  ticketNumero: number;
  tecnicoNombre: string;
  horaAgendada?: Date | null;
  // Fin del rango horario agendado.
  horaFinAgendada?: Date | null;
  // El técnico llegó después de que terminó el rango: la reprogramación va sin cargo para el cliente.
  fueraDeRango?: boolean;
  // Cuándo marcó "llegué" el técnico: la prueba de presencia.
  llegadaAt?: Date | null;
  reportadaAt: Date;
  motivo: string;
  // Fecha y hora que eligió el cliente.
  nuevaInicio: Date;
  nuevaFin: Date;
  // Con firma: la imagen (data URI o URL de R2), y quién firmó. Sin firma: el motivo.
  firma?: { src: string; nombre: string; dni?: string } | null;
  motivoSinFirma?: string | null;
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function buildReprogramacionClienteHtml(data: ReprogramacionClienteData, logoDataUri?: string): string {
  const firmaHtml = data.firma
    ? `<div class="firma"><img src="${esc(data.firma.src)}" alt="Firma del cliente"><div class="linea"></div><div>${esc(data.firma.nombre)}${data.firma.dni ? ` · DNI ${esc(data.firma.dni)}` : ''}</div><div class="chico">Firma del cliente</div></div>`
    : `<div class="firma"><div class="sinfirma">No había persona para firmar</div><div class="chico">${esc(data.motivoSinFirma || '')}</div></div>`;
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><style>
  body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; margin: 32px; font-size: 14px; }
  header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; }
  header img { height: 44px; }
  h1 { font-size: 20px; margin: 0; }
  .unidad { font-size: 28px; font-weight: bold; margin: 24px 0 4px; }
  .resumen { background: #f1f5f9; border-left: 4px solid #1d4ed8; padding: 12px 16px; margin: 20px 0; font-size: 16px; }
  .fecha { background: #f1f5f9; border-left: 4px solid #0f766e; padding: 12px 16px; margin: 20px 0; font-size: 16px; }
  table { border-collapse: collapse; width: 100%; margin-top: 16px; }
  td { padding: 6px 0; vertical-align: top; }
  td:first-child { width: 160px; color: #555; }
  .firma { margin-top: 40px; width: 320px; }
  .firma img { max-width: 320px; max-height: 120px; display: block; }
  .linea { border-top: 1px solid #1a1a1a; margin: 4px 0 6px; }
  .sinfirma { border: 1px dashed #777; padding: 14px 12px; font-weight: bold; }
  .chico { color: #555; font-size: 12px; margin-top: 4px; }
  .sincargo { border: 1px solid #0f766e; color: #0f766e; padding: 8px 12px; font-weight: bold; margin: 0 0 8px; }
</style></head><body>
  <header><h1>Constancia de reprogramación a pedido del cliente</h1>${logoDataUri ? `<img src="${logoDataUri}" alt="WARA">` : ''}</header>
  <div class="unidad">${esc(data.subtareaNombre || 'Unidad')}</div>
  <div>${esc(data.clienteNombre)} · Ticket #${esc(data.ticketNumero)}</div>
  <div class="resumen">El técnico se presentó en el lugar${data.horaAgendada && data.horaFinAgendada ? ` ${data.fueraDeRango ? 'fuera del' : 'dentro del'} rango horario agendado (${esc(formatoHora(data.horaAgendada))} a ${esc(formatoHora(data.horaFinAgendada))})` : ''} y el cliente solicitó reprogramar la visita para otro día.</div>
  ${data.fueraDeRango ? '<div class="sincargo">Reprogramación sin cargo para el cliente: el técnico llegó fuera del rango horario agendado.</div>' : ''}
  <div class="fecha">Fecha elegida por el cliente: <b>${esc(formatoFechaHora(data.nuevaInicio))}</b> (hasta las ${esc(formatoHora(data.nuevaFin))}).</div>
  <table>
    <tr><td>Motivo</td><td>${esc(data.motivo)}</td></tr>
    <tr><td>Técnico</td><td>${esc(data.tecnicoNombre)}</td></tr>
    ${data.horaAgendada ? `<tr><td>Rango agendado</td><td>${esc(formatoFechaHora(data.horaAgendada))}${data.horaFinAgendada ? ` a ${esc(formatoHora(data.horaFinAgendada))}` : ''}</td></tr>` : ''}
    ${data.llegadaAt ? `<tr><td>Llegada del técnico</td><td>${esc(formatoFechaHora(data.llegadaAt))}</td></tr>` : ''}
    <tr><td>Reportado</td><td>${esc(formatoFechaHora(data.reportadaAt))}</td></tr>
  </table>
  ${firmaHtml}
</body></html>`;
}
