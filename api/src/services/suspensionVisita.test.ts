import { describe, expect, it } from 'vitest';
import { cerrarSuspensionAbierta, minutosSuspendidosEn } from './suspensionVisita.js';

const t = (hhmm: string) => new Date(`2026-10-21T${hhmm}:00Z`);

describe('minutosSuspendidosEn', () => {
  const sitio = [t('10:00'), t('13:00')] as const;

  it('sin suspensiones no descuenta nada', () => {
    expect(minutosSuspendidosEn([], ...sitio)).toBe(0);
    expect(minutosSuspendidosEn(undefined, ...sitio)).toBe(0);
  });

  it('descuenta la suspensión completa que cae dentro del tiempo en sitio', () => {
    expect(minutosSuspendidosEn([{ desdeAt: t('11:00'), hastaAt: t('11:45') }], ...sitio)).toBe(45);
  });

  it('suma varias suspensiones', () => {
    const s = [
      { desdeAt: t('10:30'), hastaAt: t('10:50') },
      { desdeAt: t('12:00'), hastaAt: t('12:10') },
    ];
    expect(minutosSuspendidosEn(s, ...sitio)).toBe(30);
  });

  it('solo cuenta la parte que cae dentro del rango (traslado vs. sitio)', () => {
    // Suspendida mientras viajaba (9:40-10:20) y llegó a las 10:00: 20 min son de traslado y 20 de sitio.
    const s = [{ desdeAt: t('09:40'), hastaAt: t('10:20') }];
    expect(minutosSuspendidosEn(s, t('09:00'), t('10:00'))).toBe(20);
    expect(minutosSuspendidosEn(s, t('10:00'), t('13:00'))).toBe(20);
  });

  it('una suspensión abierta llega hasta el cierre de la visita; sin cierre no se puede medir', () => {
    const s = [{ desdeAt: t('12:00'), hastaAt: null }];
    expect(minutosSuspendidosEn(s, ...sitio, t('13:00'))).toBe(60);
    expect(minutosSuspendidosEn(s, ...sitio)).toBe(0);
  });

  it('sin rango válido devuelve 0', () => {
    expect(minutosSuspendidosEn([{ desdeAt: t('11:00'), hastaAt: t('12:00') }], null, t('13:00'))).toBe(0);
    expect(minutosSuspendidosEn([{ desdeAt: t('11:00'), hastaAt: t('12:00') }], t('10:00'), undefined)).toBe(0);
  });
});

describe('cerrarSuspensionAbierta', () => {
  it('cierra la última abierta y no toca las ya cerradas', () => {
    const s = [
      { desdeAt: t('10:00'), hastaAt: t('10:10') as Date | null },
      { desdeAt: t('11:00'), hastaAt: null as Date | null },
    ];
    cerrarSuspensionAbierta(s, t('11:30'));
    expect(s[0].hastaAt).toEqual(t('10:10'));
    expect(s[1].hastaAt).toEqual(t('11:30'));
  });

  it('nunca deja hastaAt antes de desdeAt', () => {
    const s = [{ desdeAt: t('11:00'), hastaAt: null as Date | null }];
    cerrarSuspensionAbierta(s, t('10:00'));
    expect(s[0].hastaAt).toEqual(t('11:00'));
  });
});
