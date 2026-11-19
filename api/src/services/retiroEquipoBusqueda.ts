import { escapeRegExp } from '../utils/regex.js';

// Búsqueda de texto libre del listado de actas de retiro/entrega del panel: unidad, cliente, N° de equipo, IMEI y quién entrega
// (parte del texto, sin importar mayúsculas), y el N° de ticket de Odoo (exacto, con o sin "#": es un número).
export function condicionesDeBusqueda(texto: string): Array<Record<string, unknown>> {
  const buscado = texto.trim();
  const re = new RegExp(escapeRegExp(buscado), 'i');
  const condiciones: Array<Record<string, unknown>> = [
    { subtareaNombre: re },
    { clienteNombre: re },
    { 'equipo.numero': re },
    { 'equipo.imei': re },
    { 'equiposExtra.numero': re },
    { 'equiposExtra.imei': re },
    { 'entrega.nombre': re },
    { 'entrega.lugar': re },
  ];
  const ticket = buscado.replace(/^#/, '');
  if (/^\d+$/.test(ticket)) condiciones.push({ ticketOdooId: Number(ticket) });
  return condiciones;
}
