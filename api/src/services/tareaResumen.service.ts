import { executeKw } from '../config/odoo.js';
import { cached } from '../config/odooSchemaCache.js';
import { env } from '../config/env.js';
import { many2oneName, withTimeout } from './odooErrors.js';

// Datos de una tarea de Odoo para mostrar en el panel (visitas abiertas): qué tarea es, de qué ticket y de qué cliente.
// Solo lectura y solo campos estándar de project.task (los de Odoo Studio pueden no existir en producción y hacen fallar
// toda la lectura). Cacheado un rato: la pantalla se actualiza seguido y no hace falta pegarle a Odoo cada vez.

export interface UnidadResumen {
  id: number;
  nombre: string;
  cerrada: boolean;
}

export interface TareaResumen {
  id: number;
  nombre: string;
  cliente: string | null;
  etapa: string | null;
  ticket: { id: number; titulo: string; url: string } | null;
  url: string;
  unidades: UnidadResumen[];
}

const CACHE_MS = 2 * 60_000;

const m2o = (v: unknown): { id: number; label: string } | null => (Array.isArray(v) && v.length > 1 ? { id: v[0] as number, label: String(v[1]) } : null);

export const odooRegistroUrl = (modelo: string, id: number): string => `${env.ODOO_URL}/web#model=${modelo}&id=${id}&view_type=form`;

async function leer(ids: number[]): Promise<Map<number, TareaResumen>> {
  const filas = (await withTimeout(
    executeKw('project.task', 'search_read', [[['id', 'in', ids]]], {
      fields: ['id', 'name', 'partner_id', 'stage_id', 'helpdesk_ticket_id'],
      context: { active_test: false },
    }),
    'tareaResumen:tareas',
  )) as Array<{ id: number; name: string; partner_id: unknown; stage_id: unknown; helpdesk_ticket_id: unknown }>;
  const hijas = (await withTimeout(
    executeKw('project.task', 'search_read', [[['parent_id', 'in', ids]]], {
      fields: ['id', 'name', 'parent_id', 'is_closed'],
      context: { active_test: false },
      order: 'id',
    }),
    'tareaResumen:unidades',
  )) as Array<{ id: number; name: string; parent_id: unknown; is_closed?: boolean }>;

  const out = new Map<number, TareaResumen>();
  for (const f of filas) {
    const ticket = m2o(f.helpdesk_ticket_id);
    out.set(f.id, {
      id: f.id,
      nombre: f.name,
      cliente: many2oneName(f.partner_id),
      etapa: many2oneName(f.stage_id),
      ticket: ticket ? { id: ticket.id, titulo: ticket.label, url: odooRegistroUrl('helpdesk.ticket', ticket.id) } : null,
      url: odooRegistroUrl('project.task', f.id),
      unidades: hijas
        .filter((h) => m2o(h.parent_id)?.id === f.id)
        .map((h) => ({ id: h.id, nombre: h.name, cerrada: h.is_closed === true })),
    });
  }
  return out;
}

// Mejor esfuerzo: si Odoo no responde devuelve un mapa vacío y la pantalla muestra lo que hay en Mongo.
export async function resumenDeTareas(tareaIds: number[]): Promise<Map<number, TareaResumen>> {
  const ids = [...new Set(tareaIds)].sort((a, b) => a - b);
  if (!ids.length) return new Map();
  try {
    return await cached(`tareaResumen:${ids.join(',')}`, CACHE_MS, () => leer(ids));
  } catch (err) {
    console.error('TAREA_RESUMEN_FAILED', err instanceof Error ? err.message : err);
    return new Map();
  }
}
