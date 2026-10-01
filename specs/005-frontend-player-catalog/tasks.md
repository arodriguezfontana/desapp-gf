# Tasks: Frontend — Catálogo de jugadores

**Feature**: `005-frontend-player-catalog`
**Branch**: `005-frontend-player-catalog`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Contracts**: [contracts/ui-contracts.md](./contracts/ui-contracts.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Definición de tipos de dominio, almacenamiento local de ApiKey y hooks auxiliares.

- [x] T001 Define catalog domain types, DTOs, and constants (`LEAGUES` = `['Premier League', 'Bundesliga', 'La Liga', 'Serie A', 'Ligue 1']`, `POSITIONS` = `['GK', 'DF', 'MF', 'FW']`) in `frontend/src/types/catalog.types.ts`
- [x] T002 [P] Implement ApiKey storage manager for key `api_key` in `localStorage` in `frontend/src/service/apiKeyStorage.ts`
- [x] T003 [P] Implement search input debouncing custom hook `useDebounce` in `frontend/src/hooks/useDebounce.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Actualización del cliente HTTP para soporte dual (JWT / ApiKey) y servicio de catálogo.

- [x] T004 Update `frontend/src/service/httpClient.ts` to support `{ useApiKey?: boolean }` options, attaching `X-Api-Key` header, and handling 401 status by invoking `apiKeyStorage.clearApiKey()` and dispatching `apiKeyUnauthorized` custom event
- [x] T005 [P] Create catalog API service `getPlayers` and `getPlayerById` with `useApiKey: true` in `frontend/src/service/catalogService.ts`
- [x] T006 [P] Add unit test for ApiKey storage manager in `frontend/src/service/apiKeyStorage.spec.ts`
- [x] T007 [P] Add unit test for HTTP client dual-mode header injection and 401 event emission in `frontend/src/service/httpClient.spec.ts`
- [x] T008 [P] Add unit test for `useDebounce` hook in `frontend/src/hooks/useDebounce.spec.ts`
- [x] T009 [P] Add unit test for catalog API service in `frontend/src/service/catalogService.spec.ts`

**Checkpoint**: Core infrastructure ready. User story implementations can now proceed.

---

## Phase 3: User Story 1 - Listado de jugadores con filtros y paginación (Priority: P1)

**Goal**: Permitir la exploración del catálogo con filtros combinables (Liga, Posición, Equipo con debounce 400ms) y paginación fija con rango visible y total.

**Independent Test**: Abrir `/catalog` con una ApiKey guardada, seleccionar filtros, navegar entre páginas y verificar que si no hay coincidencias se muestra el texto `"No se encontraron jugadores con estos filtros."`.

### Implementation for User Story 1

- [x] T010 [P] [US1] Create filter control component `CatalogFilters` for 5 fixed leagues, 4 fixed positions, and free text team input in `frontend/src/components/CatalogFilters.tsx`
- [x] T011 [P] [US1] Create pagination navigation component `PaginationControls` with Previous/Next buttons, visible range (e.g. "Mostrando 1 - 10 de 45"), and total count in `frontend/src/components/PaginationControls.tsx`
- [x] T012 [P] [US1] Create player card item component `PlayerCard` displaying player info and link to detail in `frontend/src/components/PlayerCard.tsx`
- [x] T013 [US1] Implement catalog list view `CatalogPage` rendering filters, player list, pagination, loading states, and displaying `"No se encontraron jugadores con estos filtros."` on empty 200 OK response in `frontend/src/pages/CatalogPage.tsx`
- [x] T014 [P] [US1] Unit tests for `CatalogFilters`, `PaginationControls`, and `PlayerCard` components in `frontend/src/components/CatalogFilters.spec.tsx`, `frontend/src/components/PaginationControls.spec.tsx`, and `frontend/src/components/PlayerCard.spec.tsx`
- [x] T015 [P] [US1] Unit test for catalog page list rendering, filtering, and empty result text in `frontend/src/pages/CatalogPage.spec.tsx`

**Checkpoint**: User Story 1 fully functional and testable independently.

---

## Phase 4: User Story 2 - Consulta de detalle de un jugador (Priority: P1)

**Goal**: Permitir consultar la información completa de un jugador en `/catalog/:id` y presentar el mensaje original de error 404 del backend tal cual sin redirigir.

**Independent Test**: Seleccionar un jugador para ver su ficha detallada; acceder a un ID inexistente y confirmar que la pantalla exhibe la redacción exacta del 404 devuelto por el backend sin redirección automática.

### Implementation for User Story 2

- [x] T016 [US2] Implement player detail view `PlayerDetailPage` fetching data via `catalogService.getPlayerById`, displaying full player information with sports styling, and showing unedited 404 backend error text on 404 status in `frontend/src/pages/PlayerDetailPage.tsx`
- [x] T017 [P] [US2] Unit test for `PlayerDetailPage` in `frontend/src/pages/PlayerDetailPage.spec.tsx` testing successful detail view and exact 404 backend error message display

**Checkpoint**: User Story 2 fully functional and testable independently.

---

## Phase 5: User Story 3 - Control de acceso al catálogo basado en ApiKey (Priority: P1)

**Goal**: Condicionar el acceso al catálogo a la presencia de una ApiKey guardada; si falta o caduca (401), mostrar `"Necesitás generar una ApiKey para ver el catálogo."` con link a `/account` y redirigir el login exitoso a `/catalog`.

**Independent Test**: Sin ApiKey guardada o tras recibir un 401, verificar que la pantalla detiene la consulta y muestra el aviso con link a `/account`. Al iniciar sesión correctamente, verificar la redirección directa a `/catalog`.

### Implementation for User Story 3

- [x] T018 [US3] Update application router and layout to route `/` to `/catalog` and register `/catalog` and `/catalog/:id` in `frontend/src/routes/router.tsx` and `frontend/src/routes/RootLayout.tsx`
- [x] T019 [US3] Update post-login redirection target to `/catalog` in `frontend/src/pages/LoginPage.tsx`
- [x] T020 [US3] Integrate missing/invalid ApiKey state and `apiKeyUnauthorized` listener in `CatalogPage` and `PlayerDetailPage` to show `"Necesitás generar una ApiKey para ver el catálogo."` notice with direct link to `/account` in `frontend/src/pages/CatalogPage.tsx` and `frontend/src/pages/PlayerDetailPage.tsx`
- [x] T021 [P] [US3] Unit tests for ApiKey access gate and 401 unauthorized handling in `frontend/src/pages/CatalogPage.spec.tsx` and `frontend/src/pages/PlayerDetailPage.spec.tsx`

**Checkpoint**: User Story 3 fully functional and testable independently.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Pruebas de integración E2E frontend-backend y validación final de calidad.

- [x] T022 Create integration test for catalog list filtering, pagination, detail 404 handling, and ApiKey requirement against real backend using Testcontainers in `frontend/test/catalog.spec.ts`
- [x] T023 Run project verification suite (`pnpm test:unit`, `pnpm test:integration`, `pnpm lint`, `pnpm build`) and audit user-facing text for zero technical developer jargon

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories.
- **User Stories (Phase 3+)**: All depend on Foundational phase completion.
  - US1, US2, and US3 can proceed sequentially in priority order or in parallel.
- **Polish (Phase 6)**: Depends on all user stories being complete.

### User Story Execution Order

- **User Story 1 (P1)**: Can start after Foundational phase.
- **User Story 2 (P1)**: Can start after Foundational phase.
- **User Story 3 (P1)**: Can start after Foundational phase; integrates with US1 and US2 views.

---

## Parallel Execution Opportunities

- Phase 1: `T002` and `T003` can run in parallel.
- Phase 2: `T005`, `T006`, `T007`, `T008`, and `T009` can run in parallel once `T004` is ready.
- Phase 3: `T010`, `T011`, `T012`, `T014`, and `T015` can run in parallel.
- Phase 4: `T017` can run in parallel with `T016`.
- Phase 5: `T021` can run in parallel after `T020`.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (User Story 1 - Catalog list & filters).
3. Validate `/catalog` rendering with filters and pagination.

### Full Delivery
1. Complete Phase 4 (User Story 2 - Player detail & 404 text).
2. Complete Phase 5 (User Story 3 - ApiKey access gate & login redirect).
3. Complete Phase 6 (Integration tests & lint/build verification).
