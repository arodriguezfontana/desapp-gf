---

description: "Task list for 020-order-matching-engine"
---

# Tasks: Superusuario y motor de matching de órdenes

**Input**: Design documents from `/specs/020-order-matching-engine/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/orders-api.md, quickstart.md

**Tests**: Explicitly requested by the user (backend Testcontainers suite + domain unit tests + frontend component tests per plan.md Principio IX) — included below.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation and testing. US1–US5 are all P1, but have a strict technical dependency chain (US2 needs US1's `username`/reserved-value check and the seed infra; US3 needs the price-calculation path; US4 needs US3's order creation; US5's bookkeeping is exercised by US4's matching) — see Dependencies section.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US5 map to spec.md's five user stories
- All paths are relative to the repo root (`backend/...`, `frontend/...`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffolding and config shared by every story below

- [X] T001 Add `SUPERUSER_EMAIL`/`SUPERUSER_PASSWORD` to `backend/.env.example` with comments mirroring the existing `ADMIN_EMAIL`/`ADMIN_PASSWORD` block
- [X] T002 [P] Create `ORDERS_REPOSITORY`/`TOKEN_TRANSACTION_REPOSITORY` DI tokens in `backend/src/modules/orders/orders.constants.ts`
- [X] T003 [P] Create `TOKEN_HOLDING_REPOSITORY` DI token in `backend/src/modules/portfolio/portfolio.constants.ts` (new file; `portfolio.module.ts` currently has no constants file)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Domain entities, persistence, and migrations that every user story builds on

**⚠️ CRITICAL**: No user story task can start until this phase is complete

- [X] T004 [P] Create `OrderSide` enum (`BUY`/`SELL`) in `backend/src/domain/orders/order-side.ts`
- [X] T005 [P] Create `OrderStatus` enum (`PENDING`/`PARTIALLY_FILLED`/`COMPLETED`) in `backend/src/domain/orders/order-status.ts`
- [X] T006 [P] Create `TokenTransactionType` enum (`CREDIT`/`DEBIT`) in `backend/src/domain/orders/token-transaction-type.ts`
- [X] T007 [P] Create `Order` domain entity (`create`, `fill`, `isCompatibleWith`, invariants per data-model.md) in `backend/src/domain/orders/order.ts`
- [X] T008 [P] Create `TokenTransaction` domain entity (immutable, no edit/delete) in `backend/src/domain/orders/token-transaction.ts`
- [X] T009 [P] Create `TokenHolding` domain entity (`createEmpty`, `credit`, `debit`) in `backend/src/domain/portfolio/token-holding.ts`
- [X] T010 [P] Create `InsufficientHoldingError` in `backend/src/domain/portfolio/errors/insufficient-holding.error.ts`
- [X] T011 [P] Create `ReservedUsernameError` in `backend/src/domain/auth/errors/reserved-username.error.ts`
- [X] T012 [P] Create `Username` value object (`Username.create(raw)`, rejects exactly `"superuser"`) in `backend/src/domain/auth/username.ts`
- [X] T013 Add `username: string` field + getter to `User` domain entity in `backend/src/domain/auth/user.ts` (update `User.register(...)` signature)
- [X] T014 [P] Domain unit tests for `Order` (create/fill/isCompatibleWith/invariants, no NestJS/DB) in `backend/src/domain/orders/order.spec.ts`
- [X] T015 [P] Domain unit tests for `TokenHolding` (credit/debit/InsufficientHoldingError) in `backend/src/domain/portfolio/token-holding.spec.ts`
- [X] T016 [P] Domain unit tests for `Username` (rejects `"superuser"` exactly, accepts anything else) in `backend/src/domain/auth/username.spec.ts`
- [X] T017 Create `OrderEntity` (TypeORM) with matching index `(player_id, side, price, status, created_at)` in `backend/src/repositories/orders/entities/order.entity.ts`
- [X] T018 Create `TokenTransactionEntity` (TypeORM, FKs to `orders`) in `backend/src/repositories/orders/entities/token-transaction.entity.ts`
- [X] T019 Create `TokenHoldingEntity` (TypeORM, unique `(user_id, player_id)`) in `backend/src/repositories/portfolio/entities/token-holding.entity.ts`
- [X] T020 Add `username varchar(255) NOT NULL` column to `UserEntity` in `backend/src/repositories/auth/entities/user.entity.ts`
- [X] T021 [P] Create `OrderMapper` (domain ↔ entity) in `backend/src/repositories/orders/mappers/order.mapper.ts`
- [X] T022 [P] Create `TokenTransactionMapper` in `backend/src/repositories/orders/mappers/token-transaction.mapper.ts`
- [X] T023 [P] Create `TokenHoldingMapper` in `backend/src/repositories/portfolio/mappers/token-holding.mapper.ts`
- [X] T024 Update `UserMapper` to map `username` in `backend/src/repositories/auth/mappers/user.mapper.ts`
- [X] T025 Create `OrderRepository` interface (`save`, `findCompatibleCandidates(playerId, side, price)` ordered FIFO, `findById`) in `backend/src/repositories/orders/order.repository.ts`
- [X] T026 Create `TypeOrmOrderRepository` implementation in `backend/src/repositories/orders/typeorm-order.repository.ts`
- [X] T027 Create `TokenTransactionRepository` interface (`save`, append-only, no update/delete) in `backend/src/repositories/orders/token-transaction.repository.ts`
- [X] T028 Create `TypeOrmTokenTransactionRepository` implementation in `backend/src/repositories/orders/typeorm-token-transaction.repository.ts`
- [X] T029 Create `TokenHoldingRepository` interface (`findByUserAndPlayer`, `save`) in `backend/src/repositories/portfolio/token-holding.repository.ts`
- [X] T030 Create `TypeOrmTokenHoldingRepository` implementation in `backend/src/repositories/portfolio/typeorm-token-holding.repository.ts`
- [X] T031 Migration `AddUsernameToUsers` (NOT NULL, no unique index, simple backfill) in `backend/src/database/migrations/<timestamp>-AddUsernameToUsers.ts`
- [X] T032 Migration `CreateTokenHoldings` in `backend/src/database/migrations/<timestamp>-CreateTokenHoldings.ts`
- [X] T033 Migration `CreateOrders` in `backend/src/database/migrations/<timestamp>-CreateOrders.ts`
- [X] T034 Migration `CreateTokenTransactions` (FKs to `orders`) in `backend/src/database/migrations/<timestamp>-CreateTokenTransactions.ts`
- [X] T035 Wire `OrdersModule` (`TypeOrmModule.forFeature`, controllers, providers, DI token bindings) in `backend/src/modules/orders/orders.module.ts`
- [X] T036 Update `PortfolioModule` to register `TokenHoldingEntity` and bind `TOKEN_HOLDING_REPOSITORY` in `backend/src/modules/portfolio/portfolio.module.ts`
- [X] T037 [P] tsarch architecture test coverage check: confirm new `orders`/`portfolio` directories respect layer rules (run existing tsarch suite, no new file expected unless a gap is found)

**Checkpoint**: Schema migrated, domain entities + repositories wired, `nest build` succeeds. User story implementation can now begin.

---

## Phase 3: User Story 1 - Reservar el username "superuser" (Priority: P1)

**Goal**: Registration rejects `username = "superuser"` with 409; any other username (even duplicated) is accepted.

**Independent Test**: Register with `username: "superuser"` → 409, no account created. Register two distinct users with the same non-reserved username → both succeed.

### Tests for User Story 1

- [X] T038 [P] [US1] Integration test (Testcontainers): `POST /auth/register` with `username: "superuser"` → 409, no row created, in `backend/test/auth-register-reserved-username.e2e-spec.ts`
- [X] T039 [P] [US1] Integration test (Testcontainers): two distinct users registering with the same non-reserved username both succeed, in `backend/test/auth-register-reserved-username.e2e-spec.ts`

### Implementation for User Story 1

- [X] T040 [US1] Add `username` field (`@IsString() @IsNotEmpty()`) to `backend/src/controllers/auth/dto/register-request.dto.ts`
- [X] T041 [US1] Call `Username.create(dto.username)` in `AuthService.register` before `User.register(...)`, propagating `ReservedUsernameError` in `backend/src/services/auth/auth.service.ts`
- [X] T042 [US1] Map `ReservedUsernameError` → HTTP 409 in the existing `AllExceptionsFilter` error table (confirm/extend mapping) in `backend/src/filters/all-exceptions.filter.ts`
- [X] T043 [US1] Update Swagger decorators on `RegisterRequestDto`/`AuthController` to document `username` and the new 409 case in `backend/src/controllers/auth/dto/register-request.dto.ts` and `backend/src/controllers/auth/auth.controller.ts`

**Checkpoint**: User Story 1 fully functional and testable independently — registration enforces the reserved value.

---

## Phase 4: User Story 2 - Seed del superusuario con holdings y órdenes iniciales (Priority: P1)

**Goal**: On boot, exactly one `username = "superuser"` user exists, with a 100-token holding per catalog player and one SELL PENDING order per player at that player's valuation price for the superuser's selected strategy.

**Independent Test**: Run the seed against a catalog with N players; assert the superuser has N holdings of 100 and N SELL PENDING orders, each order's price equal to `GET /players/:id/valuation` for the superuser on that player.

### Tests for User Story 2

- [X] T044 [P] [US2] Integration test (Testcontainers): seed creates exactly one `username="superuser"` user, idempotent on re-run, in `backend/test/superuser-seed.e2e-spec.ts`
- [X] T045 [P] [US2] Integration test (Testcontainers): after seeding, superuser has a `TokenHolding(quantity=100)` and one `Order(side=SELL, quantity=100, status=PENDING)` per catalog player, price matching `GET /players/:id/valuation`, in `backend/test/superuser-seed.e2e-spec.ts`

### Implementation for User Story 2

- [X] T046 [US2] Create `SuperuserSeedService.run()` (idempotent by `username`, reads `SUPERUSER_EMAIL`/`SUPERUSER_PASSWORD`, creates user + calls `UserStrategyProvisioningService`) in `backend/src/services/auth/superuser-seed.service.ts` (depends on T012, T013, T029/T030)
- [X] T047 [US2] Extend `SuperuserSeedService.run()` to iterate `PlayerRepository.findAllActive()`, create a `TokenHolding(quantity=100)` per player via `TokenHoldingRepository`, in `backend/src/services/auth/superuser-seed.service.ts` (depends on T046)
- [X] T048 [US2] Extend `SuperuserSeedService.run()` to call `QuotationService.valuate(superuserId, playerId)` per player and persist one SELL `Order` at that price via `OrderRepository`, in `backend/src/services/auth/superuser-seed.service.ts` (depends on T047, and on Phase 5's `Order.create` — may stub price-rounding inline if Phase 5 isn't done yet; reconcile before merging)
- [X] T049 [US2] Register `SuperuserSeedService` as a provider in `backend/src/modules/auth/auth.module.ts`
- [X] T050 [US2] Invoke `SuperuserSeedService.run()` from `backend/src/main.ts`, after `AdminSeedService.run()`

**Checkpoint**: User Stories 1 AND 2 both work independently — the superuser exists with full initial liquidity after boot.

---

## Phase 5: User Story 3 - Publicar una orden sin indicar precio (Priority: P1)

**Goal**: `POST /orders` accepts `{ side, playerId, quantity }` (never `price`) and persists an order whose price is computed automatically from the caller's selected strategy.

**Independent Test**: Create an order (BUY or SELL) without a price field; assert the stored price equals `GET /players/:id/valuation` for that user/player at that moment.

### Tests for User Story 3

- [X] T051 [P] [US3] Integration test (Testcontainers): `POST /orders` with no candidates in the book → order persisted PENDING with price equal to `GET /players/:id/valuation`, in `backend/test/orders-create.e2e-spec.ts`
- [X] T052 [P] [US3] Integration test (Testcontainers): `POST /orders` for a nonexistent `playerId` → 404, no order created, in `backend/test/orders-create.e2e-spec.ts`
- [X] T053 [P] [US3] Integration test (Testcontainers): `POST /orders` SELL with insufficient holding → 400, no order created, in `backend/test/orders-create.e2e-spec.ts`
- [X] T054 [P] [US3] Integration test (Testcontainers): two users with different selected strategies each get their own order price for the same player/quantity, in `backend/test/orders-create.e2e-spec.ts`

### Implementation for User Story 3

- [X] T055 [P] [US3] Create `CreateOrderRequestDto` (`side` enum, `playerId` UUID, `quantity` positive integer, `forbidNonWhitelisted` so a stray `price` field is rejected) in `backend/src/controllers/orders/dto/create-order-request.dto.ts`
- [X] T056 [P] [US3] Create `OrderResponseDto` (id, side, playerId, quantity, remainingQuantity, price, status, createdAt, fills) in `backend/src/controllers/orders/dto/order-response.dto.ts`
- [X] T057 [US3] Create `OrdersController.create()` — `POST /orders`, `JwtAuthGuard`, delegates to `OrdersService.createOrder` — in `backend/src/controllers/orders/orders.controller.ts` (depends on T055, T056)
- [X] T058 [US3] Create `OrdersService.createOrder(userId, playerId, side, quantity)`: validate player exists, validate SELL holding sufficiency (`InsufficientHoldingError` → 400), call `QuotationService.valuate(userId, playerId)`, round price to 2 decimals, persist a PENDING `Order` (no matching yet — added in Phase 6/7) in `backend/src/services/orders/orders.service.ts` (depends on T025/T026, T029/T030)
- [X] T059 [US3] Wire `OrdersController`/`OrdersService` into `backend/src/modules/orders/orders.module.ts` (extends T035)
- [X] T060 [US3] Add Swagger decorators for `POST /orders` on `OrdersController`/DTOs in `backend/src/controllers/orders/orders.controller.ts`
- [X] T061 [US3] Add `POST /orders` request to the project's Postman collection (per constitución Principio X, Definición de terminado)

**Checkpoint**: User Stories 1, 2, and 3 all work independently — orders can be created with an auto-computed price (matching against the book arrives in the next phase).

---

## Phase 6: User Story 4 - Matchear automáticamente una orden nueva contra el libro (Priority: P1)

**Goal**: On order creation, the system matches against PENDING/PARTIALLY_FILLED opposite-side orders for the same player at the exact same price, FIFO, combining multiple counterparties if needed, leaving any uncovered remainder as a new/updated PENDING order.

**Independent Test**: Publish a SELL order at price P; publish a BUY order for the same player at the same price P for a quantity ≤ the SELL's remaining quantity; assert full execution.

### Tests for User Story 4

- [X] T062 [P] [US4] Domain unit test: `matchOrder` fully fills against a single exact-price candidate, in `backend/src/domain/orders/match-order.spec.ts`
- [X] T063 [P] [US4] Domain unit test: `matchOrder` combines multiple FIFO candidates to fully cover quantity (partial fill on each), in `backend/src/domain/orders/match-order.spec.ts`
- [X] T064 [P] [US4] Domain unit test: `matchOrder` partially covers quantity, leaving a remainder, in `backend/src/domain/orders/match-order.spec.ts`
- [X] T065 [P] [US4] Domain unit test: `matchOrder` returns no fills when no same-price opposite-side candidate exists (including when only different-price candidates exist), in `backend/src/domain/orders/match-order.spec.ts`
- [X] T066 [P] [US4] Integration test (Testcontainers): `POST /orders` matches exact price fully against one existing order, both end `COMPLETED`, in `backend/test/orders-matching.e2e-spec.ts`
- [X] T067 [P] [US4] Integration test (Testcontainers): `POST /orders` matches partially across several existing orders FIFO, remainder persists as PENDING/PARTIALLY_FILLED, in `backend/test/orders-matching.e2e-spec.ts`
- [X] T068 [P] [US4] Integration test (Testcontainers): superuser orders match with a regular user's orders with no special treatment (DD-004), in `backend/test/orders-matching.e2e-spec.ts`
- [X] T069 [US4] Integration test (Testcontainers): concurrency — two simultaneous `POST /orders` that could both match the same existing order never double-fill or lose tokens (FR-021/SC-008), in `backend/test/orders-matching-concurrency.e2e-spec.ts`

### Implementation for User Story 4

- [X] T070 [US4] Implement pure domain function `matchOrder(newOrder: Order, candidates: Order[]): MatchPlan` (FIFO consumption, full/partial fill, remainder) in `backend/src/domain/orders/match-order.ts` (depends on T007)
- [X] T071 [US4] Extend `OrderRepository.findCompatibleCandidates` usage in `OrdersService.createOrder` to fetch same-player/opposite-side/same-price PENDING+PARTIALLY_FILLED orders ordered `(createdAt, id)` in `backend/src/services/orders/orders.service.ts` (depends on T025/T026, T058)
- [X] T072 [US4] Wrap matching in `DataSource.transaction(...)` with pessimistic locking (candidates first, then both involved `TokenHolding` rows ordered by `userId` ascending) in `backend/src/services/orders/orders.service.ts` (depends on T071, research.md D4)
- [X] T073 [US4] Apply `matchOrder`'s plan inside the transaction: update each touched `Order`'s `remainingQuantity`/`status`, persist the remainder (if any) as the new order's final state, in `backend/src/services/orders/orders.service.ts` (depends on T070, T072)
- [X] T074 [US4] Add matching-related structured logging (orderId, counterpartOrderId, quantity, price, no personal data) in `backend/src/services/orders/orders.service.ts`

**Checkpoint**: User Stories 1–4 all work independently — the matching engine is live end-to-end.

---

## Phase 7: User Story 5 - Registrar transferencia de tokens y TokenTransaction (Priority: P1)

**Goal**: Every executed fill moves tokens between both parties' holdings and records exactly one CREDIT and one DEBIT `TokenTransaction`.

**Independent Test**: Trigger a full execution between two compatible orders; assert buyer holding +quantity, seller holding −quantity, and exactly one CREDIT + one DEBIT transaction recorded.

### Tests for User Story 5

- [X] T075 [P] [US5] Integration test (Testcontainers): a full execution updates both holdings by exactly the executed quantity, in `backend/test/orders-matching.e2e-spec.ts`
- [X] T076 [P] [US5] Integration test (Testcontainers): a full execution creates exactly one CREDIT and one DEBIT `TokenTransaction`, each referencing `orderId`/`counterpartOrderId` correctly, in `backend/test/orders-matching.e2e-spec.ts`
- [X] T077 [P] [US5] Integration test (Testcontainers): an order filled via multiple partial executions produces one CREDIT/DEBIT pair per partial execution, in `backend/test/orders-matching.e2e-spec.ts`

### Implementation for User Story 5

- [X] T078 [US5] Within the matching transaction (T073), for each applied fill: load/credit buyer's `TokenHolding`, load/debit seller's `TokenHolding` (via `TokenHoldingRepository`, locked, ordered by `userId` ascending per research.md D4) in `backend/src/services/orders/orders.service.ts` (depends on T029/T030, T072, T073)
- [X] T079 [US5] Within the same transaction, persist a CREDIT `TokenTransaction` (buyer) and a DEBIT `TokenTransaction` (seller) per applied fill via `TokenTransactionRepository`, in `backend/src/services/orders/orders.service.ts` (depends on T027/T028, T078)
- [X] T080 [US5] Ensure `TokenTransactionRepository`/`TypeOrmTokenTransactionRepository` expose no update/delete methods (append-only, Principio V) — verify in `backend/src/repositories/orders/token-transaction.repository.ts`

**Checkpoint**: All five user stories independently functional — full order lifecycle with auditable token movement.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Frontend integration and final documentation/build checks

- [X] T081 [P] Create `frontend/src/types/orders.types.ts` (Order, OrderSide, OrderStatus, CreateOrderRequest/Response types)
- [X] T082 [P] Create `ordersService.ts` (`createOrder(side, playerId, quantity)` via `httpClient.post('/orders', ...)`) in `frontend/src/service/ordersService.ts`
- [X] T083 [P] Unit test for `ordersService.ts` mocking `fetch` (Principio IX, direct service test) in `frontend/src/service/ordersService.spec.ts`
- [X] T084 Create `useCreateOrder` hook (calls `ordersService.createOrder`, exposes loading/error state) in `frontend/src/hooks/useCreateOrder.ts` (depends on T082)
- [X] T085 [P] Create `OrderConfirmDialog` component (shows the price from the user's selected strategy — reuse `GET /players/:id/valuation` data already loaded on `PlayerDetailPage` — before confirming) in `frontend/src/components/OrderConfirmDialog.tsx`
- [X] T086 Add "Comprar"/"Vender" actions to `frontend/src/pages/PlayerDetailPage.tsx` near the existing "Valor token" display (~line 199-232), wiring `OrderConfirmDialog` + `useCreateOrder` (depends on T084, T085)
- [X] T087 [P] Component test for the "Comprar"/"Vender" flow exercising the real API client against Testcontainers backend (Principio IX) in `frontend/test/playerDetailOrders.test.tsx`
- [X] T088 Update Swagger-derived OpenAPI output and confirm it reflects `POST /auth/register` (username) and `POST /orders` (per Definición de terminado, Principio X/VIII)
- [X] T089 Run tsarch architecture test suite and fix any layering violation surfaced by the new `orders`/`portfolio` code
- [X] T090 Run `nest build` (backend) and `vite build` (frontend) and fix any compile error
- [X] T091 Execute all `quickstart.md` scenarios manually against a local run to confirm end-to-end behavior

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS every user story
- **US1 (Phase 3)**: Depends on Foundational only (`Username`, `User.username`) — independently deployable
- **US2 (Phase 4)**: Depends on Foundational + US1 (`Username`/`ReservedUsernameError` must exist so the seed's own `username="superuser"` flows through the same validated path; also depends on `TokenHolding`/`Order` persistence from Foundational)
- **US3 (Phase 5)**: Depends on Foundational only for order creation without matching; does NOT depend on US1/US2 to be independently testable (any authenticated user can create a priced PENDING order), though US2's seed orders are useful fixtures for manual testing
- **US4 (Phase 6)**: Depends on US3 (order creation must exist before matching can trigger on creation)
- **US5 (Phase 7)**: Depends on US4 (token movement/transactions are recorded as part of the same matching transaction — T078/T079 extend T072/T073)
- **Polish (Phase 8)**: Depends on US3 (needs `POST /orders` to exist) and benefits from US4/US5 being complete for a meaningful "Comprar"/"Vender" confirmation flow

### Critical Path

Setup → Foundational → US1 → US2 → US3 → US4 → US5 → Polish

US1–US5 are NOT parallelizable across teams in this feature despite all being P1: US2 needs US1's validation path, US4 needs US3's creation endpoint, and US5 is implemented inside US4's transaction. Within each phase, tasks marked `[P]` (different files, no cross-task dependency) can run in parallel.

### Parallel Opportunities

- All Setup tasks (T001–T003) in parallel
- Most Foundational tasks (T004–T016, T021–T023) in parallel (different files); entity/migration tasks T017–T020 and T025–T030 have some ordering within themselves (entity before mapper before repository interface before implementation) but are independent across the three entity families (Order/TokenTransaction vs TokenHolding vs User)
- US1 tests (T038–T039) in parallel; US2 tests (T044–T045) in parallel; US3 tests (T051–T054) in parallel; US4 tests (T062–T069, except T069 which should run after the others pass) in parallel; US5 tests (T075–T077) in parallel
- Polish frontend tasks T081–T083, T085 in parallel

---

## Parallel Example: User Story 4

```bash
# Launch all domain unit tests for matchOrder together:
Task: "Domain unit test: matchOrder fully fills against a single exact-price candidate, in backend/src/domain/orders/match-order.spec.ts"
Task: "Domain unit test: matchOrder combines multiple FIFO candidates to fully cover quantity, in backend/src/domain/orders/match-order.spec.ts"
Task: "Domain unit test: matchOrder partially covers quantity, leaving a remainder, in backend/src/domain/orders/match-order.spec.ts"
Task: "Domain unit test: matchOrder returns no fills when no same-price opposite-side candidate exists, in backend/src/domain/orders/match-order.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1–3 only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks everything)
3. Complete Phase 3: US1 (reserved username)
4. Complete Phase 4: US2 (superuser seed/liquidity)
5. Complete Phase 5: US3 (auto-priced order creation, no matching)
6. **STOP and VALIDATE**: orders can be created with the right price, superuser has liquidity, username is reserved — demoable even without matching
7. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → test independently → demo (reserved username enforced)
3. US2 → test independently → demo (superuser liquidity exists)
4. US3 → test independently → demo (orders get auto-computed prices)
5. US4 → test independently → demo (orders actually match and execute)
6. US5 → test independently → demo (holdings/transactions are auditable)
7. Polish → frontend "Comprar"/"Vender" UI, docs, final build/arch checks

---

## Notes

- `[P]` tasks touch different files and have no unmet dependency
- `[Story]` labels trace each task back to spec.md's five user stories
- Per constitución Principio IX: domain tests run without NestJS/DB; integration/e2e tests run against ephemeral Testcontainers PostgreSQL, never the dev database
- Per constitución Principio IX: no existing test may be modified or deleted to make it pass without explicit permission
- Per constitución Principio VI: the matching transaction (T072–T073, T078–T079) must be all-or-nothing — no partial application on error
- Commit after each task or logical group; stop at any checkpoint to validate a story independently
