import { CHECKLIST_ITEMS, DETAIL_FIELD_BY_KEY, type ChecklistValue } from './checklist.js';
import { EQUIP_GROUPS, EQUIP_CHECK_FIELDS, EQUIP_ITEM_PHOTO_LABEL, formatSeries, isEquipoFieldVisible } from './equipo.js';
import { prePhotoSlotsFor, postPhotoSlotsFor, INTERVENCION_GROUP_KEY, EXTRA_POST_PHOTOS_KEY, EXTRA_RETIRO_PHOTOS_KEY, VIDEO_SERVICIO_KEY, type PhotoSlotDef } from './photoSlots.js';
import { getServiceMode } from './serviceMode.js';
import { SATISFACCION_LABELS, TIPO_SERVICIO_LABELS, isEquipoSwap, type ConformidadRecord, type Firma, type Foto, type TipoServicio } from './types.js';

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
  | 'motivoIntervencion'
  | 'cambioEquipo'
  | 'cambioUnidad'
  | 'ticketOdoo'
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

// Qué mostrar en el recuadro de firma cuando no hay imagen — antes esto
// nunca chequeaba clienteAusente (ni en PRE, donde no se chequeaba nada en
// absoluto), así que una firma sin imagen se veía igual de vacía tanto si el
// cliente nunca estuvo disponible como si simplemente no llegó a firmar, sin
// ningún antecedente en el PDF.
function sigPlaceholder(firma: Firma | null): string {
  if (firma?.clienteAusente) return '<div class="sig-line sig-refused">Cliente ausente</div>';
  if (firma?.satisfaccion === 'no_firma_insatisfecho') return '<div class="sig-line sig-refused">No firma — disconformidad</div>';
  return '<div class="sig-line"></div>';
}

function siNoBadge(value: ChecklistValue): string {
  const si = value === 'SI';
  const no = value === 'NO';
  return `<span class="opt si${si ? ' sel' : ''}">SI</span><span class="sep">/</span><span class="opt no${no ? ' sel' : ''}">NO</span>`;
}

function checklistTable(record: PrintableConformidad, soloPre = false): string {
  let rows = '';
  for (const item of CHECKLIST_ITEMS) {
    if (item.group) {
      rows += `<tr class="subhead-row"><td colspan="${soloPre ? 2 : 3}" class="subhead">${esc(item.group)}</td></tr>`;
    }
    if (item.hiddenInPdf) continue;
    const indented = item.key.startsWith('item6_');
    const pre = record.pre.checklist[item.key] ?? null;
    const post = record.post.checklist[item.key] ?? null;
    // Any item with requiresDetailWhen (item6_falla, item7, item8 today) may
    // carry a detail — not just the falla, unlike before.
    const detailField = item.detailHiddenInPdf ? undefined : DETAIL_FIELD_BY_KEY[item.key];
    const preDetalle = detailField ? record.pre[detailField] : undefined;
    const postDetalle = detailField ? record.post[detailField] : undefined;
    rows += `<tr>
      <td class="item-label${indented ? ' indent' : ''}">
        ${esc(item.label)}
        ${item.note ? `<div class="note">${esc(item.note)}</div>` : ''}
        ${preDetalle ? `<div class="note"><strong>Detalle PRE:</strong> ${esc(preDetalle)}</div>` : ''}
        ${!soloPre && postDetalle ? `<div class="note"><strong>Detalle POST:</strong> ${esc(postDetalle)}</div>` : ''}
      </td>
      <td class="opt-cell">${siNoBadge(pre)}</td>
      ${soloPre ? '' : `<td class="opt-cell">${siNoBadge(post)}</td>`}
    </tr>`;
  }
  return `<table class="check-table">
    <thead><tr><th>Ítem a revisar</th><th>Pre-Conformidad</th>${soloPre ? '' : '<th>Post-Conformidad</th>'}</tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function equipCard(title: string, rowsHtml: string, extraClass = ""): string {
  if (!rowsHtml) return '';
  return `<div class="equip-card${extraClass ? " " + extraClass : ""}">
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
  fields: readonly { key: string; label: string; series?: boolean }[],
  tipoServicio: TipoServicio | null,
): string {
  return fields
    .map((f) => {
      const val = equipo[f.key];
      // Solo se imprime lo que se completó: nada de filas vacías ni casillas sin tildar.
      if (typeof val !== 'string' || !val.trim() || val === 'NO') return '';
      const label = equipoFieldLabel(f, tipoServicio);
      // Cámaras ADAS / DSM: varios N° de serie, uno por línea en el dato (ver seriesDe).
      const texto = typeof val === 'string' ? ('series' in f && f.series ? formatSeries(val) : val) : '';
      return `<tr><td class="k">${esc(label)}</td><td class="v">${esc(texto) || '—'}</td></tr>`;
    })
    .join('');
}

