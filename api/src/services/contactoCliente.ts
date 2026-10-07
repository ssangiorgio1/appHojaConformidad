// Teléfono del cliente para la ficha de la tarea (por si no está en el lugar para firmar): primero el del ticket
// (helpdesk.ticket.partner_phone, el que cargó mesa de ayuda para esa visita), si no el celular y después el teléfono
// del cliente en Odoo (res.partner.mobile / phone).
export interface ContactoCliente {
  telefono: string;
  origen: 'ticket' | 'cliente';
}

// Odoo guarda texto libre ("+54 2945 45-1921", "  ", false): se descarta lo vacío y se recortan los espacios.
export function limpiarTelefono(valor: string | false | null | undefined): string | null {
  if (typeof valor !== 'string') return null;
  const t = valor.trim();
  return /\d/.test(t) ? t : null;
}

export function elegirContacto(datos: {
  ticketPhone?: string | false | null;
  partnerMobile?: string | false | null;
  partnerPhone?: string | false | null;
}): ContactoCliente | null {
  const ticket = limpiarTelefono(datos.ticketPhone);
  if (ticket) return { telefono: ticket, origen: 'ticket' };
  const cliente = limpiarTelefono(datos.partnerMobile) ?? limpiarTelefono(datos.partnerPhone);
  return cliente ? { telefono: cliente, origen: 'cliente' } : null;
}
