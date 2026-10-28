// Antes de escribir en Odoo (mover la fecha, reabrir, reasignar) se comprueba que la tarea que hay ahí es la que se reportó.
// Los ids de tareas son números de una base de datos concreta: si el registro se creó contra otro Odoo (pruebas vs.
// producción) o la tarea cambió, escribir por id pegaría en una tarea ajena, que es lo que pasó con el ticket 39086 (una
// tarea ya cerrada de otro cliente quedó reabierta y movida de fecha). Esta decisión es pura para poder probarla sola.

export interface FilaTareaOdoo {
  name?: string | false;
  parent_id?: [number, string] | false;
  is_closed?: boolean;
  state?: string | false;
  // El ticket del que nace la tarea (en un lote vive en la tarea padre, no en la unidad).
  helpdesk_ticket_id?: [number, string] | false;
}

export interface TareaEsperada {
  // El nombre con que se reportó la unidad (la patente o el título). Vacío = no se compara (incidencias muy viejas).
  nombre?: string | null;
  // La tarea padre del lote. null = es una tarea suelta, que no cuelga de otra.
  parentId?: number | null;
  // El ticket con que se reportó. Si la tarea (o su padre) está vinculada a OTRO ticket, no es la reportada: es lo que evita
  // que un comentario con PDF caiga en el ticket de un cliente ajeno.
  ticketId?: number | null;
}

export type VerificacionTarea = { ok: true } | { ok: false; motivo: string };

const normalizar = (s: string): string => s.replace(/\s+/g, ' ').trim().toLowerCase();

const ESTADOS: Record<string, string> = { '1_done': 'hecha', '1_canceled': 'cancelada' };

// `filaPadre`: la tarea padre, solo hace falta para leer su ticket cuando la unidad cuelga de un lote.
export function evaluarTarea(taskId: number, fila: FilaTareaOdoo | undefined, esperado: TareaEsperada, filaPadre?: FilaTareaOdoo): VerificacionTarea {
  if (!fila) return { ok: false, motivo: `La tarea #${taskId} no existe en este Odoo. No se cambió nada.` };

  const nombre = typeof fila.name === 'string' ? fila.name : '';
  if (esperado.nombre?.trim() && normalizar(nombre) !== normalizar(esperado.nombre)) {
    return {
      ok: false,
      motivo: `La tarea #${taskId} de este Odoo se llama "${nombre}" y no "${esperado.nombre.trim()}": no es la que se reportó. No se cambió nada en Odoo.`,
    };
  }

  if (esperado.parentId !== undefined) {
    const padre = fila.parent_id ? fila.parent_id[0] : null;
    if (padre !== esperado.parentId) {
      return { ok: false, motivo: `La tarea #${taskId} no pertenece a la misma tarea que se reportó. No se cambió nada en Odoo.` };
    }
  }

  if (esperado.ticketId) {
    const origen = esperado.parentId == null ? fila : filaPadre;
    const real = origen?.helpdesk_ticket_id;
    if (real && real[0] !== esperado.ticketId) {
      return {
        ok: false,
        motivo: `La tarea #${taskId} de este Odoo pertenece al ticket #${real[0]}, no al #${esperado.ticketId} con que se reportó: no es la misma tarea. No se cambió nada en Odoo.`,
      };
    }
  }

  if (fila.is_closed) {
    const estado = typeof fila.state === 'string' ? (ESTADOS[fila.state] ?? 'cerrada') : 'cerrada';
    return {
      ok: false,
      motivo: `La tarea #${taskId} ya está ${estado} en Odoo: no se reabre ni se reprograma desde acá. Si corresponde, reabrila directamente en Odoo.`,
    };
  }

  return { ok: true };
}