function checkRows(equipo: Record<string, unknown>, fields: readonly { key: string; label: string }[]): string {
  return fields
    .map((f) => {
      const val = equipo[f.key];
      if (val !== 'SI' && val !== 'NO') return '';
      const label = val === 'SI' ? 'Sí' : 'No';
      return `<tr><td class="k">${esc(f.label)}</td><td class="v">${label}</td></tr>`;
    })
    .join('');
}

function equipoGrid(record: PrintableConformidad): string {
  const equipo = record.equipo as Record<string, unknown>;
  // Una reparación que terminó en cambio de equipo (motivoIntervencion) se
  // imprime igual que un cambio de equipo: modelo/imei = retirado, *Instalado = entrante.
  const swap = isEquipoSwap(record.tipoServicio, record.motivoIntervencion);
  const tipoServicio: TipoServicio | null = swap ? 'cambio_equipo' : (record.tipoServicio ?? null);
  const byTitle = Object.fromEntries(EQUIP_GROUPS.map((g) => [g.title, g])) as Record<string, (typeof EQUIP_GROUPS)[number]>;

  // modeloInstalado/imeiInstalado solo aplican (y solo se muestran) cuando
  // hay un cambio de equipo de por medio — mismo criterio que el wizard POST.
  const datosEquipoFields = byTitle['Datos del equipo'].fields.filter(
    (f) => tipoServicio === 'cambio_equipo' || (f.key !== 'modeloInstalado' && f.key !== 'imeiInstalado'),
  );
  const datosEquipoTitle = tipoServicio === 'desinstalacion' ? 'Datos del equipo a desinstalar' : 'Datos del equipo';

  const retirados = ((equipo.elementosRetirados as string | undefined) ?? '').split(',').filter(Boolean);
  const retiradosCard = retirados.length
    ? equipCard(
        'Sensores / módulos retirados',
        retirados.map((k) => `<tr><td class="k">${esc(EQUIP_ITEM_PHOTO_LABEL[k] ?? k)}</td><td class="v">Retirado</td></tr>`).join(''),
      )
    : '';

  // Los detalles de IO1/IO2/AO1/AO2 (dependsOn) no se imprimen cuando
  // su checkbox no está tildado — mismo criterio que el wizard POST y
  // el resumen del panel, para no mostrar texto viejo de un campo que
  // el técnico llegó a tipear y después destildó.
  const ioRows = fieldRows(
    equipo,
    byTitle['Entradas / Salidas'].fields.filter((f) => isEquipoFieldVisible(f, record.equipo)),
    tipoServicio,
  );

  const cards = [
    equipCard(datosEquipoTitle, fieldRows(equipo, datosEquipoFields, tipoServicio), "equip-card-wide"),
    equipCard('Sensores', fieldRows(equipo, byTitle['Sensores'].fields, tipoServicio)),
    equipCard(
      'Módulos',
      fieldRows(equipo, byTitle['Módulos'].fields, tipoServicio) +
        (ioRows ? `<tr><td colspan="2" class="mini-sub">Entradas / Salidas</td></tr>` : '') +
        ioRows,
    ),
    equipCard(
      'Elementos adicionales instalados',
      fieldRows(
        equipo,
        // Series, canales del MDVR, etc. solo cuando su casilla está tildada.
        byTitle['Elementos adicionales instalados'].fields.filter((f) => isEquipoFieldVisible(f, record.equipo)),
        tipoServicio,
      ),
    ),
    retiradosCard,
    equipCard(
      'Control de instalación',
      fieldRows(equipo, byTitle['Control de instalación'].fields, tipoServicio) + checkRows(equipo, EQUIP_CHECK_FIELDS),
    ),
  ];
  return `<div class="equip-grid">${cards.join('')}</div>`;
}

