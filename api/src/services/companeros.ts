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

// Los de la tarea: los asignados al padre y los de las unidades que ve este técnico, juntos y sin repetir.
export function companerosDeTarea(
  asignadosDelPadre: number[] | null | undefined,
  unidades: Array<{ technicianIds: number[] }>,
  yo: number,
  nombrePorId: Map<number, string>,
): string[] {
  return nombresCompaneros([...(asignadosDelPadre ?? []), ...unidades.flatMap((u) => u.technicianIds)], yo, nombrePorId);
}
