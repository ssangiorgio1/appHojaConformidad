// Qué unidades (subtareas) de un lote cuentan como "de este técnico" para decidir si ya terminó y se cierra la visita.
//
// Tiene que ser EXACTAMENTE el mismo criterio con que la agenda se las muestra en la pantalla (ver listCalendarTasks): las
// asignadas a él, y también las que no tienen ningún técnico asignado (heredan el acceso del lote). Si el servidor contara
// solo las asignadas, la visita se cerraba sola cuando terminaba esas aunque en la pantalla le quedaran unidades sin hacer, y
// la ficha lo mandaba a "Salir hacia destino" de nuevo. Una unidad asignada solo a otro técnico no cuenta, igual que en la
// pantalla.

export interface FilaUnidad {
  id: number;
  name: string;
  user_ids?: number[];
}

// Los ids "primarios" (el menor de cada grupo): una misma unidad física puede estar cargada como 2+ tareas de Odoo con el mismo
// nombre, y es ese id el que queda guardado en la hoja (`subtareaOdoo.id`).
export function unidadesPropias(unidades: FilaUnidad[], technicianOdooId: number): number[] {
  const grupos = new Map<string, FilaUnidad[]>();
  for (const u of unidades) {
    const lista = grupos.get(u.name);
    if (lista) lista.push(u);
    else grupos.set(u.name, [u]);
  }

  const propias: number[] = [];
  for (const grupo of grupos.values()) {
    const asignados = new Set(grupo.flatMap((u) => u.user_ids ?? []));
    // Visible para él: está asignado a la unidad, o la unidad no tiene a nadie asignado.
    if (asignados.size === 0 || asignados.has(technicianOdooId)) {
      propias.push(Math.min(...grupo.map((u) => u.id)));
    }
  }
  return propias;
}

// Solo las unidades asignadas EXPLÍCITAMENTE a este técnico (criterio anterior). Se sigue usando como condición para que la
// visita se cierre sola: si ninguna unidad está asignada a él, el cierre es manual ("Finalizar visita"), como siempre.
export function unidadesAsignadas(unidades: FilaUnidad[], technicianOdooId: number): number[] {
  const grupos = new Map<string, FilaUnidad[]>();
  for (const u of unidades) {
    const lista = grupos.get(u.name);
    if (lista) lista.push(u);
    else grupos.set(u.name, [u]);
  }
  const asignadas: number[] = [];
  for (const grupo of grupos.values()) {
    if (grupo.some((u) => (u.user_ids ?? []).includes(technicianOdooId))) asignadas.push(Math.min(...grupo.map((u) => u.id)));
  }
  return asignadas;
}
