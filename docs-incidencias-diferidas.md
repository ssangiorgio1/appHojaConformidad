# Incidencias diferidas hasta cerrar la visita (plan, NO implementado)

Fecha: 2026-10-10. Estado: **solo plan**. Toca la base compartida (campo nuevo, aditivo), así que no se implementa mientras haya técnicos trabajando sobre la misma BDD.

## Problema (caso tarea 21044, 2026-10-09)

El técnico reporta "no está / reprogramar" con la ficha abierta y coordinación, que ve el reporte al instante, reprograma la unidad en ese momento. La ficha no se entera, las acciones siguientes viajan con la fecha vieja y la tarea queda con dos entradas y dos visitas abiertas (09-10 y 15-10). Además, al reportar se marca "Visita fallida" en Odoo antes de que nadie evalúe si lo fue (puede ser llegada tarde, PRE cancelado o propuesta).

## Idea

Coordinación no ve nada hasta que la visita original queda cerrada (`completo`), sin importar si las unidades quedaron completas, reprogramadas por el técnico o mezcladas.

1. **Al reportar** (`createSubtareaIncidencia`): se guarda la incidencia con `liberada: false`. No se toca Odoo (ni nota, ni actividad, ni etapa) y no aparece en el panel. El técnico sí la ve en su app.
2. **Al cerrar la visita** (`notificarEstadoVisita` → `completo`, `finalizarVisitaLote`, cierre al completar la última hoja): se liberan las incidencias de esa (tarea, fecha, técnico): `liberada: true`, `liberadaAt`, y recién ahí se hacen las acciones en Odoo.
3. **Etapa en Odoo**: solo `no_encontrada` con llegada a horario va a "Visita fallida". Llegada tarde, PRE cancelado y propuestas quedan "En espera" y coordinación decide.
4. **Salvaguarda**: si la visita no se cierra, se liberan solas pasadas 12 h (mismo `VISITA_VENCE_HORAS` de visitas.controller.ts), con una pasada al listar o un barrido.
5. **Listado del panel** (`listSubtareaIncidencias`): para roles distintos de técnico, filtra `liberada !== false`. Los documentos viejos no tienen el campo y cuentan como liberados.

## Impacto en la base

- Un campo opcional nuevo en `SubtareaIncidencia` (`liberada`, `liberadaAt`). Solo lo escriben los documentos nuevos.
- Sin migración, sin índices nuevos, sin tocar documentos existentes.
- El código viejo ignora el campo; los documentos viejos siguen siendo "liberados" por la regla del punto 5.
- Mientras el código nuevo no esté desplegado, nada cambia. Ojo: correr la API local contra el Atlas compartido sí escribiría el campo.

## Pendientes aparte

- La ficha abierta (`selected` en agenda/page.tsx) es una copia fija: si la unidad cambia de fecha o desaparece, avisar y cerrar.
- Regla de negocio a confirmar: no permitir salir/llegar a una entrada con fecha futura (hoy el 09-10 se abrió una visita en la entrada del 15-10).
- `reprogramadaPara` de la incidencia 21046 quedó 2026-08-15 y la unidad en Odoo está el 15-10: revisar de dónde sale la diferencia.
- Visita abierta huérfana de la 21044 (fecha 15-10, técnico jsangiorgio): cerrar a mano cuando se pueda escribir en la base.
