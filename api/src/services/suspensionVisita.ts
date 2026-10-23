// Una visita puede suspenderse (el técnico deja la tarea para atender otra cercana y vuelve): cada suspensión queda
// con su desde/hasta y motivo en `VisitaNotificacion.suspensiones`. Los reportes descuentan ese tiempo del traslado y
// del tiempo en sitio, así la tarea suspendida no figura como si el técnico hubiera estado ahí todo ese rato.

export interface SuspensionVisita {
  desdeAt: Date;
  hastaAt?: Date | null;
  motivo?: string;
}

// Minutos de suspensión que caen dentro de [desde, hasta]. Una suspensión abierta (sin `hastaAt`) llega hasta
// `finPorDefecto` (el cierre de la visita); si tampoco hay, no se puede medir y no cuenta.
export function minutosSuspendidosEn(
  suspensiones: SuspensionVisita[] | null | undefined,
  desde: Date | null | undefined,
  hasta: Date | null | undefined,
  finPorDefecto?: Date | null,
): number {
  if (!desde || !hasta) return 0;
  let ms = 0;
  for (const s of suspensiones ?? []) {
    const fin = s.hastaAt ?? finPorDefecto ?? null;
    if (!fin) continue;
    const ini = Math.max(s.desdeAt.getTime(), desde.getTime());
    const end = Math.min(fin.getTime(), hasta.getTime());
    if (end > ini) ms += end - ini;
  }
  return Math.round(ms / 60000);
}

// Cierra la suspensión abierta (la última sin `hastaAt`), sin que `hastaAt` quede antes de `desdeAt`.
export function cerrarSuspensionAbierta(suspensiones: SuspensionVisita[], momento: Date): void {
  for (let i = suspensiones.length - 1; i >= 0; i--) {
    if (!suspensiones[i].hastaAt) {
      suspensiones[i].hastaAt = momento < suspensiones[i].desdeAt ? suspensiones[i].desdeAt : momento;
      return;
    }
  }
}

// Una tarea tiene UNA visita por técnico y día. Si la visita se cerró (todas las unidades que había estaban resueltas) y el
// técnico sigue en el lugar porque se sumaron unidades, se reabre la misma visita en vez de crear otra. El rato entre el
// cierre y la reapertura no fue trabajo en el lugar para esta tarea: queda registrado como una pausa, así los reportes no lo
// cuentan como tiempo en sitio.
export const MOTIVO_REAPERTURA = 'Visita reabierta: se sumaron unidades';

export function entradaPorReapertura(completoAt: Date, momento: Date): SuspensionVisita {
  return { desdeAt: completoAt, hastaAt: momento < completoAt ? completoAt : momento, motivo: MOTIVO_REAPERTURA };
}

// ¿Se avisa al cliente por Telegram? Al reabrir no se manda otro "llegó", y si ya se le avisó "trabajo finalizado" no se lo
// repite cuando la misma visita se vuelve a cerrar.
export function debeAvisarAlCliente(
  estado: 'en_camino' | 'en_sitio' | 'completo',
  reabierta: boolean,
  ultimoEnvio: { estado?: string; status?: string } | null | undefined,
): boolean {
  if (reabierta) return false;
  if (estado === 'completo' && ultimoEnvio?.estado === 'completo' && ultimoEnvio?.status === 'SENT') return false;
  return true;
}
