# Graph Report - .  (2026-08-27)

## Corpus Check
- Corpus is ~48,745 words - fits in a single context window. You may not need a graph.

## Summary
- 764 nodes · 1342 edges · 84 communities (34 shown, 50 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.82)
- Token cost: 0 input · 505,235 output

## Community Hubs (Navigation)
- API Backend Core (Auth, Config, Server)
- Conformidad Domain Model & Print
- Mobile Sync & API Client
- Web Package Dependencies
- Mobile Conformidad Wizard UI
- API Dev Dependencies
- Mobile Expo App Config & Icons
- Web TypeScript Config
- API Runtime Dependencies
- Architecture & Project Docs
- Legacy HTML Prototype & Fix Notes
- Mobile Shared UI Components
- Web Dashboard Shell
- Web Conformidad Detail/List Pages
- Mobile Auth & Home Screens
- API TypeScript Config
- Mobile Record Viewer UI
- Web Usuario Management UI
- Web Usuario API & Types
- Mobile Package Scripts
- Web Auth Context & Firebase
- Mobile Local DB & Record Utils
- Mobile Auth Context & Firebase
- Shared Package TS Config
- Web Usuarios Management Page
- Web Dashboard KPIs
- Mobile Expo Asset/File Deps
- Shared Package Metadata
- Mobile Metro Bundler Config
- Mobile TypeScript Config
- API Express Type Augmentation
- Root Package Metadata
- Expo Splash Screen
- Expo Dependency
- Expo Constants Dependency
- Expo Crypto Dependency
- Expo Dev Client Dependency
- Expo Image Manipulator Dependency
- Expo Image Picker Dependency
- Expo Linking Dependency
- Expo Print Dependency
- Expo Router Dependency
- Expo Sharing Dependency
- Expo Splash Screen Dependency
- Expo SQLite Dependency
- Expo Status Bar Dependency
- Firebase Auth Dependency
- Safe Area UX Issue
- React Dependency
- React Native Dependency
- Async Storage Dependency
- Safe Area Context Dependency
- React Native Screens Dependency
- Signature Canvas Dependency
- React Native SVG Dependency
- React Native WebView Dependency
- Wara Shared Package Dependency
- Firebase Auth RN Types
- Web Next.js Config
- Web PostCSS Config
- Fix: PRE/POST Discrepancies
- Fix: Login Forgot Password
- Fix: Remove Login Create Account
- Fix: Login UI
- Fix: Login Vulnerabilities
- Fix: Mi Perfil
- Future: Mandatory Fields
- Future: Odoo Clients Integration
- Future: Disconformity Signature
- Future: Signature Scroll Bug
- Future: Disconformity Metrics
- Future: Larger Observations Textarea
- Future: VisionBLO Integration
- Prototype IndexedDB Open
- Android Icon Background Asset
- Android Icon Monochrome Asset
- Apple Icon Asset
- Favicon Asset
- Mobile App Icon Asset
- Logo Wara Icon (GPS Pin) Asset
- Web Public Logo Asset
- Web Public Logo Icon Asset

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 17 edges
2. `colors` - 16 edges
3. `compilerOptions` - 16 edges
4. `compilerOptions` - 13 edges
5. `expo` - 13 edges
6. `useAuth()` - 13 edges
7. `Backend API REST (Node.js/Express, hosteado en Render)` - 12 edges
8. `useToast()` - 11 edges
9. `syncRecord()` - 10 edges
10. `ConformidadRecord` - 10 edges

## Surprising Connections (you probably didn't know these)
- `Wara - Manual de Marca (PDF, contenido no accesible: excede 20MB)` --conceptually_related_to--> `Panel Web Administrativo (Next.js, Vercel)`  [AMBIGUOUS]
  web/public/Wara-manual de marca (2) (1).pdf → arquitectura.md
- `newRecord() - crea registro de conformidad vacío (pre/post, equipo, status)` --semantically_similar_to--> `Esquema de colección MongoDB 'conformidades' (tecnico, equipo, sim, firma, fotos, origen)`  [INFERRED] [semantically similar]
  hoja-de-conformidad-wara_1.html → arquitectura.md
- `Fix: revisar safeArea de la app; actualmente no deja que la pantalla se apague` --semantically_similar_to--> `Rediseñar UI considerando safeArea Android/iOS, hora visible, y menú inferior (inicio, cuenta, hojas de conformidad)`  [INFERRED] [semantically similar]
  fixes.md → futurasReleases.md
- `Fix: mejorar la UI de la aplicación móvil` --conceptually_related_to--> `App Móvil (React Native / Expo, offline-first, APK/Expo EAS)`  [INFERRED]
  fixes.md → arquitectura.md
- `Fix: separar visibilidad de hojas de conformidad por técnico vs administrador` --conceptually_related_to--> `App Móvil (React Native / Expo, offline-first, APK/Expo EAS)`  [INFERRED]
  fixes.md → arquitectura.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Componentes que participan del flujo de sincronización offline-first en 2 fases** — arquitectura_app_movil, arquitectura_backend_api, arquitectura_cloudflare_r2, arquitectura_mongodb, arquitectura_offline_first_flow [EXTRACTED 1.00]
