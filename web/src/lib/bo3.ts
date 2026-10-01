// Pantalla de diagnóstico de bo3 (VisionBLO) para un equipo.
// El número después de "#" es ruteo client-side de bo3 (no viaja al servidor).
export function bo3DiagnosticoUrl(equipoId: number): string {
  return `https://ssl.visionblo.com/bo3/equipo/diagnostico#${equipoId}`;
}
