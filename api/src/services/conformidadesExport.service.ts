import {
  ACCION_ELEMENTO_LABELS,
  accionIntervencionLabel,
  detalleElementoTexto,
  type AccionElemento,
  type DetalleElementoIntervenido,
  type DispositivoAccion,
  type UnidadNoRevisable,
  UNIDAD_NO_REVISABLE_LABELS,
  type ActualizacionSobre,
  CAMBIO_EQUIPO_RAZON_LABELS,
  EQUIP_GROUPS,
  EQUIP_ITEM_PHOTO_LABEL,
  SATISFACCION_LABELS,
  cantidadCamarasAdas,
  formatSeries,
  getServiceMode,
  isEquipoSwap,
  servicioLabel,
  type CambioEquipoRazon,
  type Equipo,
  type MotivoIntervencion,
  type SatisfaccionFirma,
  type TipoServicio,
} from '@wara/shared';

// Exportación a Excel del listado de Conformidades del panel, pensada para analizar: una hoja con una fila por conformidad (datos
// de la visita, equipo instalado y retirado, cada elemento instalado en su columna, control de instalación, observaciones, firma y
// altas) y otra hoja "Instalado" con una fila por elemento instalado (para tablas dinámicas por sensor, módulo, cliente, técnico...).
// El servidor devuelve las hojas ya armadas y el panel arma el .xlsx en el navegador: el API no necesita ninguna librería nueva.

// Tope de filas por exportación: con más, se avisa que se recortó en vez de armar un archivo gigante o tumbar el servidor.
export const LIMITE_FILAS_EXPORT = 10_000;

// Una celda: texto, o número cuando es un dato para sumar o promediar (cantidades, señal, voltajes, odómetro...). '' = vacía.
export type Celda = string | number;
export type FilaExport = Celda[];
export interface HojaExport {
  nombre: string;
  encabezados: string[];
  filas: FilaExport[];
}

const ESTADO_LABEL: Record<string, string> = {
  borrador_pre: 'Borrador PRE',
  pendiente_post: 'Pendiente POST',
  completo: 'Completo',
};

interface AltaDoc {
  checked?: boolean | null;
  usuarioId?: unknown;
  fecha?: Date | string | null;
}

// Lo mínimo de la hoja que se lee para armar las filas (consulta con proyección, sin fotos ni checklist).
export interface ConformidadParaExport {
  codigoActa?: string | null;
  numero?: string | null;
  cliente?: string | null;
  responsableEmpresa?: string | null;
  tecnicoId?: unknown;
  tecnicoIdPost?: unknown;
  matricula?: string | null;
  tipoUnidad?: string | null;
  ticketOdoo?: { numero?: string | null } | null;
  tareaOdoo?: { id?: number | null } | null;
  subtareaOdoo?: { nombre?: string | null } | null;
  tipoServicio?: TipoServicio | null;
  motivoIntervencion?: MotivoIntervencion | null;
  motivoIntervencionDetalle?: string | null;
  actualizacionSobre?: ActualizacionSobre | null;
  actualizacionNumero?: string | null;
  elementosIntervenidos?: Record<string, AccionElemento> | null;
  elementosIntervenidosDetalle?: Record<string, DetalleElementoIntervenido> | null;
  dispositivosAccion?: Partial<Record<DispositivoAccion, string>> | null;
  ubicacionEquipo?: string | null;
  unidadNoRevisable?: UnidadNoRevisable | null;
  cambioEquipoRazon?: CambioEquipoRazon | null;
  cambioEquipoRazonDetalle?: string | null;
  cambioEquipoTemporal?: boolean | null;
  instalaSensorModulo?: boolean | null;
  cambioEquipo?: { rol?: 'retiro' | 'instalacion' | null } | null;
  cambioUnidad?: { rol?: 'origen' | 'destino' | null; desdeRetiro?: { unidad?: string | null } | null } | null;
  fecha?: string | null;
  hora?: string | null;
  status?: string | null;
  altaEquipo?: { mesaAyuda?: AltaDoc | null; coordinacion?: AltaDoc | null } | null;
  equipo?: Record<string, unknown> | null;
  pre?: { observaciones?: string | null } | null;
  post?: {
    observaciones?: string | null;
    fallaDetalle?: string | null;
    firma?: { satisfaccion?: SatisfaccionFirma | null; firmedAt?: Date | string | null; nombreFirmante?: string | null; clienteAusente?: boolean | null } | null;
  } | null;
  verificacionEquipo?: { avanzoBajoResponsabilidad?: boolean | null } | null;
  odooSync?: { status?: string | null } | null;
  duplicado?: { estado?: string | null } | null;
}

