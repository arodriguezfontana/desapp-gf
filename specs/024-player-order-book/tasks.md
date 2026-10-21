# Tasks: Libro de Órdenes por Jugador (Player Order Book)

**Input**: Design documents from `/specs/024-player-order-book/`  
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/order-book-api.md, quickstart.md  
**Tests**: Unit tests are required by Constitution Principle IX for all new and modified domain models, services, controllers, repositories, frontend services, hooks, and components.  
**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Exact file paths included in all task descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared infrastructure, domain aggregate model and type definitions for order book representation

- [X] T001 [P] Create `PriceLevel` value object interface and `OrderBook` domain aggregate in `backend/src/domain/orders/order-book.ts` with `OrderBook.create(playerId, bids, asks)` enforcing canonical sort (bids DESC, asks ASC), `OrderBook.empty(playerId)`, and constraints: `price` ("number positivo, precisión a 2 decimales"), `totalQuantity` ("integer mayor a 0"), `bids` and `asks` frozen arrays.
- [X] T002 [P] Create `PriceLevelDto` and `OrderBookResponseDto` TypeScript interfaces in `frontend/src/types/orders.types.ts` representing market depth (`playerId: string`, `bids: PriceLevelDto[]`, `asks: PriceLevelDto[]`).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core persistence and module wiring required before any user story can be served

**⚠️ CRITICAL**: Must be completed before user story endpoint implementation

- [X] T003 [P] Add domain unit tests in `backend/src/domain/orders/order-book.spec.ts` testing `OrderBook.create`, canonical sorting (bids DESC, asks ASC), volume calculations (`totalBidVolume`, `totalAskVolume`), empty book creation, and immutability.
- [X] T004 [P] Declare `getOrderBook(playerId: string): Promise<OrderBook>` in `backend/src/repositories/orders/order.repository.ts`.
- [X] T005 Implement `getOrderBook(playerId: string)` in `backend/src/repositories/orders/typeorm-order.repository.ts` executing aggregated query `SELECT side, price, COALESCE(SUM(remaining_quantity), 0)::integer AS "totalQuantity" FROM orders WHERE player_id = :playerId AND status IN ('PENDING', 'PARTIALLY_FILLED') GROUP BY side, price` and mapping to domain `OrderBook`.
- [X] T006 Export `OrdersService` from `OrdersModule` in `backend/src/modules/orders/orders.module.ts` and import `forwardRef(() => OrdersModule)` in `PlayerModule` (`backend/src/modules/player/player.module.ts`).

**Checkpoint**: Foundation ready - domain aggregate, repository layer and module wiring ready for user story implementation.

---

## Phase 3: User Story 1 - Consulta de profundidad y liquidez del mercado por jugador (Priority: P1) 🎯 MVP

**Goal**: Permitir al usuario consultar la profundidad y liquidez del mercado para un jugador determinado a través de `GET /players/:id/order-book` y visualizar los niveles de compra y venta consolidados con barras de profundidad en la vista de detalle del jugador en el frontend.

**Independent Test**: Consultar `GET /players/:id/order-book` con órdenes de compra y venta activas a diferentes precios y verificar respuesta 200 OK con `bids` ordenados DESC y `asks` ordenados ASC, consolidando remanentes de órdenes al mismo precio. En frontend, verificar que `OrderBookView` renderiza ambas tablas de profundidad y barras proporcionales en `PlayerDetailPage`.

### Tests for User Story 1

- [X] T007 [P] [US1] Unit tests for `OrdersService.getOrderBook(playerId)` in `backend/src/services/orders/orders.service.spec.ts` verifying player existence validation, repository delegation, and canonical book return.
- [X] T008 [P] [US1] Unit tests for `PlayerController.getOrderBook` in `backend/src/controllers/player/player.controller.spec.ts` verifying parameter extraction, delegation to `OrdersService`, and DTO transformation.
- [X] T009 [P] [US1] Unit tests for `catalogService.getOrderBook(playerId)` in `frontend/src/service/catalogService.spec.ts` verifying HTTP GET request to `/players/:id/order-book` with JWT authentication headers.
- [X] T010 [P] [US1] Unit tests for `useOrderBook` hook in `frontend/src/hooks/useOrderBook.spec.ts` verifying initial fetch, loading state, success state, error handling, and manual reload function.
- [X] T011 [P] [US1] Unit tests for `OrderBookView` component in `frontend/src/components/OrderBookView.spec.tsx` verifying rendering of bids and asks columns, price formatting, quantity display, depth bar width calculations, and reload action.

