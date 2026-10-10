import { describe, expect, it, vi } from 'vitest';

vi.mock('../models/Conformidad.js', () => ({ ConformidadModel: {} }));

import { matriculaRegex, resumirHistorial } from './historialUnidad.service.js';

describe('resumirHistorial', () => {
  it('cuenta intervenciones (reparación + cambio de equipo) y servicios por tipo', () => {
    const r = resumirHistorial('AB123CD', [
      { tipoServicio: 'instalacion', fecha: '2026-01-10' },
      { tipoServicio: 'reparacion', fecha: '2026-03-02', motivoIntervencion: 'reinicio_manual' },
      { tipoServicio: 'reparacion', fecha: '2026-05-20', motivoIntervencion: 'cambio_equipo' },
      { tipoServicio: 'cambio_equipo', fecha: '2026-02-01' },
      { tipoServicio: null, fecha: '2026-01-01' },
    ]);
    expect(r.total).toBe(5);
    expect(r.intervenciones).toBe(3);
    expect(r.porTipo).toEqual({ instalacion: 1, reparacion: 2, cambio_equipo: 1, sin_tipo: 1 });
    expect(r.ultimo).toEqual({ tipoServicio: 'reparacion', fecha: '2026-05-20', motivoIntervencion: 'cambio_equipo' });
  });
  it('sin hojas: todo en cero y sin último servicio', () => {
    expect(resumirHistorial('AB123CD', [])).toEqual({ matricula: 'AB123CD', total: 0, intervenciones: 0, porTipo: {}, ultimo: null });
  });
});

describe('matriculaRegex', () => {
  it('ignora mayúsculas, espacios y guiones', () => {
    const re = matriculaRegex('ab 123-cd');
    expect(re.test('AB123CD')).toBe(true);
    expect(re.test('AB 123 CD')).toBe(true);
    expect(re.test('AB123CDX')).toBe(false);
  });
});