// Ids de usuario (técnicos y quienes dieron el alta) que hay que traducir a nombre para armar las filas.
export function idsDeUsuariosDe(docs: ConformidadParaExport[]): string[] {
  const ids = new Set<string>();
  for (const d of docs) {
    for (const id of [d.tecnicoId, d.tecnicoIdPost, d.altaEquipo?.mesaAyuda?.usuarioId, d.altaEquipo?.coordinacion?.usuarioId]) {
      if (id) ids.add(String(id));
    }
  }
  return [...ids];
}

// 'YYYY-MM-DD' -> 'DD/MM/YYYY' (formato argentino); otro formato se deja como vino.
export function fechaAr(fecha: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (fecha ?? '');
}

function fechaHoraAr(d: Date | string | null | undefined): string {
  if (!d) return '';
  const fecha = new Date(d);
  if (Number.isNaN(fecha.getTime())) return '';
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(fecha);
}

// Una sola celda por área de alta, con las mismas palabras que el filtro del panel: "Pendiente", o "Hecho · quién · cuándo" (los datos
// que falten se omiten, p. ej. una alta vieja sin usuario).
export function textoAlta(a: AltaDoc | null | undefined, nombreDe: (id: unknown) => string): string {
  if (!a?.checked) return 'Pendiente';
  return ['Hecho', nombreDe(a.usuarioId), fechaHoraAr(a.fecha)].filter(Boolean).join(' · ');
}

// El filtro por técnico acepta uno o varios ids separados por coma ("a,b,c"). Se descartan los que no son ids válidos de Mongo (un
// id roto tiraba un error de cast y ahora simplemente no coincide con nada). null = sin filtro por técnico.
export function tecnicoIdsDeQuery(valor: string | undefined): string[] | null {
  if (valor === undefined || valor.trim() === '') return null;
  return valor
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^[0-9a-fA-F]{24}$/.test(s));
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Lo instalado: se deduce de EQUIP_GROUPS (las casillas de sensores, módulos, entradas/salidas y elementos adicionales), así un campo
// nuevo de la hoja aparece solo en el Excel.

interface CampoDef {
  key: string;
  label: string;
  checkbox?: boolean;
  dependsOn?: string;
  cantidad?: boolean;
  series?: boolean;
  canales?: boolean;
  conexion?: boolean;
}

interface ItemDef {
  categoria: string;
  padre: CampoDef;
  // Campo con la cantidad (sensor de temperatura ×2). Sin él, la cantidad es 1.
  cantidadKey?: string;
  // N° de serie, canales, detalle de la entrada...
  detalles: CampoDef[];
}

const GRUPO_EQUIPO = 'Datos del equipo';
const GRUPO_CONTROL = 'Control de instalación';

export const ITEMS_INSTALABLES: ItemDef[] = EQUIP_GROUPS.flatMap((group) => {
  if (group.title === GRUPO_CONTROL) return [];
  const campos = group.fields as readonly CampoDef[];
  return campos
    // De "Datos del equipo" solo cuenta la antena GPS (el N° de equipo y el IMEI van en sus propias columnas).
    .filter((f) => f.checkbox)
    .map((f) => ({
      categoria: group.title === GRUPO_EQUIPO ? 'Equipo' : group.title,
      padre: f,
      cantidadKey: campos.find((x) => x.dependsOn === f.key && x.cantidad)?.key,
      detalles: campos.filter((x) => x.dependsOn === f.key && !x.cantidad),
    }));
});

