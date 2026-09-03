import { CHECKLIST_ITEMS, type ChecklistValue } from './checklist.js';
import { EQUIP_GROUPS, EQUIP_CHECK_FIELDS } from './equipo.js';
import { PRE_PHOTO_SLOTS, POST_PHOTO_SLOTS, type PhotoSlotDef } from './photoSlots.js';
import { SATISFACCION_LABELS, type ConformidadRecord, type Firma, type Foto, type TipoServicio } from './types.js';

// The fields buildPrintHtml actually reads — deliberately narrower than the
// full ConformidadRecord so both the mobile app's local record and the
// API's Mongo document (neither of which carries the other's fields, e.g.
// syncStatus or tecnicoId) can be passed in without an adapter.
export type PrintableConformidad = Pick<
  ConformidadRecord,
  | 'numero'
  | 'cliente'
  | 'fecha'
  | 'hora'
  | 'matricula'
  | 'instalador'
  | 'responsableEmpresa'
  | 'status'
  | 'pre'
  | 'post'
  | 'equipo'
  | 'tipoServicio'
>;

function fmtDateTime(dateStr?: string, timeStr?: string): string {
  if (!dateStr) return '—';
  return dateStr + (timeStr ? ' ' + timeStr : '');
}

function esc(s?: string | number | null): string {
  if (s === undefined || s === null) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

// Falls back to the uploaded url once the local base64 copy has been
// trimmed post-sync (see mobile/src/sync/trim.ts) — otherwise a synced job
// would print with a blank signature line.
function sigSrc(firma: Firma | null): string | undefined {
  return firma?.dataUrl ?? firma?.url;
}

function siNoBadge(value: ChecklistValue): string {
  const si = value === 'SI';
  const no = value === 'NO';
  return `<span class="opt si${si ? ' sel' : ''}">SI</span><span class="sep">/</span><span class="opt no${no ? ' sel' : ''}">NO</span>`;
}

function checklistTable(record: PrintableConformidad): string {
  let rows = '';
  for (const item of CHECKLIST_ITEMS) {
    if (item.group) {
      rows += `<tr class="subhead-row"><td colspan="3" class="subhead">${esc(item.group)}</td></tr>`;
    }
    const indented = item.key.startsWith('item6_');
    const pre = record.pre.checklist[item.key] ?? null;
    const post = record.post.checklist[item.key] ?? null;
    rows += `<tr>
      <td class="item-label${indented ? ' indent' : ''}">${esc(item.label)}${item.note ? `<div class="note">${esc(item.note)}</div>` : ''}</td>
      <td class="opt-cell">${siNoBadge(pre)}</td>
      <td class="opt-cell">${siNoBadge(post)}</td>
    </tr>`;
  }
  return `<table class="check-table">
    <thead><tr><th>Ítem a revisar</th><th>PRE instalación</th><th>POST instalación</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function equipCard(title: string, rowsHtml: string): string {
  return `<div class="equip-card">
    <div class="equip-card-title">${esc(title)}</div>
    <table class="equip-card-table">${rowsHtml}</table>
  </div>`;
}

// modelo/imei describen el equipo retirado cuando hay un cambio de por medio
// — mismo criterio que equipoFieldLabel() en la PWA (post/[id]/page.tsx).
function equipoFieldLabel(f: { key: string; label: string }, tipoServicio: TipoServicio | null): string {
  const isOutgoing = f.key === 'modelo' || f.key === 'imei';
  return isOutgoing && tipoServicio === 'cambio_equipo' ? `${f.label} (equipo retirado)` : f.label;
}

function fieldRows(
  equipo: Record<string, unknown>,
  fields: readonly { key: string; label: string }[],
  tipoServicio: TipoServicio | null,
): string {
  return fields
    .map((f) => {
      const val = equipo[f.key];
      const label = equipoFieldLabel(f, tipoServicio);
      return `<tr><td class="k">${esc(label)}</td><td class="v">${esc(typeof val === 'string' ? val : '') || '—'}</td></tr>`;
    })
    .join('');
}

function checkRows(equipo: Record<string, unknown>, fields: readonly { key: string; label: string }[]): string {
  return fields
    .map((f) => {
      const val = equipo[f.key];
      const label = val === 'SI' ? 'Sí' : val === 'NO' ? 'No' : '—';
      return `<tr><td class="k">${esc(f.label)}</td><td class="v">${label}</td></tr>`;
    })
    .join('');
}

function equipoGrid(record: PrintableConformidad): string {
  const equipo = record.equipo as Record<string, unknown>;
  const tipoServicio = record.tipoServicio ?? null;
  const byTitle = Object.fromEntries(EQUIP_GROUPS.map((g) => [g.title, g])) as Record<string, (typeof EQUIP_GROUPS)[number]>;

  // modeloInstalado/imeiInstalado solo aplican (y solo se muestran) cuando
  // hay un cambio de equipo de por medio — mismo criterio que el wizard POST.
  const datosEquipoFields = byTitle['Datos del equipo'].fields.filter(
    (f) => tipoServicio === 'cambio_equipo' || (f.key !== 'modeloInstalado' && f.key !== 'imeiInstalado'),
  );
  const datosEquipoTitle = tipoServicio === 'desinstalacion' ? 'Datos del equipo a desinstalar' : 'Datos del equipo';

  const cards = [
    equipCard(datosEquipoTitle, fieldRows(equipo, datosEquipoFields, tipoServicio)),
    equipCard('Sensores', fieldRows(equipo, byTitle['Sensores'].fields, tipoServicio)),
    equipCard(
      'Módulos',
      fieldRows(equipo, byTitle['Módulos'].fields, tipoServicio) +
        `<tr><td colspan="2" class="mini-sub">Entradas / Salidas</td></tr>` +
        fieldRows(equipo, byTitle['Entradas / Salidas'].fields, tipoServicio),
    ),
    equipCard('Elementos adicionales instalados', fieldRows(equipo, byTitle['Elementos adicionales instalados'].fields, tipoServicio)),
    equipCard(
      'Control de instalación',
      fieldRows(equipo, byTitle['Control de instalación'].fields, tipoServicio) + checkRows(equipo, EQUIP_CHECK_FIELDS),
    ),
  ];
  return `<div class="equip-grid">${cards.join('')}</div>`;
}

export type PhotoSrcResolver = (foto: Foto) => Promise<string | undefined> | string | undefined;

const defaultResolvePhotoSrc: PhotoSrcResolver = (foto) => foto.dataUrl ?? foto.url;

async function photosBlock(slots: PhotoSlotDef[], fotos: Foto[], titulo: string, resolvePhotoSrc: PhotoSrcResolver): Promise<string> {
  if (!fotos.length) return '';

  const matched = slots
    .map((slot) => ({ slot, foto: fotos.find((f) => f.slotKey === slot.key) }))
    .filter((x): x is { slot: PhotoSlotDef; foto: Foto } => !!x.foto);

  const cells = await Promise.all(
    matched.map(async ({ slot, foto }) => {
      const src = await resolvePhotoSrc(foto);
      if (!src) {
        return `<div class="photo-cell"><div class="photo video-placeholder">Video adjunto<br>(no incluido en el PDF)</div><div class="photo-caption">${esc(slot.label)}</div></div>`;
      }
      return `<div class="photo-cell"><img class="photo" src="${esc(src)}"><div class="photo-caption">${esc(slot.label)}</div></div>`;
    }),
  );

  return `<div class="keep-together"><div class="obs-label">${esc(titulo)}</div><div class="photo-grid">${cells.join('')}</div></div>`;
}

export async function buildPrintHtml(
  record: PrintableConformidad,
  opts?: { logoDataUri?: string; resolvePhotoSrc?: PhotoSrcResolver },
): Promise<string> {
  const resolvePhotoSrc = opts?.resolvePhotoSrc ?? defaultResolvePhotoSrc;
  const statusLabel =
    record.status === 'completo' ? 'Completo' : record.status === 'pendiente_post' ? 'Pendiente POST' : 'PRE en progreso';

  const [prePhotos, postPhotos] = await Promise.all([
    photosBlock(PRE_PHOTO_SLOTS, record.pre.fotos, 'Fotos PRE', resolvePhotoSrc),
    photosBlock(POST_PHOTO_SLOTS, record.post.fotos, 'Fotos POST', resolvePhotoSrc),
  ]);

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  :root {
    --primary: #AD1838;
    --secondary: #9D273C;
    --dark: #22293F;
    --tint: #FBEFF1;
    --border: #DCD4D6;
    --ok: #1f7a3d;
    --okBg: #e6f4ea;
    --bad: #a31c1c;
    --badBg: #fbe7e7;
  }
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: var(--dark); font-size: 11.5px; margin: 0; padding: 16px; }

  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; page-break-after: avoid; break-after: avoid; }
  .logo-img { height: 30px; display: block; }
  .logo-fallback { font-weight: 800; color: var(--primary); font-size: 17px; }
  .numero-badge { background: var(--dark); color: #fff; font-weight: 700; font-size: 12.5px; padding: 6px 14px; border-radius: 4px; letter-spacing: 0.3px; }

  .title-banner { background: var(--primary); color: #fff; border-radius: 6px; padding: 9px 14px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; page-break-after: avoid; break-after: avoid; }
  .title-banner .t { font-weight: 800; font-size: 15px; letter-spacing: 0.3px; text-transform: uppercase; }
  .status-pill { background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.5); border-radius: 20px; padding: 3px 11px; font-size: 10.5px; font-weight: 600; }

  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11.5px; page-break-inside: avoid; break-inside: avoid; }
  .info-table td { border: 1px solid var(--border); padding: 6px 9px; }
  .info-table .k { background: var(--tint); font-weight: 700; color: var(--secondary); width: 15%; white-space: nowrap; }
  .info-table .v { width: 35%; }

  .section-banner { background: var(--secondary); color: #fff; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px; padding: 6px 10px; border-radius: 4px; margin: 14px 0 6px; page-break-after: avoid; break-after: avoid; }

  table.check-table { width: 100%; border-collapse: collapse; font-size: 10.8px; margin-bottom: 4px; page-break-inside: auto; }
  .check-table th { background: var(--tint); color: var(--dark); border: 1px solid var(--border); padding: 6px 8px; text-align: left; }
  .check-table th:nth-child(2), .check-table th:nth-child(3) { text-align: center; width: 20%; }
  .check-table td { border: 1px solid var(--border); padding: 5px 8px; vertical-align: top; }
  .check-table tr { page-break-inside: avoid; break-inside: avoid; }
  .item-label.indent { padding-left: 20px; color: #444; }
  .item-label .note { font-size: 9px; color: #8a8a8a; font-style: italic; margin-top: 2px; }
  .subhead td { background: #f4eef0; font-weight: 700; color: var(--secondary); font-size: 10.5px; padding: 5px 8px; }
  .opt-cell { text-align: center; white-space: nowrap; }
  .opt { display: inline-block; padding: 1px 7px; border-radius: 9px; color: #a8a2a4; font-weight: 600; font-size: 10px; border: 1px solid transparent; }
  .opt.sel.si { background: var(--okBg); color: var(--ok); border-color: var(--ok); }
  .opt.sel.no { background: var(--badBg); color: var(--bad); border-color: var(--bad); }
  .sep { color: #ccc; margin: 0 3px; font-size: 9px; }

  .equip-grid { display: flex; gap: 7px; align-items: flex-start; page-break-inside: avoid; break-inside: avoid; }
  .equip-card { flex: 1 1 0; min-width: 0; border: 1px solid var(--border); border-radius: 5px; overflow: hidden; page-break-inside: avoid; break-inside: avoid; }
  .equip-card-title { background: var(--dark); color: #fff; font-weight: 700; font-size: 10.5px; padding: 5px 8px; text-transform: uppercase; letter-spacing: 0.2px; }
  .equip-card-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 9.3px; }
  .equip-card-table td { border-bottom: 1px solid var(--border); padding: 4px 6px; vertical-align: top; }
  .equip-card-table .k { color: #6b6367; width: 54%; }
  .equip-card-table .v { font-weight: 600; color: var(--dark); text-align: right; overflow-wrap: anywhere; }
  .equip-card-table .mini-sub { background: var(--tint); color: var(--secondary); font-weight: 700; font-size: 9px; text-transform: uppercase; }

  .obs-box { border: 1px solid var(--border); border-radius: 5px; padding: 8px 10px; font-size: 11px; min-height: 34px; margin-bottom: 8px; background: #fff; }
  .obs-label { font-weight: 700; color: var(--secondary); font-size: 11px; margin: 12px 0 5px; text-transform: uppercase; letter-spacing: 0.2px; page-break-after: avoid; break-after: avoid; }

  .sig-row { display: flex; gap: 20px; margin: 6px 0 4px; page-break-inside: avoid; break-inside: avoid; }
  .sig-block { flex: 1; text-align: center; }
  .sig-block img.sig { max-width: 100%; max-height: 90px; border-bottom: 1px solid var(--dark); display: block; margin: 0 auto 4px; }
  .sig-line { border-bottom: 1px solid var(--dark); height: 60px; margin-bottom: 4px; }
  .sig-refused { display: flex; align-items: center; justify-content: center; color: var(--bad); font-size: 10.5px; font-weight: 700; }
  .sig-caption { font-size: 10px; color: #6b6367; font-weight: 600; }

  .photo-grid { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
  .photo-cell { width: 120px; text-align: center; page-break-inside: avoid; break-inside: avoid; }
  .photo { width: 120px; height: 120px; object-fit: cover; border: 1px solid var(--border); border-radius: 3px; display: block; }
  .video-placeholder { width: 120px; height: 90px; border: 1px dashed #999; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #666; text-align: center; }
  .photo-caption { font-size: 9px; color: #6b6367; margin-top: 2px; }

  /* Groups a section title with its immediately-following content so print
     engines (esp. Android WebView PDF) don't strand the title at the bottom
     of one page and push the content to the next — plain page-break-after:
     avoid on the title alone is not reliably honored there. */
  .keep-together { display: flow-root; page-break-inside: avoid; break-inside: avoid; }
</style></head>
<body>
  <div class="header">
    ${opts?.logoDataUri ? `<img class="logo-img" src="${opts.logoDataUri}">` : '<div class="logo-fallback">WARA · Seguimiento y Control</div>'}
    <div class="numero-badge">N° ${esc(record.numero) || '—'}</div>
  </div>
  <div class="title-banner">
    <span class="t">Hoja de Conformidad</span>
    <span class="status-pill">${esc(statusLabel)}</span>
  </div>

  <div class="keep-together">
    <table class="info-table">
      <tr><td class="k">Cliente</td><td class="v">${esc(record.cliente)}</td><td class="k">Matrícula</td><td class="v">${esc(record.matricula)}</td></tr>
      <tr><td class="k">Fecha y hora</td><td class="v">${esc(fmtDateTime(record.fecha, record.hora))}</td><td class="k">Instalador</td><td class="v">${esc(record.instalador)}</td></tr>
      <tr><td class="k">Responsable empresa</td><td class="v" colspan="3">${esc(record.responsableEmpresa)}</td></tr>
    </table>
  </div>

  <div class="keep-together">
    <div class="section-banner">Revisión general del vehículo antes de comenzar la instalación</div>
    ${checklistTable(record)}
  </div>

  <div class="keep-together">
    <div class="section-banner">Datos de equipamiento</div>
    ${equipoGrid(record)}
  </div>

  <div class="keep-together">
    <div class="obs-label">Observaciones PRE instalación</div>
    <div class="obs-box">${esc(record.pre.observaciones) || 'Sin observaciones.'}</div>
    <div class="sig-row">
      <div class="sig-block">
        ${sigSrc(record.pre.firma) ? `<img class="sig" src="${esc(sigSrc(record.pre.firma))}">` : '<div class="sig-line"></div>'}
        <div class="sig-caption">Firma del cliente (PRE)${record.pre.firma?.nombreFirmante ? ` — ${esc(record.pre.firma.nombreFirmante)}` : ''}</div>
      </div>
    </div>
  </div>
  ${prePhotos}

  <div class="keep-together">
    <div class="obs-label">Observaciones POST instalación</div>
    <div class="obs-box">${esc(record.post.observaciones) || 'Sin observaciones.'}</div>
    <div class="sig-row">
      <div class="sig-block">
        ${
          sigSrc(record.post.firma)
            ? `<img class="sig" src="${esc(sigSrc(record.post.firma))}">`
            : record.post.firma?.satisfaccion === 'no_firma_insatisfecho'
              ? '<div class="sig-line sig-refused">No firma — disconformidad</div>'
              : '<div class="sig-line"></div>'
        }
        <div class="sig-caption">
          Firma del cliente (POST)${record.post.firma?.nombreFirmante ? ` — ${esc(record.post.firma.nombreFirmante)}` : ''}${record.post.firma?.satisfaccion ? ` — ${esc(SATISFACCION_LABELS[record.post.firma.satisfaccion])}` : ''}
        </div>
        ${
          record.post.firma?.satisfaccion !== 'satisfecho' && record.post.firma?.motivo
            ? `<div class="sig-caption">Motivo: ${esc(record.post.firma.motivo)}</div>`
            : ''
        }
      </div>
    </div>
  </div>
  ${postPhotos}
</body></html>`;
}
