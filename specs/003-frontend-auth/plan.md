# Implementation Plan: Frontend — Autenticación

**Branch**: `003-frontend-auth` | **Date**: 2026-09-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-frontend-auth/spec.md`

---

## Summary

Implementar el flujo completo de autenticación en el frontend (React 19 + Vite 8 +
Tailwind v4): pantalla de registro, pantalla de login, gestión de sesión con JWT en
localStorage, protección de rutas, logout automático ante 401, y pantalla de cuenta con
generación de ApiKey. El backend (features 001 y 002) ya está implementado y disponible.

La feature incluye:
- Reestructuración de `frontend/src/` a la organización por capa de la Constitución v1.7.0
- Cliente HTTP propio con manejo de 401 vía `EventTarget` (sin axios en componentes)
- Tests de componentes co-located (Vitest + RTL, sin backend)
- Tests de integración de `service/` contra backend NestJS real + Testcontainers
- Diseño visual inspirado en maquetación deportiva (bocajuniors.com.ar) con la paleta de 5 colores propia

---

## Technical Context

**Language/Version**: TypeScript 6.0 (modo `strict`)

**Primary Dependencies**:
- React 19, Vite 8, Tailwind CSS v4 (con plugin `@tailwindcss/vite`)
- `react-router-dom` v7 — enrutamiento con `createBrowserRouter`
- Vitest + `@testing-library/react` + `jsdom` — tests de componentes
- `@testcontainers/postgresql` — tests de integración de service/ contra backend real
- `fetch` nativo (no axios en componentes — garantizado por ESLint)

**Storage**: `localStorage` (clave `auth_token`) para persistencia del JWT entre recargas

**Testing**:
- `pnpm test:unit` — Vitest, entorno jsdom, sin backend, co-located
- `pnpm test:integration` — Vitest, `globalSetup` con Testcontainers + NestJS, en `frontend/test/`

**Target Platform**: SPA web, navegadores modernos (ES2022+), responsive con breakpoints Tailwind

**Project Type**: Web application (frontend SPA)

**Performance Goals**: TTFB < 1s en dev local; `vite build` sin errores ni warnings de TypeScript

**Constraints**:
- Sin axios en `components/`, `pages/`, `layout/` (ESLint `no-restricted-imports`)
- Sin `fetch` global en `components/`, `pages/`, `layout/` (ESLint `no-restricted-globals`)
- JWT no se persiste fuera de `localStorage` ni se loguea en consola
- ApiKey en texto plano no se persiste en ningún storage ni estado que sobreviva a la navegación

**Scale/Scope**: 4 rutas, 3 páginas de formulario/funcional + 1 home, ~15 archivos nuevos

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | ¿Aplica? | Estado | Notas |
|-----------|----------|--------|-------|
| **I. Arquitectura en capas** | Sí | ✅ PASS | `service/` ← `hooks/` + `contexts/` ← `components/`. Componentes NUNCA llaman a `service/` directamente. ESLint lo garantiza estáticamente. `httpClient.ts` usa `EventTarget` para no importar contexts desde service. |
| **II. Modelo de dominio rico** | No aplica | — | No hay lógica de negocio de valuación en esta feature. |
| **III. Cada validación en su nivel** | Sí | ✅ PASS | Validación cliente: feedback inmediato (contraseña). Validación definitiva: siempre del backend. El mensaje de error del backend se muestra textualmente (excepto login: mensaje genérico por seguridad). |
| **IV. Autenticación** | Sí | ✅ PASS | JWT guardado en localStorage. Riesgo XSS documentado y aceptado (ver Assumptions en spec). No se logguea el JWT. Token se descarta ante logout o 401. |
| **VII. Observabilidad** | Parcial | ✅ PASS | No aplica directamente al frontend en esta feature. |
| **VIII. Documentación API** | No aplica | — | Esta feature no agrega endpoints nuevos; consume los ya documentados con Swagger. |
| **IX. Testing** | Sí | ✅ PASS | Tests de componentes co-located sin backend. Tests de service/ contra backend real con Testcontainers. Sin mocks de la API ni de la base en los tests de integración (Constitución v1.7.0 Principio IX). |
| **X. Definición de terminado** | Sí | ✅ PASS | Criterios: tests unitarios + de componentes pasan, `vite build` sin errores, Swagger N/A (no hay endpoints nuevos), Postman N/A ídem. |
| **XI. Idioma** | Sí | ✅ PASS | Identificadores en inglés. Mensajes de UI y error en español. |
| **XII. Spec-first** | Sí | ✅ PASS | Spec 003-frontend-auth existe y está validada. |
| **Constitución v1.7.0 — Frontend layer rules** | Sí | ✅ PASS | Organización por capa en `frontend/src/`. Cliente de API en `service/`. Tests de service/ que usan backend real en `frontend/test/`, fuera de `src/`. |

**Constitution Check POST-DESIGN**: Todos los principios siguen en PASS tras la
definición de contratos (data-model.md, ui-contracts.md). El `EventTarget` como canal
de comunicación 401 preserva el grafo de dependencias sin crear un ciclo.

---

## Project Structure

### Documentation (this feature)

```text
specs/003-frontend-auth/
├── plan.md              ← Este archivo
├── research.md          ← Decisiones R-001 a R-009
├── data-model.md        ← Entidades de cliente, DTOs, estados UI, módulos service/
├── quickstart.md        ← Guía de validación manual y scripts
├── contracts/
│   └── ui-contracts.md  ← Contratos de rutas, páginas, componentes y AuthContext
└── tasks.md             ← Generado por /speckit-tasks (NO por /speckit-plan)
```

### Source Code (frontend/)

```text
frontend/
├── .env.example                    ← VITE_API_BASE_URL=http://localhost:3000
├── tailwind.config.js              ← simplificado: solo content + plugins
├── eslint.config.js                ← + override no-restricted-imports/globals
├── vitest.config.ts                ← nuevo
├── test/
│   ├── setup.ts                    ← importa @testing-library/jest-dom
│   └── setup/
│       ├── global-setup.ts         ← Testcontainers + NestJS
│       └── global-teardown.ts
└── src/
    ├── index.css                   ← @import "tailwindcss" + @theme (5 colores)
    ├── main.tsx                    ← RouterProvider + AuthProvider
    ├── App.tsx                     ← createBrowserRouter + rutas
    ├── service/
    │   ├── authStorage.ts          ← getToken / setToken / clearToken
    │   ├── httpClient.ts           ← fetch nativo + httpEvents EventTarget
    │   └── authService.ts          ← register / login / generateApiKey
    ├── contexts/
    │   └── AuthContext.tsx         ← isAuthenticated + login + logout
    ├── hooks/
    │   └── useAuth.ts              ← hook de acceso a AuthContext
    ├── components/
    │   ├── ProtectedRoute.tsx
    │   ├── ConfirmDialog.tsx
    │   └── ApiKeyModal.tsx
    ├── layout/
    │   └── AppLayout.tsx           ← header + Outlet
    ├── pages/
    │   ├── RegisterPage.tsx
    │   ├── LoginPage.tsx
    │   ├── HomePage.tsx
    │   └── AccountPage.tsx
    └── types/
        └── auth.types.ts           ← RegisterRequestDto, LoginResponseDto, IssueApiKeyResponseDto, ApiErrorDto
