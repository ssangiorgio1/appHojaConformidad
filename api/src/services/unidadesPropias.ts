// Qué unidades (subtareas) de un lote cuentan como "de este técnico" para decidir si ya terminó y se cierra la visita.
//
// Tiene que ser EXACTAMENTE el mismo criterio con que la agenda se las muestra en la pantalla (ver listCalendarTasks): las
// asignadas a él en la propia subtarea. Lo que figure asignado en la tarea general NO cuenta (ni las subtareas sin nadie
// asignado heredan el acceso del lote): si un técnico está en la tarea y en su subtarea, no tiene que ver las de los demás.
// Una unidad asignada solo a otro técnico, o a nadie, no cuenta, igual que en la pantalla.

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
    // Visible para él: está asignado a la unidad (una unidad sin nadie asignado no es de nadie todavía).
    if (asignados.has(technicianOdooId)) {
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