const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

function cantidadDe(item: ItemDef, equipo: Record<string, unknown>): number {
  if (!texto(equipo[item.padre.key])) return 0;
  if (item.padre.key === 'camarasAdas') return cantidadCamarasAdas(equipo as Equipo);
  if (item.cantidadKey) {
    const n = Number.parseInt(texto(equipo[item.cantidadKey]), 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }
  return 1;
}

function detalleDe(d: CampoDef, equipo: Record<string, unknown>): string {
  return d.series ? formatSeries(texto(equipo[d.key])) : texto(equipo[d.key]);
}

export interface ElementoInstalado {
  categoria: string;
  elemento: string;
  cantidad: number;
  detalle: string;
}

// Lo que quedó instalado en la unidad según la hoja. En una desinstalación (o la unidad vieja de un cambio de unidad) no se instala nada.
export function elementosInstalados(doc: ConformidadParaExport): ElementoInstalado[] {
  if (modoDe(doc) === 'retiro') return [];
  const equipo = doc.equipo ?? {};
  const out: ElementoInstalado[] = [];
  for (const item of ITEMS_INSTALABLES) {
    const cantidad = cantidadDe(item, equipo);
    if (!cantidad) continue;
    const detalle = item.detalles
      .map((d) => {
        const v = detalleDe(d, equipo);
        return v && d.canales ? `${v} canales` : v;
      })
      .filter(Boolean)
      .join(' · ');
    out.push({ categoria: item.categoria, elemento: item.padre.label, cantidad, detalle });
  }
  return out;
}

// "Temperatura ×2; Botón de pánico; Cámaras ADAS ×3 (S1, S2, S3)"
export function resumenInstalado(elementos: ElementoInstalado[]): string {
  return elementos
    .map((e) => `${e.elemento}${e.cantidad > 1 ? ` ×${e.cantidad}` : ''}${e.detalle ? ` (${e.detalle})` : ''}`)
    .join('; ');
}

function modoDe(doc: ConformidadParaExport) {
  return getServiceMode({ tipoServicio: doc.tipoServicio ?? null, cambioEquipo: doc.cambioEquipo, cambioUnidad: doc.cambioUnidad });
}

// Datos del equipo que quedó en la unidad y del que se retiró. Según el servicio, `modelo`/`imei` de la hoja son uno u otro: el que
// se retira en una desinstalación o un cambio de equipo, el que queda en cualquier otro caso (ver equipo.ts en @wara/shared).
export function equiposDe(doc: ConformidadParaExport): { instalado: { numero: string; imei: string }; retirado: { vacio: boolean; numero: string; imei: string } } {
  const e = doc.equipo ?? {};
  const base = { numero: texto(e.modelo), imei: texto(e.imei) };
  const vacio = { numero: '', imei: '' };
  if (modoDe(doc) === 'retiro') return { instalado: vacio, retirado: { vacio: false, ...base } };
  if (isEquipoSwap(doc.tipoServicio, doc.motivoIntervencion)) {
    return { instalado: { numero: texto(e.modeloInstalado), imei: texto(e.imeiInstalado) }, retirado: { vacio: false, ...base } };
  }
  return { instalado: base, retirado: { vacio: true, ...vacio } };
}

// Dato de control cargado a mano ("-89 dBm", "15,4 V", "45454"): el número, para poder promediar o filtrar; si no se entiende, el texto.
export function numeroDe(valor: unknown): Celda {
  const t = texto(valor);
  if (!t) return '';
  const n = Number(t.replace(',', '.').match(/-?\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(n) ? n : t;
}

const siNo = (v: unknown): string => (v === 'SI' ? 'Sí' : v === 'NO' ? 'No' : '');
const siSi = (b: unknown): string => (b ? 'Sí' : '');

// "Acción (sobre qué) · Elemento: reemplazado · …: diagnóstico".
function motivoDe(doc: ConformidadParaExport): string {
  if (!doc.motivoIntervencion) return '';
  const partes = [accionIntervencionLabel(doc)];
  {
    // Con cualquier acción (ej. cambio de equipo que además reemplaza la pantalla).
    for (const [k, accion] of Object.entries(doc.elementosIntervenidos ?? {})) {
      const serie = detalleElementoTexto(accion, doc.elementosIntervenidosDetalle?.[k], true);
      partes.push(`${EQUIP_ITEM_PHOTO_LABEL[k] ?? k}: ${(ACCION_ELEMENTO_LABELS[accion] ?? accion).toLowerCase()}${serie ? ` ${serie}` : ''}`);
    }
  }
  const base = partes.join(' · ');
  return doc.motivoIntervencionDetalle ? `${base}: ${doc.motivoIntervencionDetalle}` : base;
}

function razonCambioDe(doc: ConformidadParaExport): string {
  if (!doc.cambioEquipoRazon) return '';
  const base = CAMBIO_EQUIPO_RAZON_LABELS[doc.cambioEquipoRazon] ?? doc.cambioEquipoRazon;
  return doc.cambioEquipoRazonDetalle ? `${base}: ${doc.cambioEquipoRazonDetalle}` : base;
}

function cambioUnidadDe(doc: ConformidadParaExport): string {
  const cu = doc.cambioUnidad;
  if (!cu?.rol) return '';
  if (cu.rol === 'origen') return 'Origen';
  const desde = cu.desdeRetiro;
  return desde ? `Destino · equipo entregado por el cliente${desde.unidad ? ` de ${desde.unidad}` : ''}` : 'Destino';
}

const ENVIO_ODOO_LABEL: Record<string, string> = { SYNCED: 'Enviada', PENDING: 'Pendiente', FAILED: 'Con error' };

// ---------------------------------------------------------------------------------------------------------------------------------
// Columnas de la hoja "Conformidades".

interface Contexto {
  doc: ConformidadParaExport;
  nombreDe: (id: unknown) => string;
  equipos: ReturnType<typeof equiposDe>;
  elementos: ElementoInstalado[];
}

interface Columna {
  encabezado: string;
  valor: (c: Contexto) => Celda;
}

const equipoDe = (c: Contexto, key: string): unknown => (c.doc.equipo ?? {})[key];

// Una columna por elemento instalable (la cantidad, o vacía si no se instaló) y una por cada detalle (N° de serie, canales...).
const columnasDeItems: Columna[] = ITEMS_INSTALABLES.flatMap((item): Columna[] => [
  {
    encabezado: item.padre.label,
    valor: (c) => c.elementos.find((e) => e.elemento === item.padre.label)?.cantidad ?? '',
  },
  ...item.detalles.map(
    (d): Columna => ({
      // "Dónde se conecta" se repite en varios sensores: lleva el nombre del sensor para que la columna no se duplique.
      encabezado: d.conexion ? `${d.label} (${item.padre.label})` : d.label,
      valor: (c) => {
        if (!c.elementos.some((e) => e.elemento === item.padre.label)) return '';
        const v = detalleDe(d, c.doc.equipo ?? {});
        return d.canales ? numeroDe(v) : v;
      },
    }),
  ),
]);

export const COLUMNAS_CONFORMIDADES: Columna[] = [
  { encabezado: 'Código de acta', valor: (c) => c.doc.codigoActa ?? '' },
  { encabezado: 'N° de hoja', valor: (c) => c.doc.numero ?? '' },
  { encabezado: 'Fecha', valor: (c) => fechaAr(c.doc.fecha) },
  { encabezado: 'Hora', valor: (c) => c.doc.hora ?? '' },
  { encabezado: 'Estado', valor: (c) => ESTADO_LABEL[c.doc.status ?? ''] ?? c.doc.status ?? '' },
  { encabezado: 'Cliente', valor: (c) => c.doc.cliente ?? '' },
  { encabezado: 'Responsable de empresa', valor: (c) => c.doc.responsableEmpresa ?? '' },
  { encabezado: 'Unidad', valor: (c) => c.doc.matricula ?? '' },
  { encabezado: 'Tipo de unidad', valor: (c) => (c.doc.tipoUnidad === 'otro_equipo' ? 'Otro equipo' : 'Vehículo') },
  { encabezado: 'Servicio', valor: (c) => servicioLabel(c.doc) },
  { encabezado: 'Motivo de la intervención', valor: (c) => motivoDe(c.doc) },
  { encabezado: 'Razón del cambio de equipo', valor: (c) => razonCambioDe(c.doc) },
  { encabezado: 'Ubicación del equipo', valor: (c) => c.doc.ubicacionEquipo ?? '' },
  {
    encabezado: 'Unidad no revisable',
    // Desinstalación de una unidad destruida, chocada o incendiada (se salteó el checklist).
    valor: (c) => {
      const u = c.doc.unidadNoRevisable;
      return u?.motivo ? `${UNIDAD_NO_REVISABLE_LABELS[u.motivo]}${u.detalle?.trim() ? `: ${u.detalle.trim()}` : ''}` : '';
    },
  },
  { encabezado: 'Reemplazo temporal', valor: (c) => siSi(c.doc.cambioEquipoTemporal) },
  { encabezado: 'Cambio de unidad', valor: (c) => cambioUnidadDe(c.doc) },
  { encabezado: 'Técnico', valor: (c) => c.nombreDe(c.doc.tecnicoId) },
  {
    encabezado: 'Técnico que cerró el POST',
    // Solo si lo cerró otro técnico (un traspaso de unidad en el lugar).
    valor: (c) => (c.doc.tecnicoIdPost && String(c.doc.tecnicoIdPost) !== String(c.doc.tecnicoId) ? c.nombreDe(c.doc.tecnicoIdPost) : ''),
  },
  { encabezado: 'Ticket Odoo', valor: (c) => c.doc.ticketOdoo?.numero ?? '' },
  { encabezado: 'Tarea Odoo', valor: (c) => c.doc.tareaOdoo?.id ?? '' },
  { encabezado: 'Subtarea Odoo', valor: (c) => c.doc.subtareaOdoo?.nombre ?? '' },
  { encabezado: 'N° de equipo instalado', valor: (c) => c.equipos.instalado.numero },
  { encabezado: 'IMEI instalado', valor: (c) => c.equipos.instalado.imei },
  { encabezado: 'N° de equipo retirado', valor: (c) => c.equipos.retirado.numero },
  { encabezado: 'IMEI retirado', valor: (c) => c.equipos.retirado.imei },
  { encabezado: 'Lo instalado (resumen)', valor: (c) => resumenInstalado(c.elementos) },
  { encabezado: 'Elementos instalados (cantidad)', valor: (c) => c.elementos.reduce((n, e) => n + e.cantidad, 0) || '' },
  ...columnasDeItems,
  { encabezado: 'Señal del módem (dBm)', valor: (c) => numeroDe(equipoDe(c, 'controlSenalModem')) },
  { encabezado: 'Satélites GPS', valor: (c) => numeroDe(equipoDe(c, 'controlCantidadSatGps')) },
  { encabezado: 'Batería interna (V)', valor: (c) => numeroDe(equipoDe(c, 'controlBateriaInterna')) },
  { encabezado: 'Alimentación externa (V)', valor: (c) => numeroDe(equipoDe(c, 'controlAlimentacionExterna')) },
  { encabezado: 'Odómetro (km)', valor: (c) => numeroDe(equipoDe(c, 'controlOdometro')) },
  { encabezado: 'Horómetro (hs)', valor: (c) => numeroDe(equipoDe(c, 'controlHorometro')) },
  { encabezado: 'Control: ignición', valor: (c) => siNo(equipoDe(c, 'controlRevisionIgnicion')) },
  { encabezado: 'Control: pánico', valor: (c) => siNo(equipoDe(c, 'controlRevisionPanico')) },
  { encabezado: 'Control: conexión a la red', valor: (c) => siNo(equipoDe(c, 'controlConexionRed')) },
  { encabezado: 'Control: sensores / módulos', valor: (c) => siNo(equipoDe(c, 'controlRevisionSensores')) },
  {
    encabezado: 'Elementos retirados',
    valor: (c) =>
      texto(equipoDe(c, 'elementosRetirados'))
        .split(',')
        .filter(Boolean)
        .map((k) => EQUIP_ITEM_PHOTO_LABEL[k] ?? k)
        .join('; '),
  },
  { encabezado: 'Retirado sin N° de serie (descripción)', valor: (c) => texto(equipoDe(c, 'equipoRetiradoSinSerie')) },
  { encabezado: 'Observaciones PRE', valor: (c) => c.doc.pre?.observaciones ?? '' },
  { encabezado: 'Falla detectada', valor: (c) => c.doc.post?.fallaDetalle ?? '' },
  { encabezado: 'Observaciones POST', valor: (c) => c.doc.post?.observaciones ?? '' },
  {
    encabezado: 'Conformidad del cliente',
    valor: (c) => {
      const f = c.doc.post?.firma;
      if (f?.clienteAusente) return 'Cliente ausente';
      return f?.satisfaccion ? (SATISFACCION_LABELS[f.satisfaccion] ?? f.satisfaccion) : '';
    },
  },
  { encabezado: 'Firmó el POST', valor: (c) => c.doc.post?.firma?.nombreFirmante ?? '' },
  { encabezado: 'Fecha de firma del POST', valor: (c) => fechaHoraAr(c.doc.post?.firma?.firmedAt) },
  { encabezado: 'Alta mesa de ayuda', valor: (c) => textoAlta(c.doc.altaEquipo?.mesaAyuda, c.nombreDe) },
  { encabezado: 'Alta coordinación', valor: (c) => textoAlta(c.doc.altaEquipo?.coordinacion, c.nombreDe) },
  { encabezado: 'Equipo sin verificar', valor: (c) => siSi(c.doc.verificacionEquipo?.avanzoBajoResponsabilidad) },
  { encabezado: 'Posible duplicado sin revisar', valor: (c) => siSi(c.doc.duplicado?.estado === 'pendiente') },
  { encabezado: 'PDF en Odoo', valor: (c) => ENVIO_ODOO_LABEL[c.doc.odooSync?.status ?? ''] ?? '' },
];

export const ENCABEZADOS_EXPORT: string[] = COLUMNAS_CONFORMIDADES.map((c) => c.encabezado);

export function filaDeConformidad(doc: ConformidadParaExport, nombreDe: (id: unknown) => string): FilaExport {
  const contexto: Contexto = { doc, nombreDe, equipos: equiposDe(doc), elementos: elementosInstalados(doc) };
  return COLUMNAS_CONFORMIDADES.map((col) => col.valor(contexto));
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Hoja "Instalado": una fila por elemento instalado en cada conformidad.

export const ENCABEZADOS_INSTALADO = ['Código de acta', 'Fecha', 'Cliente', 'Unidad', 'Técnico', 'Servicio', 'Categoría', 'Elemento', 'Cantidad', 'Detalle (N° de serie, canales...)'];

export function filasInstalado(doc: ConformidadParaExport, nombreDe: (id: unknown) => string): FilaExport[] {
  return elementosInstalados(doc).map((e) => [
    doc.codigoActa ?? '',
    fechaAr(doc.fecha),
    doc.cliente ?? '',
    doc.matricula ?? '',
    nombreDe(doc.tecnicoId),
    servicioLabel(doc),
    e.categoria,
    e.elemento,
    e.cantidad,
    e.detalle,
  ]);
}

export function armarHojasExport(docs: ConformidadParaExport[], nombreDe: (id: unknown) => string): HojaExport[] {
  return [
    { nombre: 'Conformidades', encabezados: ENCABEZADOS_EXPORT, filas: docs.map((d) => filaDeConformidad(d, nombreDe)) },
    { nombre: 'Instalado', encabezados: ENCABEZADOS_INSTALADO, filas: docs.flatMap((d) => filasInstalado(d, nombreDe)) },
  ];
}
