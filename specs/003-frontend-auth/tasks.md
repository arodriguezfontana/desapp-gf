# Tasks: Frontend — Autenticación

**Feature**: `003-frontend-auth` | **Date**: 2026-09-16
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Instalar dependencias nuevas, limpiar el scaffold existente y dejar la
estructura de directorios alineada con la Constitución v1.7.0 antes de escribir
ningún archivo de negocio.

- [X] T001 Añadir dependencias a `frontend/package.json`: `react-router-dom ^7` en `dependencies`; `vitest`, `@vitest/coverage-v8`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom` en `devDependencies`; luego ejecutar `pnpm install` en `frontend/`.
- [X] T002 Eliminar `frontend/src/api/` (archivo `axios.ts` y `.gitkeep`) — el cliente pasa a `service/httpClient.ts` (R-006 del research.md).
- [X] T003 [P] Renombrar `frontend/src/services/` → `frontend/src/service/` (singular, según Constitución v1.7.0 §Technology Stack → Estructura).
- [X] T004 [P] Renombrar `frontend/src/layouts/` → `frontend/src/layout/` (singular).
- [X] T005 [P] Renombrar `frontend/src/context/` → `frontend/src/contexts/` (plural).
- [X] T006 [P] Eliminar `frontend/src/routes/` — la lógica de rutas pasa a `App.tsx`; `ProtectedRoute` va en `components/`. Eliminar `frontend/src/config/` — su contenido pasa a `service/` o `types/` según corresponda.
- [X] T007 [P] Crear `frontend/src/types/auth.types.ts` con las interfaces `RegisterRequestDto`, `LoginRequestDto`, `LoginResponseDto { accessToken: string; tokenType: 'Bearer'; expiresIn: number }`, `IssueApiKeyResponseDto { id: string; apiKey: string; createdAt: string }` y `ApiErrorDto { statusCode: number; message: string; error?: string; timestamp: string; path: string }` (del data-model.md).
- [X] T008 Actualizar `frontend/src/index.css`: reemplazar su contenido por `@import "tailwindcss";` seguido de bloque `@theme { --color-background: #f5fbef; --color-foreground: #443545; --color-primary: #2a6041; --color-secondary: #6ab547; --color-accent: #fb8b23; }` (R-001, Tailwind v4).
- [X] T009 [P] Simplificar `frontend/tailwind.config.js` para que solo declare `content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"]` y `plugins: []`; eliminar `theme.extend` (los tokens de color ya viven en `index.css @theme`).
- [X] T010 Crear `frontend/vitest.config.ts`: entorno `jsdom`, `setupFiles: ['./test/setup.ts']`, `exclude: ['test/**']`, `coverage` con provider `v8`.
- [X] T011 Crear `frontend/vitest.integration.config.ts`: entorno `node`, `globalSetup: ['./test/setup/global-setup.ts']`, `globalTeardown: ['./test/setup/global-teardown.ts']`, `include: ['test/**/*.spec.ts']`.
- [X] T012 Crear `frontend/test/setup.ts` con `import '@testing-library/jest-dom'` (activa los matchers de jest-dom en Vitest).
- [X] T013 Actualizar `frontend/package.json` scripts: añadir `"test:unit": "vitest run --reporter=verbose"`, `"test:integration": "vitest run --reporter=verbose --config vitest.integration.config.ts"`, `"test": "vitest"`.
- [X] T014 Actualizar `frontend/eslint.config.js`: añadir al array de `defineConfig` un objeto `{ files: ['src/components/**/*.{ts,tsx}', 'src/pages/**/*.{ts,tsx}', 'src/layout/**/*.{ts,tsx}'], rules: { 'no-restricted-imports': ['error', { paths: [{ name: 'axios', message: 'Usar httpClient de service/' }] }], 'no-restricted-globals': ['error', { name: 'fetch', message: 'Usar httpClient de service/' }] } }` (R-007).
- [X] T015 [P] Actualizar `frontend/.env.example`: reemplazar `VITE_API_URL` por `VITE_API_BASE_URL=http://localhost:3000`; actualizar `frontend/.env` con el mismo nombre de variable.

**Checkpoint**: `pnpm install` y `pnpm lint` pasan sin errores. Estructura de directorios coincide con el plan.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implementar la capa de `service/`, `contexts/` y `hooks/` — el corazón
del sistema de sesión — y el esqueleto de rutas con `App.tsx`. Ninguna User Story puede
comenzar hasta que esta fase esté completa.

- [X] T016 Crear `frontend/src/service/authStorage.ts`: exportar constante `AUTH_TOKEN_KEY = 'auth_token'` y funciones `getToken(): string | null`, `setToken(token: string): void`, `clearToken(): void`, que leen/escriben/borran `localStorage[AUTH_TOKEN_KEY]`.
- [X] T017 Crear `frontend/src/service/httpClient.ts`: exportar `httpEvents = new EventTarget()` y `httpClient` con métodos `get<T>(url: string, options?): Promise<T>` y `post<T>(url: string, body: unknown, options?): Promise<T>`. La base URL se lee de `import.meta.env.VITE_API_BASE_URL`. Para peticiones autenticadas: incluir header `Authorization: Bearer <token>` obtenido de `authStorage.getToken()`. Ante respuesta 401: llamar `authStorage.clearToken()` y despachar `httpEvents.dispatchEvent(new Event('unauthorized'))`. Ante error HTTP: lanzar error con `{ statusCode, message }` del cuerpo JSON.
- [X] T018 Crear `frontend/src/service/authService.ts`: exportar `register(email: string, password: string): Promise<void>` (POST `/auth/register`, lanza con `message` del backend si error), `login(email: string, password: string): Promise<LoginResponseDto>` (POST `/auth/login`), `generateApiKey(): Promise<IssueApiKeyResponseDto>` (POST `/auth/api-key`, usa token de authStorage).
- [X] T019 Crear `frontend/src/contexts/AuthContext.tsx`: `AuthContext` con `{ isAuthenticated: boolean; login(token: string): void; logout(): void }`. `isAuthenticated` inicializado como `authStorage.getToken() !== null`. `login` llama `authStorage.setToken(token)` y actualiza el estado. `logout` llama `authStorage.clearToken()` y actualiza el estado. En `useEffect`: suscribirse a `httpEvents 'unauthorized'` → llamar `logout()` internamente (solo limpia token + estado, sin `navigate`).
- [X] T020 Crear `frontend/src/hooks/useAuth.ts`: hook que retorna `useContext(AuthContext)` con validación de contexto.
- [X] T021 Crear `frontend/src/components/ProtectedRoute.tsx`: importa `useAuth()` y `<Navigate>` de react-router-dom. Si `isAuthenticated === false` → `<Navigate to="/login" replace />`. Si `true` → `<Outlet />`.
- [X] T022 Reescribir `frontend/src/App.tsx`: crear el router con `createBrowserRouter` con rutas: `/` → redirect a `/login`; `/register` → `<RegisterPage>` (pública, si ya hay sesión redirige a `/home`); `/login` → `<LoginPage>` (pública, si ya hay sesión redirige a `/home`); `/` envuelto en `<ProtectedRoute>` con `<AppLayout>` como outlet: `/home` → `<HomePage>`, `/account` → `<AccountPage>`. Envolver todo el árbol con `<AuthProvider>` y `<RouterProvider>`.
- [X] T023 Crear `frontend/test/setup/global-setup.ts`: levantar PostgreSQL efímero con `@testcontainers/postgresql`; arrancar el proceso NestJS (`node dist/main`) apuntando a esa base vía `DATABASE_URL`; esperar health-check GET `/health` hasta 200; escribir la URL del backend en `process.env.VITE_TEST_API_URL`.
- [X] T024 Crear `frontend/test/setup/global-teardown.ts`: detener el proceso NestJS y destruir el contenedor de PostgreSQL.

**Checkpoint**: `pnpm build` pasa sin errores. La app arranca en dev, muestra la pantalla de login y redirige a `/login` al intentar acceder a `/home`. El global-setup de tests levanta el backend sin errores (verificar con un test de smoke mínimo).

---

## Phase 3: User Story 1 — Registro de cuenta nueva (Priority: P1) 🎯 MVP

**Goal**: El usuario puede registrarse desde `/register`, el backend valida, y en caso
de éxito es redirigido a `/login`. Los errores del backend se muestran textualmente.

**Independent Test**: Abrir `/register` → llenar email nuevo + contraseña válida →
enviar → verificar redirect a `/login`. Repetir con email duplicado → verificar que
aparece el mensaje de error exacto del backend.

### Tests for User Story 1 ⚠️ (escribir primero, deben fallar)

- [X] T025 [P] [US1] Crear test co-located `frontend/src/pages/RegisterPage.spec.tsx`: test de componente con RTL+Vitest — mockear `authService.register` (no se llama al backend) — verificar: (a) formulario renderizado con campos email y password; (b) al enviar con datos válidos llama a `register` y navega a `/login`; (c) al recibir error del mock muestra el mensaje exacto; (d) botón deshabilitado mientras `isLoading = true`.
- [X] T026 [P] [US1] Crear test de integración `frontend/test/auth.register.spec.ts` contra backend real (Testcontainers): llamar `authService.register(email, password)` directamente — verificar: (a) registro exitoso con email nuevo; (b) error con email duplicado incluye `message` del backend; (c) error con contraseña débil incluye `message` del backend.

### Implementation for User Story 1

- [X] T027 [P] [US1] Crear `frontend/src/layout/AppLayout.tsx`: layout de páginas protegidas con header `bg-primary text-white`, nombre "DesApp" en `font-black uppercase` vinculado a `/home`, navegación a `/account` y botón "Cerrar sesión" que llama `useAuth().logout()`. Usar `<Outlet />` para el contenido. Tipografía pesada, sin borde inferior redondeado (estilo deportivo R-008).
- [X] T028 [P] [US1] Crear `frontend/src/pages/RegisterPage.tsx`: formulario con campos `email` (type="email") y `password` (type="password"), estado controlado (`useState`). Validación cliente de `password`: al menos 8 caracteres, 1 mayúscula, 1 número, 1 especial — mostrar feedback inmediato bajo el campo antes de enviar. Al enviar: deshabilitar botón con texto "Registrando…" → llamar `authService.register` → éxito: `navigate('/login')` → error: mostrar `error.message` en banner. Link de "Ya tengo cuenta" a `/login`. Título `<title>Registrarse — DesApp</title>` (React 19 nativo). Estilo: `bg-background`, contenedor centrado, bordes definidos, `font-black uppercase` en el título.
- [X] T029 [US1] Verificar que T025 y T026 pasan en verde con `pnpm test:unit` y `pnpm test:integration`.

**Checkpoint**: User Story 1 completa. El flujo de registro funciona de extremo a extremo contra el backend real.

---

## Phase 4: User Story 2 — Inicio de sesión y gestión de sesión (Priority: P1)

**Goal**: El usuario puede autenticarse desde `/login`, el JWT se guarda, es redirigido
a `/home`. Un 401 en cualquier pantalla protegida redirige a `/login`. El logout borra
el JWT.

**Independent Test**: Login con credenciales válidas → JWT en localStorage → home visible.
Login con credenciales incorrectas → mensaje genérico. Acceder a `/home` sin JWT → redirect
a `/login`. Con JWT falso → request devuelve 401 → redirect a `/login`. Logout → JWT borrado → redirect.

### Tests for User Story 2 ⚠️ (escribir primero, deben fallar)

- [X] T030 [P] [US2] Crear test co-located `frontend/src/pages/LoginPage.spec.tsx`: con RTL+Vitest — mockear `authService.login` — verificar: (a) formulario renderizado; (b) login exitoso guarda token y navega a `/home`; (c) error 401 muestra mensaje genérico `"Credenciales inválidas."` independientemente del `message` del backend; (d) botón deshabilitado en carga.
- [X] T031 [P] [US2] Crear test co-located `frontend/src/components/ProtectedRoute.spec.tsx`: verificar que sin sesión redirige a `/login` y con sesión renderiza el outlet.
- [X] T032 [P] [US2] Crear test co-located `frontend/src/service/authStorage.spec.ts`: verificar `getToken/setToken/clearToken` lean/escriban/borren `localStorage['auth_token']` correctamente (usar `localStorage` simulado de jsdom).
- [X] T033 [P] [US2] Crear test de integración `frontend/test/auth.login.spec.ts` contra backend real: (a) `authService.login` con credenciales válidas devuelve `LoginResponseDto` con `accessToken`; (b) con credenciales inválidas lanza error con statusCode 401; (c) el token recibido puede usarse para llamar a un endpoint protegido.

### Implementation for User Story 2

- [X] T034 [P] [US2] Crear `frontend/src/pages/LoginPage.tsx`: formulario `email` + `password`, estado controlado. Al enviar: deshabilitar botón con "Ingresando…" → `authService.login(email, password)` → éxito: `useAuth().login(token)` + `navigate('/home')` → error: mostrar `"Credenciales inválidas."` (mensaje fijo, nunca el mensaje del backend). Link a `/register`. Título `<title>Iniciar sesión — DesApp</title>`. Mismo estilo deportivo de RegisterPage.
- [X] T035 [P] [US2] Crear `frontend/src/pages/HomePage.tsx`: pantalla protegida mínima. Título `<title>Inicio — DesApp</title>`. Contenido: encabezado de bienvenida en `font-black uppercase text-foreground`, texto de placeholder indicando funcionalidad futura. Sin peticiones al backend.
- [X] T036 [US2] Verificar que T030–T033 pasan en verde con `pnpm test:unit` y `pnpm test:integration`.

**Checkpoint**: US1 + US2 integradas. El flujo completo login → home funciona. El guard de 401 redirige automáticamente. Logout limpia la sesión.

---

## Phase 5: User Story 3 — Generación de ApiKey desde cuenta (Priority: P2)

**Goal**: El usuario autenticado puede generar una ApiKey desde `/account`. La clave
se muestra en texto plano por única vez en un modal. Si ya hay una clave activa, se
pide confirmación antes de invalidarla.

**Independent Test**: Autenticado → `/account` → "Generar ApiKey" → modal con clave visible
+ aviso. Segunda generación → diálogo de confirmación → confirmar → nueva clave. Cerrar modal
→ ninguna clave almacenada en localStorage ni en el estado de navegación.

### Tests for User Story 3 ⚠️ (escribir primero, deben fallar)

- [X] T037 [P] [US3] Crear test co-located `frontend/src/components/ApiKeyModal.spec.tsx`: con RTL — verificar: (a) muestra la clave; (b) muestra el aviso de no recuperación; (c) botón "Copiar" invoca `navigator.clipboard.writeText`; (d) botón "Cerrar" llama `onClose`.
- [X] T038 [P] [US3] Crear test co-located `frontend/src/components/ConfirmDialog.spec.tsx`: verificar: (a) renderiza el mensaje de advertencia de invalidación; (b) "Confirmar" llama `onConfirm`; (c) "Cancelar" llama `onCancel`.
- [X] T039 [P] [US3] Crear test co-located `frontend/src/pages/AccountPage.spec.tsx`: mockear `authService.generateApiKey` — verificar: (a) sin clave previa: clic → llamada a `generateApiKey` → modal visible; (b) con clave previa (simular estado): clic → `ConfirmDialog` visible; (c) cancelar confirmación: `generateApiKey` no se llama; (d) confirmar: `generateApiKey` se llama → modal con nueva clave; (e) cerrar modal: clave no accesible en DOM.
- [X] T040 [P] [US3] Crear test de integración `frontend/test/auth.api-key.spec.ts` contra backend real: (a) `authService.generateApiKey()` con JWT válido devuelve `IssueApiKeyResponseDto` con `id`, `apiKey` (prefijo `pmk_`), `createdAt`; (b) sin JWT devuelve error 401; (c) segunda llamada devuelve nueva clave con `id` distinto.

### Implementation for User Story 3

- [X] T041 [P] [US3] Crear `frontend/src/components/ConfirmDialog.tsx`: modal overlay con `bg-foreground/50`. Props: `onConfirm: () => void`, `onCancel: () => void`. Título `"¿Generar nueva ApiKey?"` (`font-black uppercase`). Cuerpo: aviso de invalidación de la clave anterior. Botones: "Cancelar" (outline `border-secondary text-secondary`) y "Confirmar" (`bg-accent text-white`).
- [X] T042 [P] [US3] Crear `frontend/src/components/ApiKeyModal.tsx`: modal overlay. Props: `apiKey: string`, `createdAt: string`, `onClose: () => void`. Aviso en banner (`bg-accent/10 border-accent`): `"Guardá esta clave ahora. No podrás volver a consultarla."`. Input `readonly` con la clave en `font-mono`. Botón "Copiar" que invoca `navigator.clipboard.writeText(apiKey)` y muestra texto `"¡Copiado!"` durante 2 segundos. Botón "Cerrar" que llama `onClose`.
- [X] T043 [US3] Crear `frontend/src/pages/AccountPage.tsx`: estado de pantalla usando la máquina de `ApiKeyPanelState` del data-model.md (`idle | confirming | generating | revealed | error`). Sección "Mi ApiKey": botón "Generar ApiKey" (`bg-accent text-white`). Al pulsar: si `phase === 'idle'` → verificar si hay clave activa (usar estado local booleano `hasActiveKey` inicializado en `false` y actualizado tras cada generación exitosa) → sin clave: pasar a `generating` directamente → con clave: pasar a `confirming`. En `confirming`: renderizar `<ConfirmDialog>`. En `generating`: llamar `authService.generateApiKey()` → éxito: estado `revealed` con la clave → error: estado `error` con `message`. En `revealed`: renderizar `<ApiKeyModal>` → onClose: volver a `idle` (la clave desaparece). Título `<title>Mi cuenta — DesApp</title>`.
- [X] T044 [US3] Verificar que T037–T040 pasan en verde con `pnpm test:unit` y `pnpm test:integration`.

**Checkpoint**: Las 3 User Stories funcionan de extremo a extremo. La ApiKey no persiste tras cerrar el modal.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verificar el build de producción, la experiencia responsive, la accesibilidad básica y el lint.

- [X] T045 [P] Verificar que `pnpm lint` pasa sin errores — en particular que los overrides de ESLint de T014 rechazan imports de axios y calls a `fetch` en `components/`, `pages/` y `layout/`.
- [X] T046 [P] Verificar que `pnpm build` (TypeScript + Vite) termina sin errores ni warnings tipados.
- [X] T047 [P] Revisar responsive en `RegisterPage`, `LoginPage`, `AccountPage` y `AppLayout`: usar breakpoints Tailwind (`sm:`, `md:`) para que los formularios y el header se adapten a pantallas móviles y de escritorio sin JS adicional (R-008).
- [X] T048 [P] Añadir atributos de accesibilidad básicos en los formularios: `label` vinculados a inputs vía `htmlFor`, `aria-live="polite"` en los banners de error, `aria-busy` en los botones mientras `isLoading = true`.
- [X] T049 Ejecutar la validación manual del [quickstart.md](./quickstart.md) completo (Validaciones 1 a 4) y documentar resultado.


**Checkpoint Final**: `pnpm lint`, `pnpm test:unit`, `pnpm test:integration` y `pnpm build` pasan todos en verde. La validación manual del quickstart completa sin observaciones.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — puede comenzar de inmediato.
- **Foundational (Phase 2)**: Depende de la compleción de la Phase 1. Bloquea todas las User Stories.
- **US1 (Phase 3)**: Depende de la Phase 2.
- **US2 (Phase 4)**: Depende de la Phase 2. Independiente de US1 (usa las mismas fundaciones).
- **US3 (Phase 5)**: Depende de US2 (necesita el JWT y el flujo de sesión activo para llamar al endpoint protegido).
- **Polish (Phase 6)**: Depende de que las 3 US estén completas.

### User Story Dependencies

- **US1 (Registro)**: solo necesita la Foundational phase.
- **US2 (Login + sesión)**: solo necesita la Foundational phase; puede hacerse en paralelo con US1.
- **US3 (ApiKey)**: necesita US2 completa (el token de login es precondición de `POST /auth/api-key`).

### Within Each User Story

- Tests primero → deben fallar antes de la implementación.
- Componentes reutilizables (`ConfirmDialog`, `ApiKeyModal`) antes de las páginas que los usan.
- La página completa antes de los tests e2e de esa historia.

### Parallel Opportunities

- T003, T004, T005, T006, T007 pueden ejecutarse en paralelo (archivos/directorios distintos).
- T016, T017, T018, T019, T020, T021 pueden paralelizarse por pares que no se importan entre sí.
- T025 (test componente) y T026 (test integración) de US1 son paralelos.
- T027 (AppLayout) y T028 (RegisterPage) son paralelos.
- T030, T031, T032, T033 de US2 son paralelos.
- T037, T038, T039, T040 de US3 son paralelos.
- T041 y T042 son paralelos.

---

## Parallel Example: User Story 3

```bash
# Lanzar todos los tests de US3 juntos (deben fallar primero):
T037: ApiKeyModal.spec.tsx
T038: ConfirmDialog.spec.tsx
T039: AccountPage.spec.tsx
T040: auth.api-key.spec.ts (contra backend real)

# Lanzar implementación de componentes en paralelo:
T041: ConfirmDialog.tsx
T042: ApiKeyModal.tsx
# Luego (depende de T041 y T042):
T043: AccountPage.tsx
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational
3. Completar Phase 3: US1 (Registro)
4. Completar Phase 4: US2 (Login + sesión)
5. **STOP y VALIDAR**: flujo registro → login → home → logout funcionando de extremo a extremo
6. Deploy / demo de MVP

### Incremental Delivery

1. Setup + Foundational → base lista
2. US1 → registro funcional → demostrable
3. US2 → autenticación completa → **MVP entregable**
4. US3 → gestión de ApiKey → feature completa
5. Polish → lista para integrar a main

### Parallel Team Strategy

Con 2 desarrolladores:
1. Ambos completan Phase 1 (Setup) juntos — es rápida
2. Phase 2 (Foundational) juntos — servicio base compartido
3. Dev A: US1 (Registro); Dev B: US2 (Login + sesión) — paralelas desde la Foundational
4. Juntos: US3 (requiere US2)
5. Juntos: Polish

---

## Notes

- `[P]` = tareas ejecutables en paralelo (archivos diferentes, sin dependencias entre sí)
- `[US1/2/3]` = etiqueta de trazabilidad hacia la User Story del spec.md
- TDD es obligatorio en esta feature: tests primero, verificar que fallan, luego implementar
- La ApiKey en `revealed` NO debe escribirse en `localStorage`, `sessionStorage` ni en el router state — solo en `useState` local del componente que se destruye al cerrar el modal
- Hacer commit después de cada checkpoint o grupo lógico de tareas

