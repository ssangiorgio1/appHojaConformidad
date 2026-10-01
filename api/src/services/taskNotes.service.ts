import { executeKw } from '../config/odoo.js';
import { cached } from '../config/odooSchemaCache.js';
import { withTimeout } from './odooErrors.js';

export interface TaskNote {
  id: number;
  autor: string | null;
  fecha: string;
  texto: string;
}

export interface TaskNotes {
  tarea: TaskNote[];
  ticket: TaskNote[];
}

// A diferencia del stripHtml de calendarTask.service.ts (que colapsa todo a
// una sola línea, para descripciones cortas), acá SÍ hay que respetar los
// saltos de línea del texto original de Odoo — el técnico que escribió la
// nota los usa para separar ideas (ver fixesVarios.md) y perderlos deja un
// bloque de texto ilegible.
function stripHtml(html: string | false): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Identifica el subtipo "Nota" del chatter (mail.message.subtype) — junto
// con message_type='comment', es como se distingue una nota interna escrita
// a mano (mesa de ayuda/coordinación) de todo el resto de mail.message:
// notificaciones automáticas (asignación, cambio de etapa, "tarea creada") y
// nuestros propios posteos de "Hoja de conformidad completada" (esos van con
// otro subtipo, 'Conversaciones'/mt_comment).
//
// Antes esto se resolvía vía el external id estable 'mail.mt_note' en
// ir.model.data, pero la cuenta de servicio de Odoo no tiene el grupo
// "Administración/Permisos de acceso" que ese modelo exige para lectura —
// la llamada tiraba error SIEMPRE, getTaskNotes() nunca devolvía notas (el
// front lo traga en un catch y no muestra nada, sin avisar del error). Se
// busca en cambio directo en mail.message.subtype por name='Nota' +
// res_model=false + internal=true, que es el mismo registro (id 2 en esta
// base) y sí es legible por un usuario normal. name='Nota' es la traducción
// es_AR (mismo lang que fuerza executeKw) — 'Actividades' (id 3) es el único
// otro subtipo con res_model=false + internal=true, así que hace falta el
// nombre para no ambigüar entre los dos.
// Cacheado porque este id no cambia en la vida de la instancia.
async function getNoteSubtypeId(): Promise<number | null> {
  return cached('notes:mt_note_subtype_id', 60 * 60 * 1000, async () => {
    const rows = (await withTimeout(
      executeKw(
        'mail.message.subtype',
        'search_read',
        [[['res_model', '=', false], ['internal', '=', true], ['name', '=', 'Nota']]],
        { fields: ['id'], limit: 1 },
      ),
      'getNoteSubtypeId',
    )) as Array<{ id: number }>;
    return rows[0]?.id ?? null;
  });
}

async function notesFor(model: 'project.task' | 'helpdesk.ticket', resId: number, subtypeId: number): Promise<TaskNote[]> {
  const rows = (await withTimeout(
    executeKw(
      'mail.message',
      'search_read',
      [
        [
          ['model', '=', model],
          ['res_id', '=', resId],
          ['message_type', '=', 'comment'],
          ['subtype_id', '=', subtypeId],
        ],
      ],
      { fields: ['id', 'author_id', 'date', 'body'], order: 'date desc', limit: 50 },
    ),
    `taskNotes:${model}`,
  )) as Array<{ id: number; author_id: [number, string] | false; date: string; body: string | false }>;

  return rows
    .map((r) => ({
      id: r.id,
      autor: Array.isArray(r.author_id) ? r.author_id[1] : null,
      fecha: r.date,
      texto: stripHtml(r.body),
    }))
    .filter((n) => n.texto);
}

// Dos fuentes distintas del mismo mecanismo: mesa de ayuda anota sobre el
// TICKET (helpdesk.ticket), coordinación anota sobre la TAREA (project.task)
// — ver fixesVarios.md punto 5. `ticketOdooId` es opcional porque no toda
// tarea de FSM nace de un ticket.
export async function getTaskNotes(tareaOdooId: number, ticketOdooId: number | null): Promise<TaskNotes> {
  const subtypeId = await getNoteSubtypeId();
  if (!subtypeId) return { tarea: [], ticket: [] };

  const [tarea, ticket] = await Promise.all([
    notesFor('project.task', tareaOdooId, subtypeId),
    ticketOdooId ? notesFor('helpdesk.ticket', ticketOdooId, subtypeId) : Promise.resolve([]),
  ]);
  return { tarea, ticket };
}
