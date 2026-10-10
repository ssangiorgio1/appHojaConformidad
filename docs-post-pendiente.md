# POST pendiente: unidad que se retira antes de hacer el POST (evaluación)

Fecha de la evaluación: 2026-10-06. Estado: **solo evaluado, sin implementar**.

## Caso

El técnico terminó el PRE y el paso intermedio (equipo instalado), pero antes de hacer el POST el cliente se llevó la unidad de urgencia. Se quiere **dejar el POST pendiente sin que siga corriendo el tiempo** de instalación ni de permanencia en el lugar.

## Qué pasa hoy

- **Tiempo en el lugar:** corre desde "Llegué" hasta que se cierra la visita (`enSitioAt` → `completoAt`). La PWA solo ofrece "Finalizar visita" cuando todas las unidades están completas o reportadas como no encontradas, así que con un POST a medias no se puede cerrar y el tiempo **sigue corriendo**. El servidor (`finalizarVisitaLote`) no valida las unidades: la restricción es solo de la PWA.
- **Tiempo de instalación de la unidad** (`minutosInstalandoUnidad`, `reportes.service.ts`): desde que se creó la hoja hasta la firma del POST, o hasta la del PRE si el POST no se firmó. Con un POST pendiente cuenta solo hasta la firma del PRE; si el POST se termina días después, el tiempo **se infla** con toda la espera.

## Qué haría falta

1. **Pausa en la hoja.** La hoja sigue en `pendiente_post` (PRE, paso intermedio y fotos intactos), con una marca de pausa: motivo, hora de inicio y hora de fin al reanudar.
2. **Tiempo de instalación** = (creación de la hoja → firma) **menos el tiempo pausado**. Si está pausada, cuenta hasta el momento de la pausa.
3. **Cerrar la visita sin esa unidad.** La unidad pausada cuenta como resuelta (igual que una "no encontrada") en la PWA (`todasResueltas`) y en `cerrarVisitaLoteSiTodoResuelto`. El tiempo en el lugar se corta en ese momento.
4. **Retomar.** Coordinación reprograma y la unidad aparece en la agenda con "Continuar POST" (la hoja ya existe), no con "Empezar". El técnico marca llegada ("Ya estoy en el lugar" o "Salí") y se abre una visita nueva.
5. **Aviso a coordinación y a Odoo** (dos niveles):
   - **Completo (recomendado):** reutilizar `SubtareaIncidencia` (el campo `tipo` ya existe, hoy solo `no_encontrada`) con un tipo nuevo `post_pendiente`. La subtarea de Odoo queda "En espera", coordinación recibe la actividad y reprograma desde el panel existente.
   - **Mínimo:** solo la pausa en la hoja; coordinación reprograma a mano en Odoo y se entera por una etiqueta en el panel.

## A resolver

- **Mensaje al cliente:** "Finalizar visita" avisa por Telegram que el trabajo terminó; con una unidad pausada ese texto es incorrecto y hay que adaptarlo.
- **Hojas olvidadas:** si nadie reprograma, la hoja queda en `pendiente_post` indefinidamente. Hace falta un listado con antigüedad.
- **Equipo ya instalado:** el paso intermedio está hecho, así que el panel tiene que dejar claro que la hoja no está completa (la lista de altas ya filtra por `completo`).
- **Cambio de técnico:** hoy solo existe en cambios de equipo. Decidir si otro técnico puede retomar la unidad.
- **Reportes:** ¿mostrar el tiempo pausado como dato aparte?

## Estimación

Un sprint para el mínimo y otro para el flujo completo. Toca la API (modelo, cálculo de tiempos, incidencias, Odoo), la PWA (acción en el POST y estados de la agenda) y el panel (etiqueta, listado y reportes).

## Decisiones pendientes

1. ¿Mínimo primero o directamente el completo?
2. ¿El tiempo pausado se muestra en los reportes?
3. ¿Qué mensaje recibe el cliente cuando la visita se cierra con una unidad pendiente?
4. ¿La retoma es siempre del mismo técnico?
