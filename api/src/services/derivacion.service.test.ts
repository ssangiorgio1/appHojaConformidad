import { describe, expect, it } from 'vitest';
import { textoDerivacion } from './derivacion.service.js';

describe('textoDerivacion', () => {
  const base = { tecnico: 'Ana', fecha: '2026-10-14', matricula: 'AB 054 AQ', cliente: 'Messina S.A.', motivo: 'Hay que cambiar el cableado', diagnostico: '' };

  it('cuenta quién hizo la visita, la unidad y por qué tiene que ir otro técnico', () => {
    const html = textoDerivacion(base);
    expect(html).toContain('AB 054 AQ');
    expect(html).toContain('Messina S.A.');
    expect(html).toContain('Ana');
    expect(html).toContain('Hay que cambiar el cableado');
    expect(html).not.toContain('Diagnóstico de la visita');
  });

  it('suma el diagnóstico cuando lo hay y escapa el HTML', () => {
    const html = textoDerivacion({ ...base, motivo: '<script>x</script>', diagnostico: 'Falla en la <b>alimentación</b>' });
    expect(html).toContain('Diagnóstico de la visita');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;b&gt;alimentación&lt;/b&gt;');
  });
});