```

**Archivos a eliminar** (scaffold existente incompatible):
- `src/api/axios.ts` — reemplazado por `src/service/httpClient.ts`
- `src/api/.gitkeep`
- `src/services/` (vacío o con contenido a migrar)
- `src/layouts/` → renombrar a `src/layout/`
- `src/context/` → renombrar a `src/contexts/`
- `src/routes/` (vacío o con contenido a migrar a `App.tsx`)
- `src/config/` → contenido a migrar a `src/service/` o `src/types/`

**Structure Decision**: Web application con frontend SPA. El directorio de fuentes
es `frontend/src/` organizado por capa según la Constitución v1.7.0. Tests de componentes
co-located; tests de integración con backend real en `frontend/test/` fuera de `src/`.

---

## Complexity Tracking

> No hay violaciones del Constitution Check. Esta sección no aplica.

---

## Appendix: Dependency Additions

Las siguientes dependencias se añaden a `frontend/package.json`:

### dependencies
```json
{
  "react-router-dom": "^7.0.0"
}
```

### devDependencies
```json
{
  "@testing-library/jest-dom": "^6.x",
  "@testing-library/react": "^16.x",
  "@testing-library/user-event": "^14.x",
  "@vitest/coverage-v8": "^3.x",
  "jsdom": "^26.x",
  "vitest": "^3.x"
}
```

> `@testcontainers/postgresql` ya está disponible en el workspace de pnpm del monorepo
> (backend ya lo usa); se referencia desde `frontend/test/setup/` sin necesidad de
> reinstalarlo si el workspace lo comparte.

---

## Appendix: Paleta de colores (Tailwind v4 @theme)

```css
/* frontend/src/index.css */
@import "tailwindcss";

@theme {
  --color-background: #f5fbef;
  --color-foreground: #443545;
  --color-primary:    #2a6041;
  --color-secondary:  #6ab547;
  --color-accent:     #fb8b23;
}
```

Clases generadas: `bg-primary`, `text-foreground`, `border-secondary`, `bg-accent`,
`bg-background`, etc. Errores usan `text-red-600` / `bg-red-50` (paleta estándar de Tailwind).

---

## Appendix: Script de tests en package.json

```json
{
  "scripts": {
    "test:unit":        "vitest run --reporter=verbose --exclude 'test/**'",
    "test:integration": "vitest run --reporter=verbose --config vitest.integration.config.ts",
    "test":             "vitest"
  }
}
```

`vitest.config.ts` → entorno `jsdom`, setupFiles con `test/setup.ts`, excluye `test/`.
`vitest.integration.config.ts` → entorno `node`, globalSetup en `test/setup/global-setup.ts`,
incluye solo `test/**/*.spec.ts`.
