// Service worker mínimo: solo existe para que el panel sea instalable (Android/Chrome lo pide). No cachea nada:
// el panel siempre necesita datos en vivo, y así no hay riesgo de mostrar una versión vieja tras un deploy.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
