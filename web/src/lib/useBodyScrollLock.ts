import { useEffect } from 'react';

// Mientras una hoja/modal está abierto, la página de atrás no se desplaza: solo el contenido del propio panel.
// Contador compartido para que dos hojas apiladas (ej. tarea + subtarea) no se pisen al cerrar la primera.
let locks = 0;
let previo = '';

// `soloMovil`: para paneles que en escritorio son una columna lateral (no un modal) y no deben bloquear la página.
export function useBodyScrollLock(active = true, soloMovil = false) {
  useEffect(() => {
    if (!active) return;
    if (soloMovil && !window.matchMedia('(max-width: 1023px)').matches) return;
    if (locks === 0) {
      previo = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    locks += 1;
    return () => {
      locks -= 1;
      if (locks === 0) document.body.style.overflow = previo;
    };
  }, [active, soloMovil]);
}
