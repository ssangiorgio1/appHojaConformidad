// Con qué otros técnicos se comparte una tarea o una unidad: los nombres de los asignados en Odoo menos el técnico que está
// mirando su agenda. Los frontends lo muestran en la ficha ("Compartís esta tarea con Fernando Correa").

// Nombres, sin repetir y en el orden de asignación, de los asignados que no son `yo`. Un id sin nombre conocido se omite (no
// se inventa nada).
export function nombresCompaneros(asignados: number[] | null | undefined, yo: number, nombrePorId: Map<number, string>): string[] {
  const nombres: string[] = [];
  for (const id of asignados ?? []) {
    if (id === yo) continue;
    const nombre = nombrePorId.get(id)?.trim();
    if (nombre && !nombres.includes(nombre)) nombres.push(nombre);
  }
  return nombres;
}

// Con quién se comparte la tarea = con quién se viaja: los que comparten al menos una unidad con `yo`. Con subtareas manda
// SOLO la asignación de las unidades (las que ve este técnico, que ya son las suyas): estar los dos colgados de la tarea
// padre con unidades distintas no es compartir — cada uno hace su propio viaje. Sin subtareas, la tarea misma es la unidad.
export function idsCompanerosDeTarea(
  asignadosDelPadre: number[] | null | undefined,
  unidades: Array<{ technicianIds: number[] }>,
  yo: number,
): number[] {
  const asignados = unidades.length ? unidades.flatMap((u) => u.technicianIds) : (asignadosDelPadre ?? []);
  return [...new Set(asignados.filter((id) => id !== yo))];
}

export function companerosDeTarea(
  asignadosDelPadre: number[] | null | undefined,
  unidades: Array<{ technicianIds: number[] }>,
  yo: number,
  nombrePorId: Map<number, string>,
): string[] {
  return nombresCompaneros(idsCompanerosDeTarea(asignadosDelPadre, unidades, yo), yo, nombrePorId);
}

// La misma regla que idsCompanerosDeTarea, pero para TODOS los técnicos de la tarea a la vez, a partir de la asignación leída
// de Odoo: para cada usuario de Odoo, con quién comparte al menos una unidad. Las unidades con el mismo nombre se toman como
// una sola (igual que collapseDuplicateNames en la agenda). Con subtareas, quien está solo en la tarea padre no comparte con
// nadie; sin subtareas, todos los asignados a la tarea viajan juntos.
export function companerosPorTecnico(
  asignadosDelPadre: number[],
  unidades: Array<{ name: string; technicianIds: number[] }>,
): Map<number, number[]> {
  const porNombre = new Map<string, Set<number>>();
  for (const u of unidades) {
    const grupo = porNombre.get(u.name) ?? new Set<number>();
    for (const id of u.technicianIds) grupo.add(id);
    porNombre.set(u.name, grupo);
  }
  const grupos = unidades.length ? [...porNombre.values()] : [new Set(asignadosDelPadre)];
  const resultado = new Map<number, number[]>();
  for (const id of new Set([...asignadosDelPadre, ...grupos.flatMap((g) => [...g])])) {
    const suyas = grupos.filter((g) => g.has(id)).map((g) => ({ technicianIds: [...g] }));
    resultado.set(id, suyas.length ? idsCompanerosDeTarea(null, suyas, id) : []);
  }
  return resultado;
}