export type PhotoSrcResolver = (foto: Foto) => Promise<string | undefined> | string | undefined;

const defaultResolvePhotoSrc: PhotoSrcResolver = (foto) => foto.dataUrl ?? foto.url;

const GALLERY_LABELS: Record<string, string> = {
  // Fotos de "lo que se tildó" (antena/sensor/módulo/elemento adicional) —
  // slotKey = key del campo de Equipo, ver EQUIP_ITEM_PHOTO_LABEL.
  ...EQUIP_ITEM_PHOTO_LABEL,
  [INTERVENCION_GROUP_KEY]: 'Intervención realizada',
  [EXTRA_POST_PHOTOS_KEY]: 'Otras fotos',
  [EXTRA_RETIRO_PHOTOS_KEY]: 'Otras fotos de lo desinstalado',
  [VIDEO_SERVICIO_KEY]: 'Video del servicio',
};

async function photosBlock(slots: PhotoSlotDef[], fotos: Foto[], titulo: string, resolvePhotoSrc: PhotoSrcResolver): Promise<string> {
  if (!fotos.length) return '';

  const matched: { foto: Foto; label: string }[] = [];
  for (const slot of slots) {
    const delSlot = fotos.filter((f) => f.slotKey === slot.key);
    for (const foto of slot.multi ? delSlot : delSlot.slice(0, 1)) matched.push({ foto, label: slot.label });
  }
  // Fotos sin slotKey reconocido (registros sincronizados antes de que el
  // servidor empezara a persistirlo, o cualquier otro desfasaje) igual se
  // imprimen en vez de desaparecer sin aviso del PDF — con una leyenda
  // genérica en lugar de la del slot. La galería de sensores/accesorios (N
  // fotos con el mismo slotKey, ver GalleryPhotoCapture) cae acá también —
  // no está en `slots` porque no es 1 foto = 1 slot — pero se le da su
  // propia leyenda en vez de la genérica.
  const matchedIds = new Set(matched.map((m) => m.foto.id));
  for (const foto of fotos) {
    if (!matchedIds.has(foto.id)) {
      matched.push({ foto, label: GALLERY_LABELS[foto.slotKey ?? ''] ?? 'Foto adicional' });
    }
  }

  const cells = await Promise.all(
    matched.map(async ({ foto, label }) => {
      // Foto.motivo (see GalleryPhotoCapture in the PWA): técnico couldn't
      // take this photo (e.g. forgot to bring the sensor/módulo) and left
      // why instead of the image — print the reason, not the video placeholder.
      if (foto.motivo) {
        return `<div class="photo-cell"><div class="photo video-placeholder">Sin foto — motivo:<br>${esc(foto.motivo)}</div><div class="photo-caption">${esc(label)}</div></div>`;
      }
      // Short verification clip (GalleryPhotoCapture `allowVideo`, "Pantalla
      // N° de serie"/"Cámaras ADAS") — an <img> pointed at a video/webm data
      // URL or R2 URL renders nothing useful in a static PDF, so it falls
      // straight into the same placeholder already used for non-printable
      // attachments, before even trying resolvePhotoSrc.
      if (foto.mimeType === 'video/webm') {
        return `<div class="photo-cell"><div class="photo video-placeholder">Video adjunto<br>(no incluido en el PDF)</div><div class="photo-caption">${esc(label)}</div></div>`;
      }
      const src = await resolvePhotoSrc(foto);
      if (!src) {
        return `<div class="photo-cell"><div class="photo video-placeholder">Video adjunto<br>(no incluido en el PDF)</div><div class="photo-caption">${esc(label)}</div></div>`;
      }
      return `<div class="photo-cell"><img class="photo" src="${esc(src)}"><div class="photo-caption">${esc(label)}</div></div>`;
    }),
  );

  return `<div class="keep-together"><div class="obs-label">${esc(titulo)}</div><div class="photo-grid">${cells.join('')}</div></div>`;
}

