import type { HydratedDocument } from 'mongoose';
import { SubtareaIncidenciaModel } from '../models/SubtareaIncidencia.js';
import { IncidenciaDestinatarioModel } from '../models/IncidenciaDestinatario.js';
import { UsuarioModel } from '../models/Usuario.js';
import type { Conformidad } from '../models/Conformidad.js';
import { createDerivedSubtask } from './calendarTask.service.js';
import { scheduleSubtareaReprogramarActivity } from './odoo.service.js';

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

// Texto de la subtarea nueva y del aviso a coordinación: qué encontró el técnico y por qué tiene que ir otro.
export function textoDerivacion(p: {
  tecnico: string;
  fecha: string;
  matricula: string;
  cliente: string;
  motivo: string;
  diagnostico: string;
}): string {
  return (
    `<p><b>Hay que enviar a otro técnico</b> — ${esc(p.cliente)} (${esc(p.matricula)}).</p>` +
    `<p>${esc(p.tecnico)} hizo la visita y el diagnóstico el ${esc(p.fecha)}, pero la intervención le corresponde a otro técnico.</p>` +
    `<p><b>Por qué:</b> ${esc(p.motivo)}</p>` +
    (p.diagnostico ? `<p><b>Diagnóstico de la visita:</b> ${esc(p.diagnostico)}</p>` : '')
  );
}

// Cuando una intervención se cierra marcada "requiere otra intervención" (record.derivacion.requerida): crea en Odoo una
// subtarea nueva en la misma tarea (mismo ticket y unidad, sin técnico ni fecha), deja una incidencia para coordinación en el
// panel y le agenda una actividad en Odoo a los destinatarios configurados. La visita original sigue su camino normal (queda
// "Hecho"); es el ticket el que queda abierto por la subtarea nueva.
//
// Idempotente: si ya se procesó (procesadaAt) no repite nada. Nunca tira: si Odoo falla, la incidencia en Mongo se crea igual
// apuntando a la subtarea original, y el error queda anotado en la hoja.
export async function procesarDerivacion(record: HydratedDocument<Conformidad>): Promise<void> {
  const d = record.derivacion;
  if (!d?.requerida || d.procesadaAt || !record.tareaOdoo?.id) return;

  const parentId = record.tareaOdoo.id;
  const originalId = record.subtareaOdoo?.id ?? record.tareaOdoo.id;
  const tecnico = record.tecnicoId ? await UsuarioModel.findById(record.tecnicoId).lean() : null;
  const html = textoDerivacion({
    tecnico: tecnico?.nombre || tecnico?.email || record.instalador || 'El técnico',
    fecha: record.fecha,
    matricula: record.matricula,
    cliente: record.cliente,
    motivo: d.motivo,
    diagnostico: record.post?.observaciones ?? '',
  });

  let nuevaId: number | null = null;
  let error = '';
  try {
    nuevaId = await createDerivedSubtask({
      parentTaskId: parentId,
      originalTaskId: originalId,
      name: record.subtareaOdoo?.nombre || record.matricula || String(originalId),
      descriptionHtml: html,
    });
  } catch (err) {
    console.error('DERIVACION_CREAR_SUBTAREA_FAILED', String(record._id), err);
    error = err instanceof Error ? err.message.slice(0, 300) : 'No se pudo crear la subtarea en Odoo';
  }

  const destinoOdooId = nuevaId ?? originalId;
  try {
    if (!record.tecnicoId) throw new Error('La hoja no tiene técnico');
    await SubtareaIncidenciaModel.create({
      clientId: `derivacion-${String(record._id)}`,
      tipo: 'requiere_otro_tecnico',
      tareaOdooId: parentId,
      subtareaOdooId: destinoOdooId,
      subtareaNombre: record.subtareaOdoo?.nombre || record.matricula || '',
      ticketOdooId: record.ticketOdoo?.odooId ?? null,
      clienteNombre: record.cliente,
      tecnicoId: record.tecnicoId,
      fecha: record.fecha,
      motivo: d.motivo,
    });
  } catch (err) {
    // clientId único: un reintento no duplica el aviso.
    console.error('DERIVACION_INCIDENCIA_FAILED', String(record._id), err);
  }

  try {
    const destinatarios = await IncidenciaDestinatarioModel.find();
    if (destinatarios.length) {
      await scheduleSubtareaReprogramarActivity({
        subtareaOdooId: destinoOdooId,
        summary: 'Reprogramar: tiene que ir otro técnico',
        note: html,
        userIds: destinatarios.map((x) => x.odooUserId),
      });
    }
  } catch (err) {
    console.error('DERIVACION_ACTIVIDAD_FAILED', String(record._id), err);
  }

  d.procesadaAt = new Date();
  d.subtareaNuevaOdooId = nuevaId;
  d.error = error;
  record.markModified('derivacion');
  await record.save();
}
