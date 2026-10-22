// Decide si la visita se hizo "fuera del rango horario" por culpa del técnico. Las tareas se agendan por RANGO (por
// ejemplo de 12:00 a 13:00): el técnico puede llegar en cualquier momento de ese rango sin que sea una demora. Solo si
// llega DESPUÉS de que termina el rango la visita es, en parte, culpa de WARA (se reprograma sin cargo para el cliente);
// si no, es una visita fallida (facturable). Ver docs-visita-fallida-pdf.md.

export type TipoSugerido = 'no_encontrada' | 'llegada_tarde';

// 'llegada_tarde' = llegó pasada la hora de fin del rango; 'no_encontrada' = llegó dentro del rango (o antes).
// null si falta el fin del rango o la hora de llegada: no se puede decidir.
export function clasificarLlegada(horaFinAgendada: Date | null | undefined, llegadaAt: Date | null | undefined): TipoSugerido | null {
  if (!horaFinAgendada || !llegadaAt) return null;
  return llegadaAt.getTime() > horaFinAgendada.getTime() ? 'llegada_tarde' : 'no_encontrada';
}

// ¿La constancia de visita fallida sale AL REPORTAR (en el momento en que el técnico confirma "No está en el lugar")?
// Sí cuando es "no está" dentro del rango horario y hay ticket donde adjuntarla. Si el técnico llegó fuera del rango no
// se manda nada todavía: va el PDF de reprogramación sin cargo, que necesita la fecha nueva y sale al resolver. Los otros
// reportes tampoco: "Reprogramar" espera a coordinación y "Lo pidió el cliente" tiene su propio PDF al reportar.
export function enviaConstanciaAlReportar(i: { tipo: string; fueraDeRango: boolean; ticketOdooId?: number | null }): boolean {
  return i.tipo === 'no_encontrada' && !i.fueraDeRango && !!i.ticketOdooId;
}

// Al resolver: si la constancia ya salió al reportar, no se manda otra; con fecha nueva alcanza una nota en el ticket.
export function constanciaYaEnviada(i: { tipo: string; pdfReprogramacionAt?: Date | null }): boolean {
  return i.tipo === 'no_encontrada' && !!i.pdfReprogramacionAt;
}
