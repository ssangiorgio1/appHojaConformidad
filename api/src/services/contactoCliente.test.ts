import { describe, expect, it } from 'vitest';
import { elegirContacto, limpiarTelefono } from './contactoCliente.js';

describe('limpiarTelefono', () => {
  it('recorta y descarta lo que no tiene dígitos', () => {
    expect(limpiarTelefono('  +54 2945 45-1921 ')).toBe('+54 2945 45-1921');
    expect(limpiarTelefono('sin teléfono')).toBeNull();
    expect(limpiarTelefono('   ')).toBeNull();
    expect(limpiarTelefono(false)).toBeNull();
    expect(limpiarTelefono(undefined)).toBeNull();
  });
});

describe('elegirContacto', () => {
  it('prefiere el teléfono del ticket', () => {
    expect(elegirContacto({ ticketPhone: '2615263289', partnerMobile: '2616000000' })).toEqual({ telefono: '2615263289', origen: 'ticket' });
  });

  it('sin teléfono en el ticket usa el celular del cliente y después el fijo', () => {
    expect(elegirContacto({ ticketPhone: false, partnerMobile: '2616000000', partnerPhone: '4210000' })).toEqual({ telefono: '2616000000', origen: 'cliente' });
    expect(elegirContacto({ ticketPhone: false, partnerMobile: false, partnerPhone: '4210000' })).toEqual({ telefono: '4210000', origen: 'cliente' });
  });

  it('sin ningún teléfono devuelve null', () => {
    expect(elegirContacto({ ticketPhone: false, partnerMobile: false, partnerPhone: false })).toBeNull();
  });
});