### Implementation for User Story 1

- [X] T012 [US1] Implement `getOrderBook(playerId: string): Promise<OrderBook>` in `backend/src/services/orders/orders.service.ts` checking player existence with `PlayerRepository.findById` (throwing `PlayerNotFoundError` if missing) and delegating to `OrderRepository.getOrderBook(playerId)`.
- [X] T013 [US1] Implement `@Get(':id/order-book')` handler in `backend/src/controllers/player/player.controller.ts` with `ParseUUIDPipe`, injecting `OrdersService`, and delegating to `ordersService.getOrderBook(id)`.
- [X] T014 [US1] Implement `getOrderBook(playerId: string): Promise<OrderBookResponseDto>` in `frontend/src/service/catalogService.ts` calling `GET /players/${playerId}/order-book` via `httpClient`.
- [X] T015 [US1] Implement `useOrderBook(playerId: string)` hook in `frontend/src/hooks/useOrderBook.ts` exposing `{ orderBook, loading, error, reload }`.
- [X] T016 [US1] Implement `OrderBookView` presentation component in `frontend/src/components/OrderBookView.tsx` with responsive layout for Bids (emerald) and Asks (rose) columns, formatted prices, total quantities, and relative visual depth bars.
- [X] T017 [US1] Integrate `OrderBookView` into `frontend/src/pages/PlayerDetailPage.tsx` and update page unit tests in `frontend/src/pages/PlayerDetailPage.spec.tsx`.

**Checkpoint**: At this point, User Story 1 is fully functional and independently testable end-to-end (MVP complete).

---

## Phase 4: User Story 2 - Anonimato y agregación de mercado (Priority: P2)

**Goal**: Garantizar la total confidencialidad de los operadores y órdenes en el libro de mercado, impidiendo la exposición de identificadores de usuario (`userId`), nombres, correos o identificadores individuales de órdenes (`orderId`).

**Independent Test**: Inspeccionar las respuestas del endpoint y verificar que la estructura de DTOs y serialización JSON solo expone `playerId`, `bids` (`price`, `totalQuantity`) y `asks` (`price`, `totalQuantity`), sin ningún campo de identidad ni metadatos de órdenes individuales.

### Tests for User Story 2

- [X] T018 [P] [US2] Add unit tests in `backend/src/controllers/player/player.controller.spec.ts` verifying that `OrderBookResponseDto` maps exclusively `price` and `totalQuantity` per level, with strict exclusion of `userId`, `orderId`, and user metadata.

### Implementation for User Story 2

- [X] T019 [P] [US2] Create DTO classes `PriceLevelDto` and `OrderBookResponseDto` in `backend/src/controllers/player/dto/order-book-response.dto.ts` with `@ApiProperty` decorators, strict typed properties (`price: string`, `totalQuantity: number`), and static method `OrderBookResponseDto.fromDomain(orderBook: OrderBook)`.
- [X] T020 [US2] Add OpenAPI Swagger documentation decorators (`@ApiOperation`, `@ApiResponse({ status: 200, type: OrderBookResponseDto })`, `@ApiBearerAuth`) to `PlayerController.getOrderBook` in `backend/src/controllers/player/player.controller.ts` documenting market anonymity.

**Checkpoint**: User Stories 1 and 2 are functional, with verified market confidentiality and complete API documentation.

---

## Phase 5: User Story 3 - Manejo de estados vacíos y validación de existencia del jugador (Priority: P3)

**Goal**: Proveer respuestas y mensajes claros ante jugadores sin posturas de mercado (libro vacío con 200 OK), jugadores inexistentes (404 Not Found), identificadores UUID inválidos (400 Bad Request) y peticiones no autenticadas (401 Unauthorized), tanto en la API como en la interfaz de usuario.

**Independent Test**: Consultar un jugador sin órdenes activas y comprobar que responde 200 OK con `bids: []` y `asks: []`, mostrando mensaje de estado vacío en UI; consultar con UUID inexistente y comprobar 404 Not Found con mensaje descriptivo; consultar con ID malformado y verificar 400 Bad Request.

### Tests for User Story 3

- [X] T021 [P] [US3] Unit tests for empty book and invalid player handling in `backend/src/services/orders/orders.service.spec.ts` verifying `PlayerNotFoundError` when player is not found and returning `OrderBook.empty(playerId)` when no active orders exist.
- [X] T022 [P] [US3] Unit tests in `backend/src/controllers/player/player.controller.spec.ts` verifying 400 response for non-UUID parameter and 404 response propagation for `PlayerNotFoundError`.
- [X] T023 [P] [US3] Unit tests in `frontend/src/components/OrderBookView.spec.tsx` verifying empty state message when both `bids` and `asks` are empty.

