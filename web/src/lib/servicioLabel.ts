import { MOTIVO_INTERVENCION_LABELS, TIPO_SERVICIO_LABELS } from '@wara/shared';
import type { ConformidadDoc } from '@/lib/types';

// Qué se hizo, para el listado del panel: el tipo de servicio y, en una intervención, lo que no dice el tipo solo
// ("Intervención · Cambio de equipo · Sensor"). El PDF del cliente puede no mencionar el cambio de equipo; acá figura siempre.
export function servicioLabel(c: Pick<ConformidadDoc, 'tipoServicio' | 'motivoIntervencion' | 'instalaSensorModulo'>): string {
  const partes = [TIPO_SERVICIO_LABELS[c.tipoServicio ?? 'instalacion']];
  if (c.tipoServicio === 'reparacion' && c.motivoIntervencion === 'cambio_equipo') partes.push(MOTIVO_INTERVENCION_LABELS.cambio_equipo);
  if (c.instalaSensorModulo) partes.push('Sensor / módulo');
  return partes.join(' · ');
}
