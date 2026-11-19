import type { TicketOdoo } from '@/lib/types';

// Link directo al ticket en Odoo (mismo armado que el detalle de la hoja). Sin odooId (hojas viejas) se prueba con el número.
export function ticketOdooUrl(ticket: TicketOdoo | null | undefined): string | null {
  if (!ticket?.numero) return null;
  return `${process.env.NEXT_PUBLIC_ODOO_BASE_URL}/odoo/all-tickets/${ticket.odooId ?? ticket.numero}`;
}

// "#41640 ↗" que abre el ticket en otra pestaña. Corta la propagación del click para que, dentro de una fila de la
// tabla, no despliegue ni seleccione la fila.
export function TicketOdooLink({ ticket, className = '' }: { ticket: TicketOdoo | null | undefined; className?: string }) {
  const url = ticketOdooUrl(ticket);
  if (!url) return <span className={`text-muted ${className}`}>—</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title="Abrir el ticket en Odoo"
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-0.5 font-bold text-primary hover:underline ${className}`}
    >
      #{ticket?.numero}
      <span aria-hidden className="text-[0.85em]">↗</span>
    </a>
  );
}
