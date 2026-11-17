import writeXlsxFile from 'write-excel-file/browser';
import type { HojaExport } from './types';

// Arma un .xlsx en el navegador y lo descarga: una pestaña por hoja, con el encabezado en negrita y fijo al desplazarse y las columnas con
// el ancho de su contenido. Los textos van como texto (IMEI, tickets y códigos largos no se pasan a número ni a notación científica) y los
// números como número (para sumar, promediar y armar tablas dinámicas).

const ANCHO_MIN = 10;
const ANCHO_MAX = 48;

export function anchosDeColumnas(encabezados: readonly string[], filas: ReadonlyArray<ReadonlyArray<string | number>>): Array<{ width: number }> {
  return encabezados.map((encabezado, i) => {
    const mayor = filas.reduce((m, fila) => Math.max(m, String(fila[i] ?? '').length), encabezado.length);
    return { width: Math.min(ANCHO_MAX, Math.max(ANCHO_MIN, mayor + 2)) };
  });
}

export async function descargarXlsx(hojas: readonly HojaExport[], nombreArchivo: string): Promise<void> {
  const sheets = hojas.map((h) => ({
    sheet: h.nombre,
    columns: anchosDeColumnas(h.encabezados, h.filas),
    stickyRowsCount: 1,
    data: [
      h.encabezados.map((value) => ({ value, fontWeight: 'bold' as const })),
      // Una celda vacía va vacía (null), no como texto en blanco.
      ...h.filas.map((fila) => fila.map((value) => (value === '' ? null : value))),
    ],
  }));
  await writeXlsxFile(sheets).toFile(nombreArchivo);
}
