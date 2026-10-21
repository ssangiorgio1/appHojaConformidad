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
