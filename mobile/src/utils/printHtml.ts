import { CHECKLIST_ITEMS, EQUIP_GROUPS, EQUIP_CHECK_FIELDS, type ConformidadRecord } from '@wara/shared';
import { fmtDateTime } from './misc';

function esc(s?: string | number | null): string {
  if (s === undefined || s === null) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function checklistTable(record: ConformidadRecord): string {
  let lastGroup: string | undefined;
  let rows = '';
  for (const item of CHECKLIST_ITEMS) {
    const label = item.group && item.group !== lastGroup ? `${item.group} — ${item.label}` : item.label;
    if (item.group) lastGroup = item.group;
    const pre = record.pre.checklist[item.key] ?? '—';
    const post = record.post.checklist[item.key] ?? '—';
    rows += `<tr><td>${esc(label)}</td><td>${esc(pre)}</td><td>${esc(post)}</td></tr>`;
  }
  return `<table><tr><th>Ítem</th><th>PRE</th><th>POST</th></tr>${rows}</table>`;
}

function equipoTable(record: ConformidadRecord): string {
  let rows = '';
  for (const group of EQUIP_GROUPS) {
    rows += `<tr><td colspan="2" class="group">${esc(group.title)}</td></tr>`;
    for (const f of group.fields) {
      const val = (record.equipo as Record<string, unknown>)[f.key];
      rows += `<tr><td>${esc(f.label)}</td><td>${esc(typeof val === 'string' ? val : '')||'—'}</td></tr>`;
    }
  }
  rows += `<tr><td colspan="2" class="group">Verificaciones realizadas</td></tr>`;
  for (const f of EQUIP_CHECK_FIELDS) {
    const val = (record.equipo as Record<string, unknown>)[f.key];
    rows += `<tr><td>${esc(f.label)}</td><td>${val ? 'Sí' : 'No'}</td></tr>`;
  }
  return `<table>${rows}</table>`;
}

function photosBlock(fotos: ConformidadRecord['pre']['fotos'], titulo: string): string {
  if (!fotos.length) return '';
  const imgs = fotos.map((f) => `<img class="photo" src="${f.dataUrl ?? f.url ?? ''}">`).join('');
  return `<p class="label">${esc(titulo)}</p>${imgs}`;
}

export function buildPrintHtml(record: ConformidadRecord): string {
  const statusLabel =
    record.status === 'completo' ? 'Completo' : record.status === 'pendiente_post' ? 'Pendiente POST' : 'PRE en progreso';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 12px; padding: 16px; }
  h2 { background: #7a1630; color: #fff; padding: 8px 12px; border-radius: 6px; font-size: 15px; margin: 0 0 10px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11.5px; }
  td, th { border: 1px solid #999; padding: 5px 7px; text-align: left; vertical-align: top; }
  th, .group { background: #f0ebe9; font-weight: bold; }
  .sig { max-width: 260px; max-height: 110px; border: 1px solid #ccc; display: block; margin-top: 4px; }
  .photo { max-width: 150px; max-height: 150px; border: 1px solid #ccc; margin: 4px; display: inline-block; }
  .label { font-weight: bold; margin: 8px 0 4px; }
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .logo { font-weight: 800; color: #7a1630; font-size: 18px; }
</style></head>
<body>
  <div class="header">
    <div class="logo">WARA · Seguimiento y Control</div>
    <div>N° ${esc(record.numero) || '—'}</div>
  </div>
  <h2>Hoja de Conformidad — ${esc(statusLabel)}</h2>
  <table>
    <tr><th>Cliente</th><td>${esc(record.cliente)}</td><th>Matrícula</th><td>${esc(record.matricula)}</td></tr>
    <tr><th>Fecha / Hora</th><td>${esc(fmtDateTime(record.fecha, record.hora))}</td><th>Instalador</th><td>${esc(record.instalador)}</td></tr>
    <tr><th>Responsable empresa</th><td colspan="3">${esc(record.responsableEmpresa)}</td></tr>
  </table>

  <p class="label">Revisión general del vehículo (PRE / POST)</p>
  ${checklistTable(record)}

  <p class="label">Observaciones PRE instalación</p>
  <p>${esc(record.pre.observaciones) || 'Sin observaciones.'}</p>
  ${record.pre.firma?.dataUrl ? `<p class="label">Firma del cliente (PRE)</p><img class="sig" src="${record.pre.firma.dataUrl}">` : ''}
  ${photosBlock(record.pre.fotos, 'Fotos PRE')}

  <hr>
  <p class="label">Datos de equipamiento</p>
  ${equipoTable(record)}

  <p class="label">Observaciones POST instalación</p>
  <p>${esc(record.post.observaciones) || 'Sin observaciones.'}</p>
  ${record.post.firma?.dataUrl ? `<p class="label">Firma del cliente (POST)</p><img class="sig" src="${record.post.firma.dataUrl}">` : ''}
  ${photosBlock(record.post.fotos, 'Fotos POST')}
</body></html>`;
}