- **Conjunto de fixes solicitados para la sección de login** — fixes_login_quitar_crear_cuenta, fixes_login_vulnerabilidades, fixes_login_olvide_contrasena, fixes_login_ui [EXTRACTED 1.00]
- **Evolución del requisito de captura de fotos: de grilla libre en el prototipo a slots obligatorios guiados en futuras releases** — hoja_de_conformidad_wara_1_renderphotogridhtml, hoja_de_conformidad_wara_1_wirephotogrid, futurasreleases_requisitos_fotos_pre_post, futurasreleases_7_fotos_obligatorias [INFERRED 0.75]

## Communities (84 total, 50 thin omitted)

### Community 0 - "API Backend Core (Auth, Config, Server)"
Cohesion: 0.06
Nodes (49): main(), Role, VALID_ROLES, app, connectDB(), env, envSchema, parsed (+41 more)

### Community 1 - "Conformidad Domain Model & Print"
Cohesion: 0.05
Nodes (50): createConformidad, deleteConformidad, getConformidadById, listConformidades, patchConformidad, checklistFields, ChecklistSchema, Conformidad (+42 more)

### Community 2 - "Mobile Sync & API Client"
Cohesion: 0.08
Nodes (38): apiFetch(), ConformidadDoc, createConformidad(), CreateConformidadBody, createPresignedUploadUrl(), patchConformidad(), PatchConformidadBody, PresignedUrlRequest (+30 more)

### Community 3 - "Web Package Dependencies"
Cohesion: 0.05
Nodes (37): eslint-config-next, next, react-dom, tailwindcss, @tailwindcss/postcss, @types/react-dom, dependencies, firebase (+29 more)

### Community 4 - "Mobile Conformidad Wizard UI"
Cohesion: 0.14
Nodes (24): PostForm(), STEPS, styles, PreForm(), STEPS, styles, ChecklistEditor, ChecklistEditorHandle (+16 more)

### Community 5 - "API Dev Dependencies"
Cohesion: 0.07
Nodes (29): devDependencies, eslint, prettier, tsx, @types/cors, @types/express, @types/morgan, @types/node (+21 more)

### Community 6 - "Mobile Expo App Config & Icons"
Cohesion: 0.07
Nodes (27): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, predictiveBackGestureEnabled, expo (+19 more)

### Community 7 - "Web TypeScript Config"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts (+19 more)

### Community 8 - "API Runtime Dependencies"
Cohesion: 0.07
Nodes (27): dependencies, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, cors, dotenv, express, express-rate-limit, firebase-admin (+19 more)

### Community 9 - "Architecture & Project Docs"
Cohesion: 0.10
Nodes (27): App Móvil (React Native / Expo, offline-first, APK/Expo EAS), Backend API REST (Node.js/Express, hosteado en Render), Cloudflare R2 Storage (fotos y firmas, zero egress fees), Esquema de colección MongoDB 'conformidades' (tecnico, equipo, sim, firma, fotos, origen), POST /api/auth/login, POST /api/conformidades, GET /api/conformidades/:id, GET /api/conformidades (+19 more)

### Community 10 - "Legacy HTML Prototype & Fix Notes"
Cohesion: 0.11
Nodes (25): Fix: paso Control de Instalación obligatorio, con selección de box Sí/No, Fix: convertir textfields de 'Datos del Equipamiento' a checkbox, salvo señal modem, cant. satGPS, batería interna, alimentación externa, modelo e IMEI, Fix: en PRE y POST, solo permitir tomar foto con la cámara, no seleccionar de galería, Exigir exactamente 7 fotos guiadas paso a paso en PRE y POST, En Control de Instalación, reemplazar 'fotografía del vehículo' por 'Revisión de sensores (si corresponde)', Requisitos detallados de fotos: 7 obligatorias en PRE (matrícula, laterales, frente, interior, torpedo, extra) y 12 en POST (equipo, precintos, ubicación, ramales, accesorios, torpedo, odómetro, pánico, sensores x3, video), CHECKLIST_ITEMS - 13 ítems de revisión general del vehículo (luces, tablero, tapizado, etc.), dbDelete(id) - elimina un registro (+17 more)

### Community 11 - "Mobile Shared UI Components"
Cohesion: 0.11
Nodes (18): ConfirmContext, ConfirmContextValue, ConfirmOptions, ConfirmProvider(), PendingConfirm, styles, SignaturePad, SignaturePadHandle (+10 more)

### Community 12 - "Web Dashboard Shell"
Cohesion: 0.12
Nodes (12): AuthGuard(), NAV_ITEMS, roleLabel(), Sidebar(), base, IconDocument(), IconEdit(), IconGrid() (+4 more)

### Community 13 - "Web Conformidad Detail/List Pages"
Cohesion: 0.14
Nodes (17): checklistTone(), ConformidadDetailPage(), ESTADO_LABEL, ESTADO_TONE, ESTADO_LABEL, ESTADO_TONE, Badge(), BadgeTone (+9 more)

