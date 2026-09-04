# PWA vs APK — Análisis para Hoja de Conformidad WARA

Fecha: 2026-09-02
Alcance: evaluar si conviene migrar la app de técnicos (`mobile/`) de APK nativo (Expo/EAS) a una PWA, motivado por la fricción de compilar/distribuir el APK.

## 1. Resumen ejecutivo

**Confirmado: la flota de técnicos es 100% Android → recomendación es migrar a PWA.** Con iPhones en el medio, el argumento se debilitaba (Background Sync y Wake Lock son poco confiables en Safari); sin ellos, prácticamente todos los riesgos de la tabla de la sección 4 bajan a "bajo", porque Chrome Android soporta bien captura de cámara/video, Background Sync, Wake Lock y Web Share.

`mobile/` ya declara `react-native-web` como dependencia y tiene un script `web` (`expo start --web`) — no hace falta reescribir la app de cero: se puede exportar el mismo código Expo Router a web (`expo export -p web`) y envolverlo con manifest + service worker. Ese es el camino de menor esfuerzo (sección 6, camino C) y el punto de partida sugerido, no una reescritura total.

Además, ya existe en el repo un prototipo standalone (`hoja-de-conformidad-wara_1.html`) que resuelve en HTML puro las dos partes más "nativas" del flujo — captura de foto (`input capture=environment`) y firma táctil (canvas) — lo cual es evidencia de que el flujo funciona en navegador, no solo teoría.

El motivo real por el que hoy se sufre "el tema de compilar" no es solo EAS/Gradle: hay bugs de producción documentados en `fixes.md` (la app se reinicia al sacar fotos en Android, pantalla no baja el brillo) que están directamente relacionados con el modelo de proceso nativo de Android y presión de memoria (`largeHeap: true` ya está activado en `app.json` como parche). Una PWA no garantiza que esto desaparezca, pero cambia la clase de problema — y de paso elimina por completo la fricción de firmar/distribuir un APK en cada release, que era el disparador de esta pregunta.

## 2. Estructura del proyecto (monorepo pnpm)

```
C:\h
├── api/         Node.js/Express — REST API, hosteado en Render
├── mobile/      Expo Router (React Native) — app de técnicos, hoy compila a APK vía EAS
├── web/         Next.js 16 (App Router) — panel administrativo, hosteado en Vercel
├── packages/
│   └── shared/  tipos y lógica compartida (Equipo, Checklist, ConformidadRecord...)
└── hoja-de-conformidad-wara_1.html   prototipo HTML standalone (pre-Expo)
```

Backend: MongoDB Atlas (metadatos) + Cloudflare R2 (fotos/firmas, zero egress). Autenticación con Firebase.

## 3. Cómo se compila hoy el APK

- Stack: **Expo SDK 54 + Expo Router**, no Capacitor ni Cordova.
- Build: `expo run:android` local o **EAS Build** (`extra.eas.projectId` en `mobile/app.json`) para generar el APK firmado.
- `mobile/AGENTS.md` advierte explícitamente: "Expo HAS CHANGED — leer docs versionadas v57.0.0 antes de escribir código", señal de que el equipo ya se topó con breaking changes de Expo que complican mantener el pipeline de build.
- Distribución del APK: manual/EAS, no queda claro si pasa por Play Store — si es sideload, cada técnico necesita reinstalar manualmente en cada release.

## 4. Funcionalidades nativas usadas y su equivalente web

| Función | Librería nativa hoy | Equivalente PWA/web | Riesgo al migrar |
|---|---|---|---|
| Cámara (foto obligatoria, sin galería) | `expo-image-picker` (cameraPermission) | `<input type="file" accept="image/*" capture="environment">` | Bajo — flota 100% Android/Chrome, y el prototipo HTML ya lo usa (`renderPhotoGridHTML`) |
| Video (12ª foto del POST) | `expo-image-picker` / cámara nativa | `<input capture accept="video/*">` o `MediaRecorder` | Bajo — Chrome Android lo soporta bien; ya no aplica el riesgo de iOS Safari |
| Firma táctil | `react-native-signature-canvas` | Canvas + Pointer Events | Bajo — ya prototipado (`initSignaturePad`) |
| Almacenamiento offline | `expo-sqlite` + `async-storage` | IndexedDB (ej. Dexie) | Medio — IndexedDB es robusto, pero hay que reimplementar las queries que hoy usan `expo-sqlite` |
| Detección de red / cola de sync | `@react-native-community/netinfo` | `navigator.onLine` + eventos `online`/`offline` + Background Sync API | Bajo — Chrome Android soporta bien Background Sync; ya no aplica el riesgo de iOS Safari |
| Generación de PDF | `expo-print` | Reusar el exportador PDF que ya existe en el panel Next.js, o `window.print()` / jsPDF | Bajo — ya hay un exportador de PDF en `web/` |
| Compartir | `expo-sharing` | Web Share API (`navigator.share`) | Bajo en Android Chrome |
| Mantener pantalla encendida | `expo-keep-awake` | Screen Wake Lock API | Bajo — bien soportado en Chrome Android |
| Auth | `@firebase/auth` (SDK nativo) | `firebase/auth` (SDK web) | Nulo — mismo SDK, ya se usa en `web/` |
| Instalación/updates | APK firmado + EAS / sideload | "Agregar a pantalla de inicio" + service worker (updates instantáneos, sin recompilar) | Elimina el pain point de compilar |

