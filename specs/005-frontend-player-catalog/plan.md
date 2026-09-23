# Implementation Plan: [FEATURE]
# Implementation Plan: Frontend — Catálogo de jugadores

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Branch**: `005-frontend-player-catalog` | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`
**Input**: Feature specification from `/specs/005-frontend-player-catalog/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]
Implementar la interfaz de usuario para el Catálogo de Jugadores en el frontend React 19 + Vite + Tailwind, permitiendo la exploración paginada y filtrada del catálogo de futbolistas (`/catalog`) y la vista de detalle de un jugador (`/catalog/:id`). La autenticación para la lectura de los datos se basa exclusivamente en la presencia de una ApiKey válida guardada en `localStorage` (vía `apiKeyStorage.ts` y header `X-Api-Key` en `httpClient.ts`), siendo independiente de la sesión JWT. Al loguearse, el destino directo pasa a ser el catálogo.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->
**Language/Version**: TypeScript 5.7+ / Node.js 20+ / React 19 / Vite 8

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]
**Primary Dependencies**: `react-router-dom ^7`, `@testing-library/react`, `vitest`, `@testing-library/jest-dom`, `@testcontainers/postgresql`

**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]
**Storage**: `localStorage` (claves `auth_token` y `api_key`)

**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]
**Testing**: Vitest + React Testing Library (`pnpm test:unit`) + Testcontainers (`pnpm test:integration`)

**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]
**Target Platform**: Navegadores Web Modernos (Desktop y Mobile)

**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]
**Project Type**: Single-page Application (SPA) en monorepo

**Project Type**: [e.g., library/cli/web-service/mobile-app/compiler/desktop-app or NEEDS CLARIFICATION]
**Performance Goals**: Renderizado instantáneo de filtros con debounce de 400ms en búsqueda por equipo y respuesta de UI < 2s.

**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]
**Constraints**:
- El cliente `httpClient.ts` MUST soportar modo ApiKey (`X-Api-Key`), separado del JWT (`Authorization: Bearer`).
- Si falta ApiKey o un 401 invalida la clave, la interfaz MUST mostrar `"Necesitás generar una ApiKey para ver el catálogo."` con enlace a `/account`.
- Las respuestas 200 vacías en listado muestran `"No se encontraron jugadores con estos filtros."`.
- Las respuestas 404 en detalle presentan el mensaje original del backend tal cual.

**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]
**Scale/Scope**: 1 vista de catálogo con filtros combinables (5 ligas, 4 posiciones, equipo libre) y paginación fija, 1 vista de detalle.

**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

[Gates determined based on constitution file]
- **Principio I — Estructura por Capas**:
  - `src/service/` (`catalogService.ts`, `apiKeyStorage.ts`, `httpClient.ts`)
  - `src/hooks/` (`useDebounce.ts`, `useCatalog.ts`)
  - `src/components/` (`PlayerCard.tsx`, `CatalogFilters.tsx`, `PaginationControls.tsx`)
  - `src/pages/` (`CatalogPage.tsx`, `PlayerDetailPage.tsx`)
  - `src/routes/` (`router.tsx`, `RootLayout.tsx`)
  - Status: PASS ✅

- **Principio IX — Testing**:
  - Direct unit tests for `apiKeyStorage.ts`, `catalogService.ts`, `useDebounce.ts`.
  - Component unit tests for `CatalogFilters`, `PaginationControls`, `CatalogPage`, `PlayerDetailPage`.
  - Integration tests in `frontend/test/catalog.spec.ts` running against real backend + Testcontainers without mocks.
  - Status: PASS ✅

- **Principio X — Definición de Terminado**:
  - `pnpm lint`, `pnpm test:unit`, `pnpm test:integration`, `pnpm build` deben pasar limpios.
  - Status: PASS ✅

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
specs/005-frontend-player-catalog/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── ui-contracts.md  # Phase 1 output
└── tasks.md             # Phase 2 output (via /speckit-tasks)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── types/
│   │   └── catalog.types.ts
│   ├── service/
│   │   ├── apiKeyStorage.ts
│   │   ├── httpClient.ts
│   │   └── catalogService.ts
│   ├── hooks/
│   │   └── useDebounce.ts
│   ├── components/
│   │   ├── CatalogFilters.tsx
│   │   ├── PaginationControls.tsx
│   │   └── PlayerCard.tsx
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
│   │   ├── CatalogPage.tsx
│   │   ├── PlayerDetailPage.tsx
│   │   ├── LoginPage.tsx
│   │   └── AccountPage.tsx
│   └── routes/
│       ├── router.tsx
│       └── RootLayout.tsx
└── test/
    └── catalog.spec.ts
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]
**Structure Decision**: Monorepo Frontend SPA bajo `frontend/src/` estructurado por capas en cumplimiento con la Constitución v1.8.0.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
*No constitution violations. Architecture is fully compliant.*