### Community 14 - "Mobile Auth & Home Screens"
Cohesion: 0.19
Nodes (13): Filter, Home(), styles, LoginScreen(), Mode, styles, Perfil(), styles (+5 more)

### Community 15 - "API TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule (+8 more)

### Community 16 - "Mobile Record Viewer UI"
Cohesion: 0.14
Nodes (13): RecordCard(), styles, Ver(), Badge(), badgeTextTone, badgeTone, ButtonVariant, SectionTitle() (+5 more)

### Community 17 - "Web Usuario Management UI"
Cohesion: 0.22
Nodes (9): LoginPage(), ROLE_OPTIONS, Button(), ButtonProps, IconLock(), IconX(), Input, ToggleSwitch() (+1 more)

### Community 18 - "Web Usuario API & Types"
Cohesion: 0.22
Nodes (14): apiFetch(), createUsuario(), resetUsuarioPassword(), updateMe(), updateUsuario(), UpdateUsuarioBody, ConformidadDoc, CreateUsuarioInput (+6 more)

### Community 19 - "Mobile Package Scripts"
Cohesion: 0.13
Nodes (14): devDependencies, @types/react, typescript, @types/react, typescript, main, name, private (+6 more)

### Community 20 - "Web Auth Context & Firebase"
Cohesion: 0.19
Nodes (11): manrope, metadata, AuthContext, AuthContextValue, AuthProvider(), friendlyApiError(), friendlyError(), getMe() (+3 more)

### Community 21 - "Mobile Local DB & Record Utils"
Cohesion: 0.25
Nodes (9): dbDelete(), dbGetAll(), openDB(), generateNumeroHoja(), resizeImageToDataUrl(), uuid(), newRecordFor(), pickUniqueNumeroHoja() (+1 more)

### Community 22 - "Mobile Auth Context & Firebase"
Cohesion: 0.23
Nodes (9): ApiError, getMe(), Usuario, AuthContext, AuthContextValue, AuthProvider(), friendlyApiError(), friendlyError() (+1 more)

### Community 23 - "Shared Package TS Config"
Cohesion: 0.17
Nodes (11): compilerOptions, declaration, esModuleInterop, module, moduleResolution, noEmit, skipLibCheck, strict (+3 more)

### Community 24 - "Web Usuarios Management Page"
Cohesion: 0.33
Nodes (10): ConformidadesPage(), DashboardPage(), initials(), ROLE_LABEL, UsuariosPage(), useAuth(), AddUsuarioPanel(), EditUsuarioPanel() (+2 more)

### Community 25 - "Web Dashboard KPIs"
Cohesion: 0.25
Nodes (7): ESTADO_LABEL, ESTADO_TONE, loadDashboard(), IconAlertTriangle(), IconCheck(), listConformidades(), queryString()

### Community 26 - "Mobile Expo Asset/File Deps"
Cohesion: 0.29
Nodes (7): expo-asset, expo-file-system, dependencies, expo-asset, expo-file-system, firebase, firebase

### Community 27 - "Shared Package Metadata"
Cohesion: 0.29
Nodes (6): main, name, private, type, types, version

### Community 28 - "Mobile Metro Bundler Config"
Cohesion: 0.33
Nodes (5): config, fs, { getDefaultConfig }, path, workspaceRoot

### Community 29 - "Mobile TypeScript Config"
Cohesion: 0.40
Nodes (4): compilerOptions, strict, extends, expo/tsconfig.base

### Community 30 - "API Express Type Augmentation"
Cohesion: 0.50
Nodes (3): AuthUser, Express, Request

### Community 31 - "Root Package Metadata"
Cohesion: 0.50
Nodes (3): name, private, version

## Ambiguous Edges - Review These
- `Panel Web Administrativo (Next.js, Vercel)` → `Wara - Manual de Marca (PDF, contenido no accesible: excede 20MB)`  [AMBIGUOUS]
  web/public/Wara-manual de marca (2) (1).pdf · relation: conceptually_related_to

## Knowledge Gaps
- **289 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+284 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **50 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Panel Web Administrativo (Next.js, Vercel)` and `Wara - Manual de Marca (PDF, contenido no accesible: excede 20MB)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `plugins` connect `Mobile Expo App Config & Icons` to `Mobile Auth & Home Screens`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `expo-router` connect `Mobile Auth & Home Screens` to `Mobile Record Viewer UI`, `Mobile Shared UI Components`, `Mobile Conformidad Wizard UI`, `Mobile Expo App Config & Icons`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _289 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `API Backend Core (Auth, Config, Server)` be split into smaller, more focused modules?**
  _Cohesion score 0.0579476861167002 - nodes in this community are weakly interconnected._
- **Should `Conformidad Domain Model & Print` be split into smaller, more focused modules?**
  _Cohesion score 0.05376972530683811 - nodes in this community are weakly interconnected._
- **Should `Mobile Sync & API Client` be split into smaller, more focused modules?**
  _Cohesion score 0.08416389811738649 - nodes in this community are weakly interconnected._