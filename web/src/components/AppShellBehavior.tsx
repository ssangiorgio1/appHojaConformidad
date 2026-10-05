'use client';

import { useEffect } from 'react';

// Hace que el panel se comporte como app instalada: registra el service worker (requisito de instalación) y
// bloquea el zoom por pellizco en iOS (Safari ignora user-scalable=no; el CSS cubre Android). El mapa de
// flota (Leaflet) queda exceptuado: ahí el zoom con dos dedos es parte de la interfaz.
export function AppShellBehavior() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    const bloquearZoom = (e: Event) => {
      if (!(e.target as Element | null)?.closest?.('.leaflet-container')) e.preventDefault();
    };
    document.addEventListener('gesturestart', bloquearZoom);
    document.addEventListener('gesturechange', bloquearZoom);
    return () => {
      document.removeEventListener('gesturestart', bloquearZoom);
      document.removeEventListener('gesturechange', bloquearZoom);
    };
  }, []);
  return null;
}
