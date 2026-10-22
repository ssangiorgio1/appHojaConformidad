// HTML del PDF de reprogramación que se adjunta al ticket de Odoo: una hoja por unidad (subtarea), con el nombre
// de la subtarea (la patente/unidad), no el de la tarea padre. Ver docs-cancelar-pre-reprogramar.md.

export interface ReprogramacionPdfData {
  subtareaNombre: string;
  clienteNombre: string;
  ticketNumero: number;
  tecnicoNombre: string;
  // Cuándo se reportó la incidencia y para cuándo queda la visita.
  reportadaAt: Date;
  nuevaInicio: Date;
  nuevaFin: Date;
  motivo: string;
  tipo: 'no_encontrada' | 'pre_cancelado' | 'llegada_tarde';
  // Solo para 'llegada_tarde': la hora agendada y la de llegada, que justifican la reprogramación sin cargo.
  horaAgendada?: Date | null;
  horaFinAgendada?: Date | null;
  llegadaAt?: Date | null;
  // Hora que había propuesto el técnico, si coordinación la cambió al aceptar.
  propuestaOriginal?: { inicio: Date; fin: Date } | null;
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

const TZ = 'America/Argentina/Buenos_Aires';

export function formatoFechaHora(d: Date): string {
  return new Intl.DateTimeFormat('es-AR', { timeZone: TZ, dateStyle: 'full', timeStyle: 'short', hourCycle: 'h23' }).format(d);
}

export function formatoHora(d: Date): string {
  return new Intl.DateTimeFormat('es-AR', { timeZone: TZ, timeStyle: 'short', hourCycle: 'h23' }).format(d);
}

export function buildReprogramacionHtml(data: ReprogramacionPdfData, logoDataUri?: string): string {
  const queOcurrio =
    data.tipo === 'pre_cancelado'
      ? 'El cliente pidió cambiar la fecha de la visita: el técnico comenzó la revisión inicial (PRE) de la unidad y no pudo completarla en esa visita.'
      : data.tipo === 'llegada_tarde'
        ? `La visita estaba agendada ${data.horaAgendada && data.horaFinAgendada ? `entre las ${formatoHora(data.horaAgendada)} y las ${formatoHora(data.horaFinAgendada)}` : 'en un rango horario'} y el técnico llegó ${data.llegadaAt ? `a las ${formatoHora(data.llegadaAt)}` : 'después de que terminó ese rango'}, fuera del rango horario. La reprogramación se debe a esa llegada fuera del rango.`
        : 'El técnico se presentó en el lugar y la unidad no se encontraba.';
  const sinCargo = data.tipo === 'llegada_tarde' ? '<div class="sincargo">Reprogramación sin cargo para el cliente.</div>' : '';
  const cambio =
    data.propuestaOriginal &&
    (data.propuestaOriginal.inicio.getTime() !== data.nuevaInicio.getTime() || data.propuestaOriginal.fin.getTime() !== data.nuevaFin.getTime())
      ? `<p class="nota">Coordinación ajustó el horario que había propuesto el técnico (${esc(formatoFechaHora(data.propuestaOriginal.inicio))}).</p>`
      : '';
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><style>
  body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; margin: 32px; font-size: 14px; }
  header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; }
  header img { height: 44px; }
  h1 { font-size: 20px; margin: 0; }
  .unidad { font-size: 28px; font-weight: bold; margin: 24px 0 4px; }
  .fecha { background: #f1f5f9; border-left: 4px solid #0f766e; padding: 12px 16px; margin: 20px 0; font-size: 16px; }
  table { border-collapse: collapse; width: 100%; margin-top: 16px; }
  td { padding: 6px 0; vertical-align: top; }
  td:first-child { width: 160px; color: #555; }
  .sincargo { border: 1px solid #0f766e; color: #0f766e; padding: 8px 12px; font-weight: bold; margin-bottom: 8px; }
  .nota { color: #555; font-size: 12px; }
</style></head><body>
  <header><h1>Reprogramación de visita</h1>${logoDataUri ? `<img src="${logoDataUri}" alt="WARA">` : ''}</header>
  <div class="unidad">${esc(data.subtareaNombre || 'Unidad')}</div>
  <div>${esc(data.clienteNombre)} · Ticket #${esc(data.ticketNumero)}</div>
  <p>${esc(queOcurrio)}</p>
  <div class="fecha">La visita a esta unidad queda reprogramada para el <b>${esc(formatoFechaHora(data.nuevaInicio))}</b> (hasta las ${esc(formatoHora(data.nuevaFin))}).</div>
  ${cambio}
  ${sinCargo}
  <table>
    <tr><td>Motivo</td><td>${esc(data.motivo)}</td></tr>
    <tr><td>Técnico</td><td>${esc(data.tecnicoNombre)}</td></tr>
    ${data.tipo === 'llegada_tarde' && data.horaAgendada && data.llegadaAt ? `<tr><td>Rango agendado / llegada</td><td>${esc(formatoHora(data.horaAgendada))}${data.horaFinAgendada ? ` a ${esc(formatoHora(data.horaFinAgendada))}` : ''} / ${esc(formatoHora(data.llegadaAt))}</td></tr>` : ''}
    <tr><td>Reportado</td><td>${esc(formatoFechaHora(data.reportadaAt))}</td></tr>
  </table>
</body></html>`;
}