### Implementation for User Story 3

- [X] T024 [US3] Implement empty book state UI banner/placeholder in `frontend/src/components/OrderBookView.tsx` when `bids.length === 0 && asks.length === 0` ("No hay órdenes activas en el mercado para este jugador").

**Checkpoint**: All user stories functional with complete edge case and error handling.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cross-cutting validations, architectural enforcement, and documentation updates

- [X] T025 [P] Run and verify architecture tests in `backend/test/architecture.spec.ts` ensuring strict layer compliance (Principio I: Controller -> Service -> {Domain, Repository}).
- [X] T026 [P] Run backend unit test suite (`pnpm test:unit` from `backend/`) and ensure 100% pass rate across all suites.
- [X] T027 [P] Run frontend unit test suite (`npm run test:unit` from `frontend/`) and ensure 100% pass rate across all suites.
- [X] T028 Update Postman collection `docs/postman/desapp.postman_collection.json` with `GET /players/:id/order-book` request, auth bearer token, and sample 200/404 responses.
- [X] T029 Execute end-to-end verification following scenarios 1-4 in `specs/024-player-order-book/quickstart.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 completion - BLOCKS all user story phases.
- **User Story 1 (Phase 3)**: Depends on Phase 2 completion. Delivers the core MVP functionality (depth calculation and frontend display).
- **User Story 2 (Phase 4)**: Depends on Phase 3 controller & DTO integration. Refines anonymity and OpenAPI documentation.
- **User Story 3 (Phase 5)**: Depends on Phase 3 and Phase 4. Handles empty state and non-existent player error paths.
- **Polish (Phase 6)**: Depends on all user stories being implemented.

### User Story Dependencies

- **US1 (P1)**: Independent after Foundational phase.
- **US2 (P2)**: Extends US1 DTOs and decorators with strict anonymity enforcement and Swagger contract.
- **US3 (P3)**: Validates empty states and 404 error boundaries on top of US1/US2.

### Within Each User Story

- Unit tests written first and verified to fail or establish the specification.
- Domain models and DTOs before services.
- Services before controllers.
- Backend endpoint before frontend service client.
- Frontend service client before hook.
- Hook before component.
- Component before page integration.

---

## Parallel Execution Examples

### Parallel Example: Phase 1 & 2 (Setup & Foundation)

```bash
# Parallel setup tasks:
Task: "T001 Create PriceLevel value object interface and OrderBook domain aggregate in backend/src/domain/orders/order-book.ts"
Task: "T002 Create PriceLevelDto and OrderBookResponseDto TypeScript interfaces in frontend/src/types/orders.types.ts"

# Parallel foundational tests & interfaces:
Task: "T003 Add domain unit tests in backend/src/domain/orders/order-book.spec.ts"
Task: "T004 Declare getOrderBook(playerId: string): Promise<OrderBook> in backend/src/repositories/orders/order.repository.ts"
```

### Parallel Example: User Story 1 (Tests)

```bash
# Launch unit tests for US1 in parallel across backend and frontend:
Task: "T007 Unit tests for OrdersService.getOrderBook(playerId) in backend/src/services/orders/orders.service.spec.ts"
Task: "T008 Unit tests for PlayerController.getOrderBook in backend/src/controllers/player/player.controller.spec.ts"
Task: "T009 Unit tests for catalogService.getOrderBook(playerId) in frontend/src/service/catalogService.spec.ts"
Task: "T010 Unit tests for useOrderBook hook in frontend/src/hooks/useOrderBook.spec.ts"
Task: "T011 Unit tests for OrderBookView component in frontend/src/components/OrderBookView.spec.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (`order-book.ts`, frontend types).
2. Complete Phase 2: Foundational (TypeORM repository implementation, module export/import).
3. Complete Phase 3: User Story 1 (Service method, Controller endpoint, frontend service, hook, component, page integration).
4. **STOP and VALIDATE**: Run unit tests and quickstart scenario 1. Verify market depth displays correctly.

### Incremental Delivery

1. Setup + Foundation: Domain and aggregated persistence ready.
2. User Story 1 (MVP): Complete flow for active orders depth in backend and frontend.
3. User Story 2: Explicit DTO anonymity guarantees, OpenAPI documentation.
4. User Story 3: 404 validation for nonexistent players and empty book state rendering in frontend.
5. Polish: Run architecture tsarch tests, verify CI unit test suites in both workspaces, update Postman collection.