Con la flota confirmada 100% Android, el único riesgo que queda en "Medio" es la migración de `expo-sqlite` a IndexedDB — un tema de esfuerzo de reescritura, no de compatibilidad de plataforma.

## 5. Bugs actuales que motivan repensar el modelo nativo

De `fixes.md`:
- "Al sacar fotos en la app EXPO de android, se reinicia la aplicación, haciendo que no se pueda avanzar" — bug de producción, probablemente el proceso de Android mata la Activity/JS runtime al abrir la cámara del sistema bajo presión de memoria.
- Ya hay un parche defensivo en `app.json`: `expo-build-properties` → `android.largeHeap: true`, lo cual confirma que el equipo ya identificó memoria como la causa raíz, no solo un bug de navegación.
- "La pantalla queda encendida... no tiene cooldown" — gestión de wake lock mal implementada.
- Requisito de negocio (`futurasReleases.md`): mínimo 7–12 fotos + 1 video obligatorios por hoja — esto es lo que genera la presión de memoria (imágenes en alta resolución retenidas en estado antes de subir).

Estos bugs son de la capa de integración nativa (RN ↔ Android), no del negocio. Una PWA no los hereda automáticamente porque el navegador gestiona la memoria de forma distinta (cada foto capturada vía `<input capture>` entra como Blob/File, no necesita mantenerse toda la sesión en memoria de la misma manera), pero **el requisito de negocio de 7-12 fotos + video en alta resolución sigue siendo el riesgo de fondo en cualquier plataforma** y hay que diseñarlo con compresión progresiva (ya existe: JPEG 75%, máx 1920x1080 según `arquitectura.md`).

## 6. Caminos posibles

### A. Seguir 100% nativo (status quo)
- Mejor acceso a cámara/SQLite/impresión nativos, pero mantiene el costo de compilar+firmar+distribuir cada release y no resuelve los bugs de memoria de raíz. Con la flota 100% Android, este costo ya no se justifica frente a la opción C.

### B. PWA completa, descartando Expo/React Native en mobile
- Reescritura total del cliente móvil. Alto costo, no se justifica dado que ya existe código funcionando y un prototipo web-first previo.

### C. Híbrido — exportar el Expo Router actual a Web y empaquetarlo como PWA (recomendado — camino a seguir)
- `mobile/` ya tiene `react-native-web` y el script `web`. Expo Router soporta apps "universales" (mismo código para iOS/Android/Web).
- Pasos de spike (bajo costo, no destructivo):
  1. `expo export -p web` en `mobile/` para generar el bundle web.
  2. Agregar `manifest.json` + `service worker` (Expo tiene soporte experimental para PWA; si no alcanza, usar Workbox).
  3. Reemplazar los módulos nativos incompatibles con web (`expo-sqlite`→ ya tiene fallback web con `expo-sqlite/next` limitado, o migrar esa capa a IndexedDB; `expo-print`/`expo-sharing` → equivalentes web de la tabla arriba).
  4. Probar el flujo completo de captura de 7-12 fotos + firma + sync offline en un Android real de un técnico.
- Si el spike funciona, se mantiene UN solo código base para las tres superficies (Android, iOS opcional, Web/PWA), y "compilar" para distribuir deja de ser necesario para las actualizaciones del día a día — solo se toca cuando cambian permisos nativos o se agrega un plugin nuevo.

## 7. Preguntas abiertas antes de decidir (a validar con el equipo)

1. ~~¿Los técnicos usan solo Android, o también hay iPhones en la flota?~~ **Resuelto: 100% Android.** Esto despeja el mayor riesgo del camino C — Chrome Android soporta bien Background Sync, Wake Lock y captura de cámara/video.
2. **¿Cuán crítico es el modo verdaderamente offline (sin red por horas, en campo)?** IndexedDB + Service Worker cubre esto sin problema en Android; ya no hay que compensar debilidad de iOS.
3. **¿Distribución hoy es Play Store o sideload manual?** Si es sideload, el argumento a favor de PWA (cero fricción de update) es aún más fuerte.
4. **¿`expo-sqlite` en la capa `mobile/src/db/database.ts` tiene mucha lógica acoplada a SQL?** Si sí, migrar a IndexedDB es el ítem de mayor esfuerzo del spike — y con el riesgo de plataforma ya descartado, es la única incógnita real que queda antes de comprometerse al camino C.

## 8. Próximo paso sugerido

Correr el spike del camino C (punto 6) en un branch aislado: exportar `mobile/` a web, medir en un Android real si el flujo de 7-12 fotos + firma + PDF funciona sin el bug de reinicio, y comparar el tiempo de "build → dispositivo" contra el ciclo actual de EAS. Dado que la flota es 100% Android, este spike ya no es "para decidir si migrar" sino para validar el esfuerzo de la migración de `expo-sqlite` → IndexedDB antes de comprometerse. Vale la pena coordinar con el otro agente que está compilando el APK para no duplicar trabajo mientras se valida esto.
