import { describe, it, expect } from 'vitest';
import { claveDeUnidad } from './duplicidadUnidad.service.js';

describe('claveDeUnidad', () => {
  it('usa la subtarea cuando hay lote', () => {
    expect(claveDeUnidad({ fecha: '2026-10-19', subtareaOdoo: { id: 7 }, tareaOdoo: { id: 3 } })).toEqual({
      fecha: '2026-10-19',
      tipoServicio: null,
      'subtareaOdoo.id': 7,
    });
  });
  it('sin subtarea usa la tarea', () => {
    expect(claveDeUnidad({ fecha: '2026-10-19', tareaOdoo: { id: 3 } })).toEqual({
      fecha: '2026-10-19',
      tipoServicio: null,
      'tareaOdoo.id': 3,
      subtareaOdoo: null,
    });
  });
  it('el tipo de servicio forma parte de la clave: instalar y desinstalar la misma unidad no es duplicado', () => {
    const inst = claveDeUnidad({ fecha: 'x', subtareaOdoo: { id: 7 }, tipoServicio: 'instalacion' });
    const des = claveDeUnidad({ fecha: 'x', subtareaOdoo: { id: 7 }, tipoServicio: 'desinstalacion' });
    expect(inst).not.toEqual(des);
  });
  it('sin tarea de Odoo no se compara', () => {
    expect(claveDeUnidad({ fecha: '2026-10-19' })).toBeNull();
  });
  it('las hojas de cambio de equipo o unidad (van de a dos) no se comparan', () => {
    expect(claveDeUnidad({ fecha: 'x', tareaOdoo: { id: 3 }, cambioEquipo: { rol: 'retiro' } })).toBeNull();
    expect(claveDeUnidad({ fecha: 'x', tareaOdoo: { id: 3 }, cambioUnidad: { rol: 'origen' } })).toBeNull();
  });
});