export async function buildPrintHtml(
  record: PrintableConformidad,
  opts?: {
    logoDataUri?: string;
    resolvePhotoSrc?: PhotoSrcResolver;
    // Versión del PDF que se manda al ticket al terminar el PRE: estado en el
    // que se encontró la unidad, sin las secciones de POST ni equipamiento.
    soloPre?: boolean;
  },
): Promise<string> {
  const resolvePhotoSrc = opts?.resolvePhotoSrc ?? defaultResolvePhotoSrc;
  const soloPre = opts?.soloPre === true;
  const statusLabel =
    soloPre ? 'Revisión inicial (PRE)' : record.status === 'completo' ? 'Completo' : record.status === 'pendiente_post' ? 'Pendiente POST' : 'PRE en progreso';
  const tipoServicioLabel = record.tipoServicio ? TIPO_SERVICIO_LABELS[record.tipoServicio] : null;
  const cambioUnidadLabel =
    record.tipoServicio === 'cambio_unidad' && record.cambioUnidad
      ? record.cambioUnidad.rol === 'origen'
        ? 'Unidad de origen (desinstalación)'
        : 'Unidad de destino (instalación)'
      : null;
  const mode = getServiceMode(record);

  const [prePhotos, postPhotos] = await Promise.all([
    photosBlock(prePhotoSlotsFor(mode), record.pre.fotos, 'Fotos PRE', resolvePhotoSrc),
    soloPre ? '' : photosBlock(postPhotoSlotsFor(mode), record.post.fotos, 'Fotos POST', resolvePhotoSrc),
  ]);
  // Lo que escribe el técnico en el paso "Observaciones" del PRE — lo ve el
  // cliente. Foto.descripcion (qué encontró en la foto extra) es solo para el
  // panel y no se imprime acá.
  const preObservaciones = record.pre.observaciones?.trim()
    ? `<div class="keep-together"><div class="obs-label">Observaciones encontradas (PRE)</div><div class="obs-box" style="white-space: pre-wrap;">${esc(record.pre.observaciones)}</div></div>`
    : '';

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
  .header-badges { display: flex; align-items: center; gap: 8px; }
  .ticket-badge { background: var(--tint); border: 1px solid var(--secondary); color: var(--secondary); font-weight: 700; font-size: 11.5px; padding: 5px 12px; border-radius: 4px; letter-spacing: 0.2px; }
  .numero-badge { background: var(--dark); color: #fff; font-weight: 700; font-size: 12.5px; padding: 6px 14px; border-radius: 4px; letter-spacing: 0.3px; }

  .title-banner { background: var(--primary); color: #fff; border-radius: 6px; padding: 9px 14px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; page-break-after: avoid; break-after: avoid; }
  .title-banner .t { font-weight: 800; font-size: 15px; letter-spacing: 0.3px; text-transform: uppercase; }
  .banner-pills { display: flex; align-items: center; gap: 6px; }
  .status-pill { background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.5); border-radius: 20px; padding: 3px 11px; font-size: 10.5px; font-weight: 600; }

  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11.5px; page-break-inside: avoid; break-inside: avoid; }
  .info-table td { border: 1px solid var(--border); padding: 6px 9px; }
  .info-table .k { background: var(--tint); font-weight: 700; color: var(--secondary); width: 15%; white-space: nowrap; }
  .info-table .v { width: 35%; }

  .section-banner { background: var(--secondary); color: #fff; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px; padding: 6px 10px; border-radius: 4px; margin: 10px 0 6px; page-break-after: avoid; break-after: avoid; }

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

  /* Hasta 3 tarjetas por fila: con 5 en una sola fila los rótulos se partían en 3 y 4 renglones. */
  .equip-grid { display: flex; flex-wrap: wrap; gap: 7px; align-items: flex-start; }
  .equip-card { flex: 1 1 calc(33.333% - 5px); min-width: 0; border: 1px solid var(--border); border-radius: 5px; overflow: hidden; page-break-inside: avoid; break-inside: avoid; }
  .equip-card-title { background: var(--dark); color: #fff; font-weight: 700; font-size: 10.5px; padding: 5px 8px; text-transform: uppercase; letter-spacing: 0.2px; }
  .equip-card-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 9.3px; }
  .equip-card-table td { border-bottom: 1px solid var(--border); padding: 3px 6px; vertical-align: top; }
  .equip-card-table .k { color: #6b6367; width: 62%; }
  .equip-card-table .v { font-weight: 600; color: var(--dark); text-align: right; overflow-wrap: anywhere; }
  .equip-card-table .mini-sub { background: var(--tint); color: var(--secondary); font-weight: 700; font-size: 9px; text-transform: uppercase; }
  /* "Datos del equipo" lleva el IMEI (15 dígitos): más ancho y sin cortar el número. */
  .equip-card-wide .equip-card-table .k { width: 40%; }
  .equip-card-wide .equip-card-table .v { overflow-wrap: normal; white-space: nowrap; }

  .obs-box { border: 1px solid var(--border); border-radius: 5px; padding: 8px 10px; font-size: 11px; min-height: 34px; margin-bottom: 8px; background: #fff; }
  .obs-label { font-weight: 700; color: var(--secondary); font-size: 11px; margin: 9px 0 4px; text-transform: uppercase; letter-spacing: 0.2px; page-break-after: avoid; break-after: avoid; }

  .sig-row { display: flex; gap: 20px; margin: 6px 0 4px; page-break-inside: avoid; break-inside: avoid; }
  .sig-block { flex: 1; text-align: center; }
  .sig-block img.sig { max-width: 100%; max-height: 72px; border-bottom: 1px solid var(--dark); display: block; margin: 0 auto 4px; }
  .sig-line { border-bottom: 1px solid var(--dark); height: 50px; margin-bottom: 4px; }
  .sig-refused { display: flex; align-items: center; justify-content: center; color: var(--bad); font-size: 10.5px; font-weight: 700; }
  .sig-caption { font-size: 10px; color: #6b6367; font-weight: 600; }

  .photo-grid { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 4px; }
  .photo-cell { max-width: 150px; text-align: center; page-break-inside: avoid; break-inside: avoid; }
  .photo { max-width: 150px; max-height: 150px; width: auto; height: auto; object-fit: contain; border: 1px solid var(--border); border-radius: 3px; display: block; }
  .video-placeholder { width: 108px; height: 80px; border: 1px dashed #999; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #666; text-align: center; }
  .photo-caption { font-size: 9px; color: #6b6367; margin-top: 2px; }

  /* Groups a section title with its immediately-following content so print
     engines (esp. Android WebView PDF) don't strand the title at the bottom
     of one page and push the content to the next — plain page-break-after:
     avoid on the title alone is not reliably honored there. */
  .keep-together { display: flow-root; page-break-inside: avoid; break-inside: avoid; }
</style></head>
<body>
  <div class="header">
    ${opts?.logoDataUri ? `<img class="logo-img" src="${esc(opts.logoDataUri)}">` : '<div class="logo-fallback">WARA · Seguimiento y Control</div>'}
    <div class="header-badges">
      ${record.ticketOdoo?.numero ? `<div class="ticket-badge">Ticket Odoo: #${esc(record.ticketOdoo.numero)}</div>` : ''}
      <div class="numero-badge">N° ${esc(record.numero) || '—'}</div>
    </div>
  </div>
  <div class="title-banner">
    <span class="t">Hoja de Conformidad</span>
    <div class="banner-pills">
      ${record.ticketOdoo?.numero ? `<span class="status-pill">Ticket #${esc(record.ticketOdoo.numero)}</span>` : ''}
      ${tipoServicioLabel ? `<span class="status-pill">${esc(tipoServicioLabel)}</span>` : ''}
      ${cambioUnidadLabel ? `<span class="status-pill">${esc(cambioUnidadLabel)}</span>` : ''}
      <span class="status-pill">${esc(statusLabel)}</span>
    </div>
  </div>

  <div class="keep-together">
    <table class="info-table">
      <tr><td class="k">Cliente</td><td class="v">${esc(record.cliente)}</td><td class="k">Matrícula</td><td class="v">${esc(record.matricula)}</td></tr>
      <tr><td class="k">Fecha y hora</td><td class="v">${esc(fmtDateTime(record.fecha, record.hora))}</td><td class="k">Técnico</td><td class="v">${esc(record.instalador)}</td></tr>
      <tr>
        <td class="k">Responsable empresa</td>
        <td class="v"${record.ticketOdoo?.numero ? '' : ' colspan="3"'}>${esc(record.responsableEmpresa)}</td>
        ${record.ticketOdoo?.numero ? `<td class="k">Ticket Odoo</td><td class="v" style="font-weight: 700; color: var(--secondary);">#${esc(record.ticketOdoo.numero)}</td>` : ''}
      </tr>
    </table>
  </div>

  <div class="keep-together">
    <div class="section-banner">Revisión general del vehículo antes de comenzar la instalación</div>
    ${checklistTable(record, soloPre)}
  </div>

  ${soloPre ? '' : `<div class="keep-together">
    <div class="section-banner">Datos de equipamiento</div>
    ${equipoGrid(record)}
  </div>`}

  ${preObservaciones}
  ${prePhotos}
  <div class="keep-together">
    <div class="sig-row">
      <div class="sig-block">
        ${sigSrc(record.pre.firma) ? `<img class="sig" src="${esc(sigSrc(record.pre.firma))}">` : sigPlaceholder(record.pre.firma)}
        <div class="sig-caption">Firma del cliente (PRE)${record.pre.firma?.nombreFirmante ? ` — ${esc(record.pre.firma.nombreFirmante)}` : ''}${record.pre.firma?.dniFirmante ? ` — DNI ${esc(record.pre.firma.dniFirmante)}` : ''}${record.pre.firma?.cargoFirmante ? ` — ${esc(record.pre.firma.cargoFirmante)}` : ''}</div>
        ${
          record.pre.firma?.clienteAusente && record.pre.firma?.motivo
            ? `<div class="sig-caption">Motivo: ${esc(record.pre.firma.motivo)}</div>`
            : ''
        }
      </div>
    </div>
  </div>

  ${soloPre ? '' : `${postPhotos}
  <div class="keep-together">
    <div class="sig-row">
      <div class="sig-block">
        ${sigSrc(record.post.firma) ? `<img class="sig" src="${esc(sigSrc(record.post.firma))}">` : sigPlaceholder(record.post.firma)}
        <div class="sig-caption">
          Firma del cliente (POST)${record.post.firma?.nombreFirmante ? ` — ${esc(record.post.firma.nombreFirmante)}` : ''}${record.post.firma?.dniFirmante ? ` — DNI ${esc(record.post.firma.dniFirmante)}` : ''}${record.post.firma?.cargoFirmante ? ` — ${esc(record.post.firma.cargoFirmante)}` : ''}${record.post.firma?.satisfaccion ? ` — ${esc(SATISFACCION_LABELS[record.post.firma.satisfaccion])}` : ''}
        </div>
        ${
          record.post.firma?.satisfaccion !== 'satisfecho' && record.post.firma?.motivo
            ? `<div class="sig-caption">Motivo: ${esc(record.post.firma.motivo)}</div>`
            : ''
        }
      </div>
    </div>
  </div>`}
</body></html>`;
}
