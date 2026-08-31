import { newRecord } from '@wara/shared';
import { describe, expect, it } from 'vitest';
import type { OdooTicketResult } from '../api/client';
import { buildTicketOdooRef, mergeTicketOdooIntoRecord, parseNameEmail } from './ticketOdoo';

function ticket(overrides: Partial<OdooTicketResult> = {}): OdooTicketResult {
  return { id: 42, label: 'Ticket de prueba', partnerName: null, partnerEmail: null, stage: null, ...overrides };
}

describe('parseNameEmail', () => {
  it('splits "Nombre <correo>" into name and email', () => {
    expect(parseNameEmail('Wara Interno <cliente@ejemplo.com>')).toEqual({
      name: 'Wara Interno',
      email: 'cliente@ejemplo.com',
    });
  });

  it('returns null when the label has no <email> suffix', () => {
    expect(parseNameEmail('Ticket sin correo')).toBeNull();
  });
});

describe('buildTicketOdooRef', () => {
  it('prefers partner_id name/email when Odoo has them', () => {
    const ref = buildTicketOdooRef(
      ticket({ partnerName: 'Wara Interno', partnerEmail: 'contacto@wara.com', label: 'Debería ignorarse <otro@x.com>' }),
    );
    expect(ref).toMatchObject({
      numero: '42',
      odooId: 42,
      clienteOdoo: 'Wara Interno',
      clienteEmailOdoo: 'contacto@wara.com',
      verified: true,
    });
  });

  it('falls back to parsing "Nombre <correo>" from the subject when there is no partner_id', () => {
    const ref = buildTicketOdooRef(ticket({ label: 'Wara Interno <cliente@ejemplo.com>' }));
    expect(ref.clienteOdoo).toBe('Wara Interno');
    expect(ref.clienteEmailOdoo).toBe('cliente@ejemplo.com');
  });

  it('uses the raw label as cliente and leaves the email undefined when nothing can be parsed', () => {
    const ref = buildTicketOdooRef(ticket({ label: 'Ticket sin cliente asignado' }));
    expect(ref.clienteOdoo).toBe('Ticket sin cliente asignado');
    expect(ref.clienteEmailOdoo).toBeUndefined();
  });
});

describe('mergeTicketOdooIntoRecord', () => {
  const base = () => newRecord('local-1', new Date('2026-08-28T12:00:00Z'));

  it('fills cliente and responsableEmpresa when both are empty', () => {
    const ticketOdoo = buildTicketOdooRef(ticket({ partnerName: 'Wara Interno', partnerEmail: 'contacto@wara.com' }));
    const next = mergeTicketOdooIntoRecord(base(), ticketOdoo);
    expect(next.ticketOdoo).toEqual(ticketOdoo);
    expect(next.cliente).toBe('Wara Interno');
    expect(next.responsableEmpresa).toBe('contacto@wara.com');
  });

  it('never overwrites a cliente or responsableEmpresa the técnico already typed', () => {
    const record = { ...base(), cliente: 'Cliente manual', responsableEmpresa: 'manual@empresa.com' };
    const ticketOdoo = buildTicketOdooRef(ticket({ partnerName: 'Otro cliente', partnerEmail: 'otro@correo.com' }));
    const next = mergeTicketOdooIntoRecord(record, ticketOdoo);
    expect(next.cliente).toBe('Cliente manual');
    expect(next.responsableEmpresa).toBe('manual@empresa.com');
    expect(next.ticketOdoo).toEqual(ticketOdoo);
  });

  it('clearing the ticket (null) only unsets ticketOdoo, leaving cliente/responsableEmpresa untouched', () => {
    const record = { ...base(), cliente: 'Cliente manual', responsableEmpresa: 'manual@empresa.com', ticketOdoo: buildTicketOdooRef(ticket()) };
    const next = mergeTicketOdooIntoRecord(record, null);
    expect(next.ticketOdoo).toBeNull();
    expect(next.cliente).toBe('Cliente manual');
    expect(next.responsableEmpresa).toBe('manual@empresa.com');
  });
});
