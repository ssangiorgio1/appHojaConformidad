# 📐 Arquitectura del Sistema: Hojas de Conformidad Digitales (Offline-First)

## 🎯 Objetivo
Proveer una solución integral para la digitalización, firma y registro fotográfico de hojas de conformidad técnica en campo (con soporte offline para zonas sin cobertura móvil), permitiendo la sincronización automática y la consulta administrativa mediante un panel web centralizado.

---

## 🏗️ Diagrama de Arquitectura General
┌────────────────────────────────────────────────────────┐
│                   CLIENTES FRONTEND                    │
│                                                        │
│  [ App Móvil - React Native / Expo ]                   │  [ Panel Web - Next.js ]
│  • Modo Offline (SQLite / Queue)                      │  • Consulta administrativa
│  • Firma táctil y captura de fotos                     │  • Visualización y PDFs
│  • Despliegue: APK / Expo EAS                          │  • Despliegue: Vercel
└───────────────────────────┬────────────────────────────┘
│ (HTTPS REST API / JWT)
▼
┌────────────────────────────────────────────────────────┐
│                    BACKEND CENTRAL                     │
│                                                        │
│  [ API REST - Node.js / Express ]                      │
│  • Hosteado en: Render                                 │
│  • Autenticación y control de roles                    │
│  • Generación de URLs pre-firmadas para R2             │
│  • Procesamiento y validación de conformidades         │
└───────────────┬────────────────────────┬───────────────┘
│                        │
▼                        ▼
┌──────────────────────────────┐  ┌──────────────────────┐
│        BASE DE DATOS         │  │   STORAGE BINARIO    │
│                              │  │                      │
│  [ MongoDB / Mongo Atlas ]   │  │  [ Cloudflare R2 ]   │
│  • Metadatos de conformidad  │  │  • Fotos de campo    │
│  • URLs de archivos y firmas │  │  • Firmas en PNG     │
│  • Índices por técnico/IMEI  │  │  • Zero egress fees  │
└──────────────────────────────┘  └──────────────────────┘

---

## 📱 1. App Móvil (React Native + Expo)

### Stack y Librerías Clave
* **Framework:** React Native con Expo SDK.
* **Almacenamiento Local (Offline):** `expo-sqlite` o `@react-native-async-storage/async-storage`.
* **Detección de Red:** `@react-native-community/netinfo`.
* **Firma Digital:** `react-native-signature-canvas`.
* **Cámara y Fotos:** `expo-image-picker` / `expo-camera` junto con `expo-image-manipulator` (para comprimir imágenes antes de guardarlas localmente).

### Flujo de Trabajo Offline-First
1. **Captura:** El técnico completa el formulario, dibuja la firma y toma las fotos de la instalación.
2. **Persistencia Local:** La aplicación guarda el payload completo (con las rutas locales de las fotos) en la base de datos local con estado `status: 'PENDING_SYNC'`.
3. **Listener de Red:** `NetInfo` detecta cuando el dispositivo recupera conexión 4G o WiFi.
4. **Sincronización en 2 Fases:**
   * **Fase 1 (Archivos):** La app solicita URLs prefirmadas a la API y sube los binarios directamente a Cloudflare R2.
   * **Fase 2 (Datos):** La app envía el JSON con los datos y las URLs remotas a `POST /api/conformidades`. Al recibir confirmación `201 Created`, marca el registro local como `SYNCED`.

---

## 🌐 2. Panel Web Administrativo (Next.js)

### Stack y Hosting
* **Framework:** Next.js (App Router) + Tailwind CSS + Lucide Icons.
* **Hosting:** Vercel.
* **Componentes Principales:**
  * Tabla paginada (200 registros por hoja) con filtros por técnico, fecha, estado e IMEI/ICC.
  * Visor modal de fotos y firma en alta resolución directo desde Cloudflare R2.
  * Exportador de reportes en PDF de la hoja de conformidad.

---

## ⚙️ 3. Backend & API (Node.js / Express)

### Hosting
* **Plataforma:** Render (Web Service).

### Endpoints Principales

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Autenticación de técnicos y administradores. |
| `POST` | `/api/uploads/presigned-url` | Genera URLs prefirmadas de subida directa a R2. |
| `POST` | `/api/conformidades` | Recibe y persiste la hoja de conformidad completa. |
| `GET` | `/api/conformidades` | Listado paginado y filtrable para el panel web. |
| `GET` | `/api/conformidades/:id` | Detalle individual de una conformidad. |

---

## 🗄️ 4. Modelo de Datos (MongoDB)

### Colección: `conformidades`

```json
{
  "_id": ObjectId("66cb3f10a1b2c3d4e5f60001"),
  "codigo_acta": "CONF-2026-0825-01",
  "fecha_instalacion": ISODate("2026-08-25T14:30:00Z"),
  "tecnico": {
    "usuario_id": ObjectId("66cb3e00a1b2c3d4e5f60000"),
    "nombre": "Joaquín",
    "legajo": "TEC-402"
  },
  "equipo": {
    "imei": "356890123456789",
    "modelo": "Teltonika FMB920",
    "patente_vehiculo": "AF123JK"
  },
  "sim": {
    "icc": "8954070000123456789",
    "linea": "2615551234"
  },
  "observaciones": "Instalación completada detrás del tablero principal.",
  "firma": {
    "firmante_nombre": "Carlos Gómez",
    "firmante_dni": "32111222",
    "url": "[https://r2.midominio.com/firmas/2026/08/CONF-2026-0825-01_firma.png](https://r2.midominio.com/firmas/2026/08/CONF-2026-0825-01_firma.png)"
  },
  "fotos": [
    {
      "tipo": "UBICACION_EQUIPO",
      "url": "[https://r2.midominio.com/fotos/2026/08/CONF-2026-0825-01_foto_1.jpg](https://r2.midominio.com/fotos/2026/08/CONF-2026-0825-01_foto_1.jpg)"
    },
    {
      "tipo": "CONEXION_ELECTRICA",
      "url": "[https://r2.midominio.com/fotos/2026/08/CONF-2026-0825-01_foto_2.jpg](https://r2.midominio.com/fotos/2026/08/CONF-2026-0825-01_foto_2.jpg)"
    }
  ],
  "origen": "MOBILE_OFFLINE",
  "creado_el": ISODate("2026-08-25T14:30:00Z"),
  "sincronizado_el": ISODate("2026-08-25T15:10:20Z")
}

db.conformidades.createIndex({ "equipo.imei": 1 });
db.conformidades.createIndex({ "sim.icc": 1 });
db.conformidades.createIndex({ "fecha_instalacion": -1 });
db.conformidades.createIndex({ "tecnico.usuario_id": 1 });


🗂️ 5. Almacenamiento de Archivos (Cloudflare R2)
Estructura de Directorios:

firmas/{YYYY}/{MM}/{codigo_acta}_firma.png

fotos/{YYYY}/{MM}/{codigo_acta}_{timestamp}_{indice}.jpg

Políticas:

Compresión en cliente: JPEG calidad 75%, resolución máx 1920x1080 (peso promedio ~400-800 KB por foto).

CORS habilitado para peticiones PUT directas desde el cliente móvil.