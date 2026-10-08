// Decide si una unidad "no encontrada" fue una visita fallida (el técnico llegó a tiempo y la unidad no estaba) o
// una reprogramación por demora del técnico (llegó tarde y la unidad ya se había ido). Es solo una sugerencia:
// coordinación puede corregirla al resolver la incidencia. Ver docs-visita-fallida-pdf.md.

export const TOLERANCIA_LLEGADA_MIN = 15;

export type TipoSugerido = 'no_encontrada' | 'llegada_tarde';

// null si falta la hora agendada o la de llegada: no se puede decidir y coordinación tiene que mirarlo.
export function clasificarLlegada(
  horaAgendada: Date | null | undefined,
  llegadaAt: Date | null | undefined,
  toleranciaMin = TOLERANCIA_LLEGADA_MIN,
): TipoSugerido | null {
  if (!horaAgendada || !llegadaAt) return null;
  const demoraMin = (llegadaAt.getTime() - horaAgendada.getTime()) / 60_000;
  return demoraMin > toleranciaMin ? 'llegada_tarde' : 'no_encontrada';
}
