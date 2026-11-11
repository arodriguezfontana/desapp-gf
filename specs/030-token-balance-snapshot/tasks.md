---

description: "Task list for Snapshot de saldo en la auditoría de tokens"

---

# Tasks: Snapshot de saldo en la auditoría de tokens

**Input**: Design documents from `specs/030-token-balance-snapshot/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/backfill-cli.md](./contracts/backfill-cli.md), [quickstart.md](./quickstart.md)

**Tests**: Incluidos y obligatorios — el Principio IX exige casos felices y borde, tests de dominio sin Nest ni base, integración y e2e con PostgreSQL efímero de Testcontainers, y el test de arquitectura tsarch existente (`backend/test/architecture.spec.ts`) cubre las capas nuevas sin cambios. **Ningún test existente se modifica ni se borra en el paso 1 (Fases 1 a 5 y Polish)**: todo test nuevo va en un archivo nuevo. El **paso 2** (Fase 6) sí requiere modificar tests existentes y por eso está **bloqueado hasta recibir un "sí" explícito**.

**Organization**: Tareas agrupadas por user story de `spec.md`. US1 (movimientos de órdenes con saldo anterior/posterior) y US2 (emisión inicial auditada) son P1; US3 (backfill de históricos) es P2. Las piezas de dominio y de esquema que bloquean a todas las historias están en Foundational. La Fase 6 (paso 2, `NOT NULL`) es un cierre gateado que **no se ejecuta en `/speckit-implement`** sin autorización.

**⚠️ Antes de cualquier tarea que corra integración o e2e** (T014, T024, T031, T037, T044, T045, T046): ejecutar `docker info`. Si Docker está apagado, el setup de tests cae en silencio a la base de desarrollo y los tests **borran datos** (ya pasó). Si está apagado, levantar Docker Desktop y esperar a que `docker info` responda antes de correr nada.

**Cómo correr un test puntual**: `pnpm test:unit` y `--selectProjects` consumen todos los argumentos siguientes como nombres de proyecto. Usar `pnpm exec jest --selectProjects unit --testPathPatterns "<patrón>"` (unit/integration) y `pnpm exec jest --runInBand --config ./test/jest-e2e.json --testPathPatterns "<patrón>"` (e2e), siempre desde `backend/`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias)
- **[Story]**: US1 (movimientos de órdenes), US2 (emisión inicial), US3 (backfill de históricos)
- Rutas exactas en cada descripción, siguiendo la estructura de `plan.md`
- Todo el trabajo es en `backend/`; los comandos `pnpm` se corren desde `backend/`. No se hace `git commit` (el usuario commitea)
- Comentarios y mensajes en español; identificadores de código en inglés (Principio XI)

## Path Conventions

Monorepo existente. Backend NestJS por capas: `backend/src/domain/` (sin Nest ni TypeORM), `backend/src/repositories/`, `backend/src/services/`, `backend/src/modules/`, `backend/src/database/` (migraciones y backfill), `backend/scripts/` (CLI), `backend/test/` (e2e). Esta feature no toca `frontend/`, Swagger ni Postman (ningún endpoint cambia).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Línea base y una extracción previa que evita conflictos de edición después

- [X] T001 Verificar la línea base desde `backend/`: `docker info` responde, `pnpm test:unit` y `pnpm build` en verde, y `git status` sin cambios pendientes en `backend/src` ni `backend/test`. Anotar el resultado (cantidad de suites/tests) para distinguir regresiones de esta feature
- [X] T002 Crear `backend/src/domain/auth/superuser.ts` exportando `export const SUPERUSER_USERNAME = 'superuser';` y, en `backend/src/services/auth/superuser-seed.service.ts`, reemplazar la constante privada `SUPERUSER_USERNAME` por el import (sin ningún otro cambio de comportamiento). Lo usa el backfill (US3) y se hace acá porque US2 también edita ese servicio

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Captura del snapshot en `TokenHolding`, función de cadena de saldos, extensión de `TokenTransaction`, entidad/mapper nullables y migración de esquema. Bloquea todas las historias

**⚠️ CRITICAL**: Ninguna historia puede empezar hasta terminar esta fase

- [X] T003 [P] Escribir primero `backend/src/domain/portfolio/token-holding-snapshot.spec.ts` (archivo **nuevo**; no se toca `token-holding.spec.ts`; sin Nest ni base; debe fallar hasta T006): `applyCredit(q)` sobre una tenencia con 10 devuelve `{ holding.quantity: 15, snapshot: { before: 10, after: 15 } }`; `applyDebit(4)` sobre 10 → `before 10, after 6`; sobre `createEmpty` (saldo 0) un `applyCredit(3)` → `before 0, after 3`; un débito que deja 0 → `after 0` válido; un débito mayor al saldo lanza `InsufficientHoldingError`; cantidad 0, negativa o no entera lanza `InsufficientHoldingError`; `credit(q)` y `debit(q)` devuelven el mismo holding que `applyCredit(q).holding` / `applyDebit(q).holding`; la instancia original no muta
- [X] T004 [P] Escribir primero `backend/src/domain/orders/balance-chain.spec.ts` (nuevo, falla hasta T007): `orderForChain` ordena por `createdAt` ascendente, a igual instante CREDIT antes que DEBIT y a igualdad total por `id` ascendente, es determinista (mismo resultado con la entrada desordenada de distintas formas) y no muta la entrada; `chainBalances(opening, movements)` devuelve `{ before, after }` encadenados (cada `before` = `after` previo; ej. apertura 10, CREDIT 5, DEBIT 12 → `[10→15, 15→3]`), con apertura 0 y lista vacía devuelve `[]`, y lanza `NegativeBalanceChainError` si algún saldo quedaría negativo (ej. apertura 0, DEBIT 1)
- [X] T005 [P] Escribir primero `backend/src/domain/orders/token-transaction-snapshot.spec.ts` (nuevo, falla hasta T008; no se toca `token-transaction.spec.ts`): `TokenTransaction.create` sin saldos (como lo llaman los tests y el código existentes) sigue funcionando y deja `balanceBefore`/`balanceAfter` en `null`; con saldos los expone; `orderId` y `counterpartOrderId` aceptan `null`; `isEmission` es `true` sólo cuando `orderId` es `null`; la entidad no expone ningún método de edición (inmutable)
- [X] T006 Agregar a `backend/src/domain/portfolio/token-holding.ts` el tipo `MovementSnapshot { before: number; after: number }` y los métodos `applyCredit(quantity)` y `applyDebit(quantity)` que devuelven `{ holding, snapshot }` (before = `this.quantity`, after = `holding.quantity`, mismas validaciones y mismos errores que hoy); reescribir `credit` y `debit` como `applyX(quantity).holding` para que haya un solo camino de cálculo. Firmas de `credit`/`debit` sin cambios (depende de T003)
- [X] T007 Crear `backend/src/domain/orders/balance-chain.ts` con `ChainMovement` (`{ id: string; type: TokenTransactionType; quantity: number; createdAt: Date }`), `orderForChain` y `chainBalances` según T004, y `backend/src/domain/orders/errors/negative-balance-chain.error.ts` con `NegativeBalanceChainError` (mismo estilo que los demás errores de `domain/orders/errors/`). Sin imports de Nest ni TypeORM (depende de T004)
- [X] T008 Editar `backend/src/domain/orders/token-transaction.ts` (depende de T005): agregar `balanceBefore` y `balanceAfter` (opcionales en `create`, getters `number | null`), cambiar `orderId` y `counterpartOrderId` a `string | null` (opcionales en `create`), agregar el getter `isEmission` (`orderId === null`), y actualizar el comentario de cabecera (Principio V: el asiento ahora trae estado anterior y posterior). `create` debe seguir aceptando exactamente las llamadas actuales; **no** tocar todavía `pairFromFill` (eso es T020)
- [X] T009 [P] Editar `backend/src/repositories/orders/entities/token-transaction.entity.ts`: agregar `balanceBefore` (`name: 'balance_before'`, `type: 'integer'`, `nullable: true`) y `balanceAfter` (`name: 'balance_after'`, ídem), y marcar `orderId` y `counterpartOrderId` como `nullable: true` (tipo `string | null`). Documentar en el comentario que los saldos son `nullable` hasta el paso 2 porque en desarrollo y tests `synchronize` toma el esquema de esta entidad (plan §Riesgos)
- [X] T010 Editar `backend/src/repositories/orders/mappers/token-transaction.mapper.ts` (depende de T008, T009): mapear en ambos sentidos `balanceBefore`/`balanceAfter` y los dos ids nullables (`null` ⇄ `null`, sin convertir a cadena vacía)
- [X] T011 Corregir los errores de compilación que deje T008 en los consumidores de `orderId`/`counterpartOrderId`, empezando por `backend/src/controllers/orders/dto/token-transaction-response.dto.ts` (`fromDomain` debe seguir exponiendo `counterpartOrderId: string`; agregar un comentario: el historial sólo lee asientos con orden, ver T028, y usar un aserto de no nulo documentado). Correr `pnpm build` para encontrar cualquier otro consumidor. **No** cambiar el contrato Swagger del DTO ni modificar tests existentes
- [X] T012 [P] Escribir primero `backend/src/database/migration-specs/token-balance-snapshot-migration.integration.spec.ts` (nuevo, Testcontainers; mismo patrón que `backend/src/database/migration-specs/add-role-migration.integration.spec.ts`; el spec vive **fuera** de `database/migrations/` a propósito): sobre una tabla `token_transactions` creada como en `1792040000004-CreateTokenTransactions.ts` (con `NOT NULL` en los ids de orden), `up` agrega `balance_before` y `balance_after` (`integer`, nullable), deja `order_id` y `counterpart_order_id` aceptando `NULL`, conserva las filas existentes (con saldos `NULL`), y es idempotente (correr `up` dos veces no falla); `down` quita las dos columnas
- [X] T013 Crear `backend/src/database/migrations/1793100000000-AddBalanceSnapshotToTokenTransactions.ts` (depende de T012): `up` con `ALTER TABLE "token_transactions" ADD COLUMN IF NOT EXISTS "balance_before" integer` y `... "balance_after" integer`, y `ALTER COLUMN "order_id" DROP NOT NULL` / `"counterpart_order_id" DROP NOT NULL` (idempotentes); `down` con `DROP COLUMN IF EXISTS` de las dos columnas (los ids de orden se dejan nullables y se documenta). Comentario de cabecera en español: producción corre sólo migraciones (sin `synchronize`) y la entidad es la fuente en desarrollo/tests
- [X] T014 Verificar la fase: `docker info` primero; luego `pnpm exec jest --selectProjects unit --testPathPatterns "token-holding-snapshot|balance-chain|token-transaction-snapshot"`, `pnpm exec jest --selectProjects integration --testPathPatterns "token-balance-snapshot-migration"` y `pnpm build`; confirmar además que los specs existentes `token-holding.spec`, `token-transaction.spec` y `settle-fills.spec` siguen en verde sin tocarlos

**Checkpoint**: Dominio y esquema listos; las historias pueden empezar

---

## Phase 3: User Story 1 - Cada movimiento de una operación queda con su saldo anterior y posterior (Priority: P1) 🎯 MVP

**Goal**: Todo asiento creado por la ejecución de órdenes (y por la siembra de simulación) trae `balance_before`/`balance_after` capturados en el momento, en la misma transacción que la tenencia, con cadena continua también en varios fills y en auto-cruce

**Independent Test**: Un usuario con 10 tokens compra 5 y otro con 10 vende 4: sus asientos traen 10→15 y 10→6; una orden con varias contrapartes deja una cadena continua; si la operación falla a mitad, no queda ningún asiento ni cambia ninguna tenencia

### Tests for User Story 1 ⚠️

> Escribirlos primero y verificar que fallan antes de implementar

- [X] T015 [P] [US1] Crear `backend/src/domain/orders/settle-fills-audited.spec.ts` (nuevo; no se toca `settle-fills.spec.ts`; sin Nest ni base; falla hasta T019): un fill (comprador con 10, vendedor con 10, cantidad 5) → `snapshots[0].buyer = 10→15`, `seller = 10→5`; comprador sin tenencia previa (holding vacío) → `0→3`; dos fills sobre el mismo comprador → el segundo `buyer.before` es el `buyer.after` del primero; **auto-cruce** (mismo usuario comprador y vendedor, saldo 10, cantidad 4) → `buyer 10→14` y `seller 14→10`; `holdings` devuelto idéntico al de `settleFills` para los mismos datos; un débito que dejaría saldo negativo lanza `InsufficientHoldingError`; no muta los holdings recibidos
- [X] T016 [US1] Ampliar `backend/src/domain/orders/token-transaction-snapshot.spec.ts` (el archivo **nuevo** de T005; depende de T005) con los casos de `pairFromFill(fill, playerId, createdAt, newId, snapshot)`: devuelve el CREDIT del comprador con `balanceBefore/After` de `snapshot.buyer` y el DEBIT del vendedor con los de `snapshot.seller`; para cada asiento se cumple `after = before ± quantity`; sin el parámetro `snapshot` sigue devolviendo los asientos como hoy (saldos `null`), de modo que los llamadores existentes no cambian
- [X] T017 [P] [US1] Crear `backend/src/services/simulation/simulation-balances.spec.ts` (nuevo; falla hasta T022): dado un conjunto de movimientos sembrados de varios usuarios y jugadores en distintos instantes, `buildSimulationSnapshots(movements, openingFor)` devuelve para cada movimiento su `{ before, after }` encadenado por (usuario, jugador) en orden cronológico (usando `orderForChain`), con apertura 0 para el admin y `BOT_INITIAL_HOLDING` (250) para los bots; ningún saldo negativo; el resultado no depende del orden de entrada; un movimiento que dejaría saldo negativo lanza `NegativeBalanceChainError`
- [X] T018 [US1] Crear `backend/test/token-balance-snapshot.e2e-spec.ts` con el `describe` de US1 (sobre `createTestApp()`; reutilizar el armado de usuarios, jugadores y tenencias de `backend/test/orders-matching.e2e-spec.ts`; leer los asientos con `ctx.dataSource.getRepository(TokenTransactionEntity)`): comprador con 10 compra 5 → CREDIT 10→15 y vendedor con 10 vende 4→ DEBIT 10→6 (ambos asientos de la misma orden); comprador sin tenencia previa → 0→n; una orden que cruza con **varias contrapartes** deja, por tenencia, una cadena continua (cada `balance_before` = `balance_after` previo) y el último `balance_after` = `token_holdings.quantity`; **auto-cruce**: no es alcanzable por la API (la búsqueda de contrapartes excluye las órdenes propias), se cubre en `settle-fills-audited.spec.ts` (T015); para todo asiento `after = before ± quantity` y ningún saldo negativo; **atomicidad**: forzar una falla en medio de la operación (p. ej. `jest.spyOn(TokenTransactionRepository.prototype, 'saveInTransaction')` rechazando en la segunda llamada) → la respuesta es error y no queda ningún asiento nuevo ni cambia ninguna tenencia ni orden; los demás `describe` (US2) se agregan a este mismo archivo

### Implementation for User Story 1

- [X] T019 [US1] Agregar a `backend/src/domain/orders/settle-fills.ts` la función `settleFillsAudited(fills, holdings)` que devuelve `{ holdings: Map<string, TokenHolding>, snapshots: Array<{ buyer: MovementSnapshot; seller: MovementSnapshot }> }` usando `applyCredit`/`applyDebit` de T006, leyendo el holding justo antes de cada operación (necesario en el auto-cruce); reescribir `settleFills` para que delegue (`settleFillsAudited(...).holdings`) sin cambiar su firma ni su resultado (depende de T006, T015)
- [X] T020 [US1] Editar `backend/src/domain/orders/token-transaction.ts` (depende de T008, T016, T019): `pairFromFill(fill, playerId, createdAt, newId, snapshot?)` con `snapshot?: { buyer: MovementSnapshot; seller: MovementSnapshot }` opcional como último parámetro; si viene, cada asiento lleva sus `balanceBefore/After`. Sin `snapshot` el comportamiento es idéntico al actual
- [X] T021 [US1] Editar `backend/src/services/orders/orders.service.ts` (depende de T019, T020): dentro del mismo `TransactionManager.run` de `create`, reemplazar `settleFills(...)` por `settleFillsAudited(...)` y pasar a `TokenTransaction.pairFromFill(...)` el snapshot del fill correspondiente (mismo índice que `matchPlan.fills`). No abrir una transacción nueva ni cambiar el orden de locks, de guardado ni la respuesta del endpoint
- [X] T022 [US1] Crear `backend/src/services/simulation/simulation-balances.ts` (depende de T017, T007) con `buildSimulationSnapshots(movements, openingFor)` según T017, reutilizando `orderForChain` y `chainBalances`
- [X] T023 [US1] Editar `backend/src/services/simulation/market-simulation.service.ts`, método `seedTransactionsAndHoldings` (depende de T022): antes de guardar, calcular con `buildSimulationSnapshots` los saldos de cada `TokenTransaction` sembrado (admin con apertura 0; bots con apertura `BOT_INITIAL_HOLDING`) y pasarlos a `TokenTransaction.create({ ..., balanceBefore, balanceAfter })`. **No** cambiar qué se siembra ni las cantidades de las tenencias (`saveHoldingQuantity` queda igual: la tenencia de los bots no se reconcilia con sus asientos y eso queda documentado en un comentario, plan §Riesgos). No modificar `market-simulation.service.spec.ts`
- [X] T024 [US1] Verificar US1: `docker info` primero; luego `pnpm exec jest --selectProjects unit --testPathPatterns "settle-fills|token-transaction|simulation|orders.service"` (incluye los specs existentes de esas áreas, que deben seguir en verde sin tocarlos) y `pnpm exec jest --runInBand --config ./test/jest-e2e.json --testPathPatterns "token-balance-snapshot|orders-matching"`; confirmar en la salida que corrió sobre Testcontainers

**Checkpoint**: Las órdenes ejecutadas y la siembra dejan asientos con saldos; es el MVP medible de la feature

---

## Phase 4: User Story 2 - La emisión inicial también queda auditada (Priority: P1)

**Goal**: La emisión inicial de 100 tokens por jugador al superusuario deja un asiento CREDIT 0→100 sin orden ni contraparte, de forma atómica con la tenencia y su orden de venta, sin cambiar el historial de operaciones ni el costo promedio del portafolio

**Independent Test**: Provisionar la liquidez inicial sobre una base limpia con jugadores → un asiento 0→100 por jugador provisionado; reiniciar no agrega ninguno; la primera venta del superusuario parte de 100; `GET /orders/history` y el portafolio quedan idénticos

### Tests for User Story 2 ⚠️

- [X] T025 [P] [US2] Crear `backend/src/domain/orders/token-emission.spec.ts` (nuevo, sin Nest ni base; falla hasta T027): `INITIAL_EMISSION_QUANTITY` vale 100; `issueInitialEmission({ userId, playerId, price, createdAt, newId })` devuelve un `holding` con 100 tokens (mismo `userId`/`playerId`) y un `entry` CREDIT por 100 con `balanceBefore 0`, `balanceAfter 100`, `orderId null`, `counterpartOrderId null`, `isEmission true`, el `price` recibido y `createdAt` recibido; usa `newId` para el id del asiento
- [X] T026 [US2] Ampliar `backend/test/token-balance-snapshot.e2e-spec.ts` (archivo creado en T018; depende de T018) con el `describe` de US2 (reutilizar el armado de `backend/test/superuser-seed.e2e-spec.ts` para configurar `SUPERUSER_EMAIL`/`SUPERUSER_PASSWORD`, el catálogo de jugadores y `ctx.app.get(SuperuserSeedService).run()`): sobre una base limpia, `run()` deja **un asiento CREDIT por jugador provisionado** con `quantity 100`, `balance_before 0`, `balance_after 100`, `order_id` y `counterpart_order_id` nulos, y la tenencia con 100; volver a llamar `run()` no agrega asientos ni cambia tenencias (idempotente); la primera venta del superusuario (una orden que cruza contra su orden de venta inicial) deja un DEBIT que parte de 100 (`100→90` para una venta de 10) y el último `balance_after` = tenencia; **atomicidad de la emisión**: forzar una falla al guardar la orden o el asiento (espía sobre `OrderRepository.saveInTransaction` o `TokenTransactionRepository.saveInTransaction`) → no queda ni tenencia, ni orden, ni asiento de ese jugador; **contratos sin cambio**: con el asiento de emisión presente, `GET /orders/history` del superusuario no lo incluye y el costo promedio de compra de su portafolio no lo cuenta (comparar contra los valores esperados sin emisión)

### Implementation for User Story 2

- [X] T027 [US2] Crear `backend/src/domain/orders/token-emission.ts` (depende de T025, T006, T008) con `INITIAL_EMISSION_QUANTITY = 100` y `issueInitialEmission(...)` según T025, construyendo el holding con `TokenHolding.createEmpty(userId, playerId).applyCredit(INITIAL_EMISSION_QUANTITY)` y el asiento con `TokenTransaction.create` (snapshot = el que devuelve `applyCredit`, no un valor recalculado). Sin imports de Nest ni TypeORM
- [X] T028 [US2] Editar `backend/src/repositories/orders/token-transaction.repository.ts` (depende de T010): `findByUserId` y `findCreditsByUserId` agregan `orderId: Not(IsNull())` al `where` (importar `Not` e `IsNull` de `typeorm`), con un comentario en español que explique por qué (el asiento de emisión no es una operación de compraventa: ni historial ni costo promedio, FR-017). Es el punto que mantiene intactos `GET /orders/history`, el portafolio y el chequeo de siembra de simulación
- [X] T029 [US2] Editar `backend/src/modules/orders/orders.module.ts`: agregar `TransactionManager` a `exports` (hoy sólo se provee). Verificar con `pnpm build` y un arranque que `AuthModule` (que ya importa `OrdersModule` por `forwardRef`) puede inyectarlo
- [X] T030 [US2] Editar `backend/src/services/auth/superuser-seed.service.ts` (depende de T027, T028, T029, T002): inyectar `TransactionManager` y `TokenTransactionRepository`; reescribir `provisionPlayer` para (1) mantener el chequeo de idempotencia (`existing && existing.quantity > 0` → no hace nada), (2) resolver el precio (`resolvePrice`) **antes** de abrir la transacción, y (3) dentro de `TransactionManager.run`, guardar la orden de venta inicial con `orders.saveInTransaction`, el holding con `holdings.saveInTransaction` y el asiento con `tokenTransactions.saveInTransaction`, usando `issueInitialEmission` (con `INITIAL_EMISSION_QUANTITY` en lugar de la constante local `INITIAL_HOLDING_QUANTITY`, que se elimina). El resto del servicio (alta del superusuario, `ensureLiquidity`, logs) no cambia
- [X] T031 [US2] Verificar US2: `docker info` primero; luego `pnpm exec jest --selectProjects unit --testPathPatterns "token-emission|portfolio.service|orders.service"` y `pnpm exec jest --runInBand --config ./test/jest-e2e.json --testPathPatterns "token-balance-snapshot|superuser-seed|orders-matching|portfolio"`; los e2e existentes de seed, matching y portafolio deben seguir en verde sin tocarlos

**Checkpoint**: Todo movimiento nuevo (órdenes, emisión, siembra) queda auditado con saldos; el log nuevo es completo de punta a punta

---

## Phase 5: User Story 3 - Los asientos históricos se completan con un backfill (Priority: P2)

**Goal**: Un script re-ejecutable completa los saldos de los asientos anteriores a esta feature, tenencia por tenencia, validando contra el saldo real, sin inventar valores ni sobrescribir

**Independent Test**: Sobre una base con asientos legacy conocidos, el script completa cada cadena (último saldo = tenencia), es idempotente, deja intactas y reporta las inconsistentes (código de salida 1), y reconoce la emisión histórica del superusuario

### Tests for User Story 3 ⚠️

- [X] T032 [P] [US3] Crear `backend/src/domain/orders/balance-chain-reconstruction.spec.ts` (nuevo, sin Nest ni base; falla hasta T034) para `reconstructHoldingChain({ pending, closingBalance, isSuperuser })` (algoritmo en [research.md](./research.md) §5.1): apertura 0 con compras y ventas intercaladas → `status ok` y snapshots esperados exactos, el último `after` = `closingBalance`; el orden se desempata con `orderForChain` (CREDIT antes que DEBIT al mismo instante) y el resultado no depende del orden de entrada; `isSuperuser` con `closing − neto = 100` → `ok` con `opening 100` (ej. emisión 100, DEBIT 10 → `100→90`); la misma situación con `isSuperuser: false` → `inconsistent` (`opening-mismatch`); apertura distinta de 0 y de 100 (p. ej. 250) incluso para el superusuario → `inconsistent` con `opening`, `net` y `closingBalance` informados; una cadena que cruzaría saldo negativo → `inconsistent` (`negative-balance`); sin asientos pendientes → `ok` vacío; determinismo (misma entrada, mismo resultado)
- [X] T033 [P] [US3] Crear `backend/src/database/backfill/backfill-token-balances.integration.spec.ts` (nuevo, Testcontainers; falla hasta T035; el spec vive en `database/backfill/`, **fuera** de `database/migrations/`): sembrar con SQL/entidades un dataset con movimientos conocidos de varios usuarios y jugadores, saldos en `NULL`, y las tenencias con su cantidad final; verificar que `backfillTokenBalances(dataSource)` (a) completa cada asiento con los valores esperados exactos y que el último `balance_after` de cada tenencia = `token_holdings.quantity`; (b) **no sobrescribe**: un asiento que ya tenía saldos conserva los suyos; (c) es **idempotente**: una segunda corrida reporta todo como ya completo y no cambia ni una fila; (d) una tenencia inconsistente (cantidad actual alterada) queda **sin tocar**, se reporta con su causa y las tenencias sanas **sí** se completan en la misma corrida; (e) el superusuario (`username = 'superuser'`) con emisión histórica no auditada (primer asiento DEBIT, tenencia = 100 − neto) se completa con apertura 100; (f) una tenencia mixta (asientos legacy + asientos nuevos con saldos) cierra contra el `balance_before` del primer asiento nuevo; (g) `dryRun: true` calcula y reporta pero no escribe nada; (h) la cantidad de asientos y todos los campos distintos de los dos saldos son idénticos antes y después

### Implementation for User Story 3

- [X] T034 [US3] Agregar `reconstructHoldingChain` a `backend/src/domain/orders/balance-chain.ts` (depende de T032, T007, T027 para `INITIAL_EMISSION_QUANTITY`): recibe `pending` (asientos con `type`, `quantity`, `createdAt`, `id`), `closingBalance` y `isSuperuser`; calcula `net` (Σ CREDIT − Σ DEBIT), `opening = closingBalance − net`, acepta `opening === 0` o (`isSuperuser` y `opening === INITIAL_EMISSION_QUANTITY`), aplica `orderForChain` + `chainBalances` y devuelve `{ status: 'ok', opening, snapshots }` o `{ status: 'inconsistent', reason: 'opening-mismatch' | 'negative-balance', opening, net, closingBalance }` (captura `NegativeBalanceChainError`). Pura, sin Nest ni TypeORM
- [X] T035 [US3] Crear `backend/src/database/backfill/backfill-token-balances.ts` (depende de T033, T034, T002) exportando `backfillTokenBalances(dataSource, { dryRun?: boolean })` que devuelve el informe (`tenencias`, `aplicadas`, `yaCompletas`, `inconsistentes[]` con `userId`, `playerId`, `reason`, `opening`, `net`, `closingBalance`, y `asientosActualizados`) según [contracts/backfill-cli.md](./contracts/backfill-cli.md) y [research.md](./research.md) §5.1, con SQL crudo vía el `DataSource`: listar las tenencias con asientos pendientes (`balance_before IS NULL OR balance_after IS NULL`); por cada una, una **transacción propia** que toma `SELECT … FROM token_holdings … FOR UPDATE` (sin fila = saldo 0), lee sus asientos, define `closingBalance` como el `balance_before` del primer asiento ya completo (ordenado con `orderForChain`) o, si no hay, la cantidad actual, resuelve `isSuperuser` comparando el `username` del usuario con `SUPERUSER_USERNAME`, llama a `reconstructHoldingChain` y, si es `ok` y no es `dryRun`, hace `UPDATE token_transactions SET balance_before = $1, balance_after = $2 WHERE id = $3 AND balance_before IS NULL AND balance_after IS NULL`; si es `inconsistent` hace rollback y lo acumula sin detener las demás. Nunca inserta ni borra filas ni toca otras columnas
- [X] T036 [US3] Crear el punto de entrada `backend/scripts/backfill-token-balances.ts` (mismo estilo que `backend/scripts/simulate-market.ts`; depende de T035): arma un `DataSource` de `pg` con `DATABASE_URL`, acepta `--dry-run`, imprime una línea por tenencia (`OK`/`OK(dry)`, `YA-COMPLETA`, `INCONSISTENTE …`) y el resumen exactamente como en el contrato, y termina con código 0 (todo aplicado o ya completo), 1 (hubo inconsistentes) o 2 (error de ejecución). Agregar a `backend/package.json` el script `"db:backfill-token-balances": "ts-node scripts/backfill-token-balances.ts"`
- [X] T037 [US3] Verificar US3: `docker info` primero; luego `pnpm exec jest --selectProjects unit --testPathPatterns "balance-chain"` y `pnpm exec jest --selectProjects integration --testPathPatterns "backfill-token-balances"`; confirmar que corrió sobre Testcontainers

**Checkpoint**: Las tres historias funcionan; los históricos se pueden completar y los inconsistentes quedan reportados

---

## Phase 6: Paso 2 — Endurecimiento a `NOT NULL` (gateado; NO ejecutar en `/speckit-implement`)

**Purpose**: Cumplir FR-015 una vez que el backfill terminó limpio en **cada** entorno. Se entrega aparte, en otro cambio. **Estas tareas no se implementan hasta que el usuario (a) confirme que `pnpm db:backfill-token-balances` terminó con código 0 y que `SELECT count(*) FROM token_transactions WHERE balance_before IS NULL OR balance_after IS NULL` da 0 en cada entorno, y (b) autorice explícitamente modificar los tests existentes de T041 (Principio IX).** Si no hay autorización, las columnas siguen nullable y el código nuevo igual las completa siempre

- [X] T038 Gate de entrada (sin cambios de código): confirmar y dejar por escrito en el reporte final el cumplimiento de los dos requisitos del encabezado de esta fase. Si alguno falta, detenerse acá **Resultado: la base de desarrollo tiene 0 asientos (lectura sin escritura) y el usuario autorizó la modificación de tests ("modifica los tests necesarios"); los demás entornos deben correr el backfill antes de desplegar la migración, que falla con un mensaje claro si quedan saldos vacíos.**
- [X] T039 Escribir y luego crear `backend/src/database/migrations/1793100000001-EnforceTokenTransactionBalances.ts` con su test `backend/src/database/migration-specs/enforce-token-balances-migration.integration.spec.ts` (nuevo, Testcontainers): `up` primero cuenta las filas con saldo nulo y, si hay alguna, **lanza** un error en español que apunta a `pnpm db:backfill-token-balances`; si no hay, `ALTER COLUMN "balance_before" SET NOT NULL` y `"balance_after" SET NOT NULL` (y opcionalmente `CHECK >= 0`); `down` los vuelve nullable. El test cubre ambos caminos (con nulos falla sin cambiar nada; sin nulos aplica)
- [X] T040 En `backend/src/repositories/orders/entities/token-transaction.entity.ts` marcar `balance_before`/`balance_after` como `nullable: false`, y en `backend/src/domain/orders/token-transaction.ts` y su mapper volver `balanceBefore`/`balanceAfter` **requeridos** (`number`, no `null`) en `create` y en los getters
- [X] T041 **Requiere "sí" explícito (Principio IX)**: actualizar los tests existentes que construyen asientos sin saldos, con el cambio mínimo de agregar `balanceBefore`/`balanceAfter` (o `balance_before`/`balance_after`): `backend/src/domain/orders/token-transaction.spec.ts` (4 llamadas a `TokenTransaction.create`), `backend/test/portfolio.e2e-spec.ts` (helper `insertCreditTx`) y `backend/test/orders-matching-concurrency.e2e-spec.ts` (1 inserción directa de `TokenTransactionEntity`). Revisar con `pnpm build` y las suites si aparece algún otro. Informar cada test tocado **Resultado: sólo hizo falta tocar `src/domain/orders/token-transaction.spec.ts` (3 llamadas a `pairFromFill`, que ahora exige el snapshot) y `test/portfolio.e2e-spec.ts` (helper `insertCreditTx`). `orders-matching-concurrency.e2e-spec.ts` no inserta asientos, sólo los lee: no se modificó.**

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Cierre según la definición de terminado (Principio X) para el paso 1

- [X] T042 Correr desde `backend/`: `pnpm build` y `pnpm lint`; corregir cualquier error de tipos o de lint (en particular los consumidores de `orderId`/`counterpartOrderId` nullables)
- [X] T043 Correr la suite unitaria completa `pnpm test:unit` (incluye `backend/test/architecture.spec.ts` de tsarch) y confirmar que el dominio nuevo (`balance-chain`, `token-emission`, `settle-fills-audited`) no importa Nest ni TypeORM y que las capas no se violan
- [X] T044 `docker info` primero; correr `pnpm test:integration` completo y confirmar que migración de esquema y backfill pasan junto con las integraciones previas (sobre Testcontainers)
- [X] T045 `docker info` primero; correr la suite e2e completa `pnpm test:e2e` desde `backend/` y confirmar que todos los e2e previos (órdenes, matching, concurrencia, portafolio, seed del superusuario, simulación, historial) siguen en verde y que corrió sobre Testcontainers
- [X] T046 Ejecutar la validación manual de [quickstart.md](./quickstart.md) §2 y §3 contra la base desechable `t030_pg` (puerto 5545, backend en `PORT=3102`): `--dry-run` sin escribir, aplicar, idempotencia, tenencia inconsistente con código de salida 1, superusuario con apertura 100 y las consultas SQL de integridad; al final detener el backend y `docker rm -f t030_pg`. Nunca contra la base de desarrollo
- [X] T047 Confirmar que ningún test existente fue modificado ni borrado en el paso 1: `git status` y `git diff --stat -- "backend/**/*.spec.ts" "backend/test/**"` deben mostrar **sólo archivos nuevos** (los specs creados en esta feature). Reportar cualquier excepción. Dejar los cambios **sin commitear** y proponer al usuario el nombre del commit en español (`feat: …`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias
- **Foundational (Phase 2)**: depende de Setup; **bloquea** todas las historias
- **US1 (Phase 3)**: depende de Foundational
- **US2 (Phase 4)**: depende de Foundational y de US1 sólo por el archivo e2e compartido (T026 amplía lo que crea T018) y por `orders.module`/`token-transaction.ts` ya editados; el código de emisión es independiente del de órdenes
- **US3 (Phase 5)**: depende de Foundational y de US2 (`INITIAL_EMISSION_QUANTITY` de T027 y el asiento de emisión para el caso mixto)
- **Paso 2 (Phase 6)**: depende de US1–US3 **y de la autorización** descrita; no forma parte de la entrega del paso 1
- **Polish (Phase 7)**: depende de las historias del paso 1

### Within Each Story

- Tests primero y fallando, luego implementación
- Dominio puro → repositorio/servicio → cableado de módulos → verificación
- Tareas que editan el mismo archivo van en secuencia: `token-transaction.ts` (T008 → T020), `token-transaction-snapshot.spec.ts` (T005 → T016), `balance-chain.ts` (T007 → T034), `token-balance-snapshot.e2e-spec.ts` (T018 → T026), `superuser-seed.service.ts` (T002 → T030)

### Parallel Opportunities

- Foundational: T003, T004, T005 y T012 en paralelo; luego T006, T007, T009 (en paralelo entre sí) y T008/T010/T011/T013 en su orden
- US1: T015 y T017 en paralelo con T016 (archivos distintos); T019 y T022 en paralelo
- US2: T025 en paralelo con la preparación de T026
- US3: T032 y T033 en paralelo (archivos distintos)

---

## Parallel Example: Foundational

```bash
# Tests nuevos, archivos distintos:
Task: "T003 token-holding-snapshot.spec.ts"
Task: "T004 balance-chain.spec.ts"
Task: "T005 token-transaction-snapshot.spec.ts"
Task: "T012 token-balance-snapshot-migration.integration.spec.ts"
```

---

## Implementation Strategy

### MVP First (US1)

1. Setup + Foundational
2. US1: las órdenes y la siembra ya dejan asientos con saldos
3. **STOP y VALIDAR**: cadena continua, atomicidad y último saldo = tenencia
4. Entregable: la captura hacia adelante; los históricos y la emisión todavía no

### Incremental Delivery

1. Setup + Foundational → dominio y esquema listos
2. US1 → captura en órdenes y siembra (MVP)
3. US2 → emisión auditada y atómica, historial y portafolio intactos
4. US3 → backfill con validación cruzada, ejecutado por entorno
5. Polish → build, lint, suites completas, quickstart manual
6. Paso 2 (aparte, con autorización) → `NOT NULL`

---

## Notes

- [P] = archivos distintos, sin dependencias
- [Story] mapea la tarea a su historia de `spec.md`
- Riesgo conocido (plan): `synchronize` en dev/tests toma el esquema de la entidad; la entidad queda `nullable` hasta el paso 2
- Los datos de simulación antiguos (bots con 250 tokens fijados con `withQuantity`) no cierran la validación del backfill: es esperable y se reporta
- Principio V: el backfill hace `UPDATE` sólo de `NULL` a valor; desvío registrado en `plan.md` (Complexity Tracking)
- Principio IX: ningún test existente se modifica en el paso 1; T041 necesita autorización explícita
- Detenerse en cada checkpoint para validar la historia
