# Tasks: Estrategias de Valuación de Jugadores

**Input**: Design documents from `specs/012-valuation-strategies/`

**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/quotes-api.md ✅ · quickstart.md ✅

**Tests**: Incluidos — requeridos por Principio IX de la constitución y por SC-001 del spec.

**Organization**: Tareas agrupadas por user story para implementación y validación independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias de tareas incompletas)
- **[Story]**: A qué user story pertenece la tarea (US1–US4)
- Rutas basadas en la estructura definida en `plan.md`

---

## Phase 1: Setup (Infraestructura compartida)

**Purpose**: Crear la estructura de directorios del módulo Quotation.

- [X] T001 Crear estructura de directorios del módulo: `backend/src/domain/quotation/errors/`, `backend/src/repositories/quotation/entities/`, `backend/src/services/quotation/`, `backend/src/controllers/quotation/`, `backend/src/modules/quotation/`

---

## Phase 2: Foundational (Prerequisitos bloqueantes)

**Purpose**: Dominio, entidades TypeORM y esquema de base de datos listos antes de implementar cualquier user story.

**⚠️ CRÍTICO**: Ninguna user story puede comenzar hasta que esta fase esté completa.

- [X] T002 [P] Crear errores de dominio en `backend/src/domain/quotation/errors/`: `invalid-strategy-weights.error.ts` (InvalidStrategyWeightsError), `no-active-strategy.error.ts` (NoActiveStrategyError), `recalculation-in-progress.error.ts` (RecalculationInProgressError) — todos extienden `DomainError`
- [X] T003 [P] Registrar los tres errores nuevos en `backend/src/shared/filters/all-exceptions.filter.ts` con sus status codes: `InvalidStrategyWeightsError` → 422, `NoActiveStrategyError` → 422, `RecalculationInProgressError` → 409
- [X] T004 [P] Crear clase de dominio `ValuationStrategy` en `backend/src/domain/quotation/valuation-strategy.ts`: campos `id`, `name`, `weights: Record<string, number>`, `factorEscala`, `isActive`; métodos `create()` (valida suma pesos ±0.001 y factorEscala > 0), `restore()`, `activate()`, `deactivate()`
- [X] T005 [P] Crear clase de dominio `PlayerQuote` en `backend/src/domain/quotation/player-quote.ts`: campos `id`, `playerId`, `strategyId`, `weightSnapshot`, `factorEscalaSnapshot`, `score`, `value`, `calculatedAt`; método `restore()`
- [X] T006 [P] Crear constante `NORMALIZATION_BOUNDS` y función pura `calculatePlayerValue(player, strategy)` en `backend/src/domain/quotation/calculate-player-value.ts`: normaliza métricas a [0,1] usando los bounds; calcula score = Σ(peso × normalizado); retorna `{ score, value: 1 + score × factorEscala }`. Métricas null → 0; valores por encima del bound → clamp a 1.0.
- [X] T007 [P] Crear entidad TypeORM `ValuationStrategyEntity` en `backend/src/repositories/quotation/entities/valuation-strategy.entity.ts`: tabla `valuation_strategies`; columnas `id` (uuid PK), `name` (varchar 120), `weights` (jsonb), `factor_escala` (DECIMAL 10,4), `is_active` (boolean), `created_at` (timestamptz)
- [X] T008 [P] Crear entidad TypeORM `PlayerQuoteEntity` en `backend/src/repositories/quotation/entities/player-quote.entity.ts`: tabla `player_quotes`; columnas `id` (uuid PK), `player_id` (uuid FK players), `strategy_id` (uuid FK valuation_strategies), `weight_snapshot` (jsonb), `factor_escala_snapshot` (DECIMAL 10,4), `score` (DECIMAL 8,6), `value` (DECIMAL 10,2), `calculated_at` (timestamptz)
- [X] T009 Crear migration de schema en `backend/src/database/migrations/<timestamp>-CreateQuotationTables.ts`: `CREATE TABLE valuation_strategies` y `CREATE TABLE player_quotes` con sus columnas, constraints e índices (`WHERE is_active = true` en strategies; `(player_id, calculated_at DESC)` en quotes). Incluir `down()` que borra ambas tablas.
- [X] T010 [P] Definir interfaz `IValuationStrategyRepository` en `backend/src/repositories/quotation/valuation-strategy.repository.ts`: métodos `findActive(): Promise<ValuationStrategy | null>`, `findById(id): Promise<ValuationStrategy | null>`, `save(strategy): Promise<ValuationStrategy>`, `activateStrategy(id): Promise<ValuationStrategy>`
- [X] T011 [P] Definir interfaz `IPlayerQuoteRepository` en `backend/src/repositories/quotation/player-quote.repository.ts`: métodos `save(quote): Promise<PlayerQuote>`, `saveMany(quotes): Promise<void>`, `findLatestByPlayerId(playerId): Promise<PlayerQuote | null>`
- [X] T012 Agregar método `findAllActive(): Promise<Player[]>` a la interfaz `IPlayerRepository` en `backend/src/repositories/player/player.repository.ts` y su implementación en `backend/src/repositories/player/typeorm-player.repository.ts`: `WHERE removed_at IS NULL` sin paginación
- [X] T013 Verificar que `synchronize: true` en `database.module.ts` reconoce las nuevas entidades (agregar `ValuationStrategyEntity` y `PlayerQuoteEntity` al array de entidades del módulo TypeORM)

**Checkpoint**: Dominio compila, entidades TypeORM definidas, schema creado por migration, interfaces definidas. Listo para user stories.

---

## Phase 3: User Story 1 — Calcular cotización con estrategia activa (Priority: P1) 🎯 MVP

**Goal**: La función pura de cálculo produce el valor correcto de un jugador para cualquier combinación de métricas y pesos, verificable sin base de datos.

**Independent Test**: Ejecutar `pnpm -C backend test:unit --testPathPattern=calculate-player-value` — todos los tests en verde.

### Tests para User Story 1

- [X] T014 [P] [US1] Crear tests unitarios de `calculatePlayerValue` en `backend/src/domain/quotation/__tests__/calculate-player-value.spec.ts`: casos — jugador con todas las métricas completas, jugador con métricas null (→ 0), métrica que supera el bound (→ clamp 1.0), estrategia con pesos negativos (score puede ser negativo, value < 1 aceptado), verificación de `value = 1 + score × factorEscala`, verificación con datos exactos de "Performance general" y un jugador conocido
- [X] T015 [P] [US1] Crear tests unitarios de `ValuationStrategy` en `backend/src/domain/quotation/__tests__/valuation-strategy.spec.ts`: `create()` válida suma 1.0 ±0.001 y lanza `InvalidStrategyWeightsError` fuera de tolerancia; `create()` rechaza `factorEscala ≤ 0`; `activate()` / `deactivate()` retornan nuevas instancias sin mutar; pesos negativos válidos si suma algebraica ∈ [0.999, 1.001]

### Implementación para User Story 1

- [X] T016 [P] [US1] Crear `ValuationStrategyMapper` en `backend/src/repositories/quotation/valuation-strategy.mapper.ts`: `toDomain(entity): ValuationStrategy` usando `ValuationStrategy.restore()`; `toPersistence(domain): ValuationStrategyEntity`
- [X] T017 [P] [US1] Crear `PlayerQuoteMapper` en `backend/src/repositories/quotation/player-quote.mapper.ts`: `toDomain(entity): PlayerQuote` y `toPersistence(domain): PlayerQuoteEntity`
- [X] T018 [US1] Crear `TypeOrmValuationStrategyRepository` en `backend/src/repositories/quotation/typeorm-valuation-strategy.repository.ts`: implementa `IValuationStrategyRepository`; `findActive()` busca `WHERE is_active = true`; `activateStrategy(id)` usa `QueryRunner` para desactivar todas y activar la indicada en la misma transacción
- [X] T019 [US1] Crear `TypeOrmPlayerQuoteRepository` en `backend/src/repositories/quotation/typeorm-player-quote.repository.ts`: implementa `IPlayerQuoteRepository`; `saveMany()` hace `INSERT` en batch
- [X] T020 [US1] Crear migration seed en `backend/src/database/migrations/<timestamp>-SeedValuationStrategies.ts`: inserta "Performance general" (activa) e "Impacto táctico" (inactiva) con `INSERT ... ON CONFLICT (id) DO NOTHING`. Usar nombres de campo del dominio: `shots` (no `totalShots`), `passesCompleted` (no `accuratePasses`)

**Checkpoint**: Tests unitarios de dominio en verde. Repositorios y mappers compilando. Seed disponible.

---

## Phase 4: User Story 2 — Disparar recálculo masivo de cotizaciones (Priority: P2)

**Goal**: `POST /quotes/recalculate` con AdminApiKeyGuard procesa todos los jugadores activos, persiste una `PlayerQuote` por jugador con el snapshot completo, y devuelve resumen. Retorna 409 si ya hay un recálculo en curso.

**Independent Test**: Ejecutar `pnpm -C backend test:e2e --testPathPattern=quotation` — todos los tests en verde.

### Tests para User Story 2

- [X] T021 [US2] Crear tests e2e en `backend/test/quotation/quotation.e2e-spec.ts` usando Testcontainers + supertest. Cubrir: POST /quotes/recalculate → 200 con jugadores procesados; 409 si recálculo en curso; 401 sin API key; 403 con key sin rol ADMIN; 422 si no hay estrategia activa; verificar que `player_quotes` tiene registros con `weight_snapshot` que coincide con los pesos de la estrategia activa; verificar `value = 1 + score × factorEscalaSnapshot`

### Implementación para User Story 2

- [X] T022 [US2] Crear `QuotationService` en `backend/src/services/quotation/quotation.service.ts`: campo `isRunning: boolean = false`; método `recalculateAll()` que adquiere el lock, obtiene todos los jugadores activos (`playerRepository.findAllActive()`), obtiene la estrategia activa, llama a `calculatePlayerValue` por cada jugador, persiste las `PlayerQuote` vía `playerQuoteRepository.saveMany()`, libera el lock en `finally`, retorna `{ processedPlayers, errors, durationMs }`; lanza `RecalculationInProgressError` si `isRunning` es true; lanza `NoActiveStrategyError` si no hay estrategia activa
- [X] T023 [P] [US2] Crear DTO de respuesta `RecalculateResponseDto` en `backend/src/controllers/quotation/dto/recalculate-response.dto.ts`: campos `processedPlayers: number`, `errors: number`, `durationMs: number` con decoradores `@ApiProperty`
- [X] T024 [US2] Crear `QuotationController` en `backend/src/controllers/quotation/quotation.controller.ts`: ruta `POST /quotes/recalculate`; guard `@UseGuards(AdminApiKeyGuard)`; llama a `quotationService.recalculateAll()`; decoradores Swagger `@ApiOperation`, `@ApiResponse(200)`, `@ApiResponse(409)`, `@ApiResponse(401)`, `@ApiResponse(403)`
- [X] T025 [US2] Crear `QuotationJob` en `backend/src/services/quotation/quotation.job.ts`: `@Cron(CronExpression.EVERY_WEEK, { waitForCompletion: true })`; llama a `quotationService.recalculateAll()` en try/catch; si `RecalculationInProgressError` → log y retorna silenciosamente
- [X] T026 [US2] Crear `QuotationModule` en `backend/src/modules/quotation/quotation.module.ts`: `imports: [PlayerModule, ApiKeyModule, ScheduleModule.forRoot(), TypeOrmModule.forFeature([ValuationStrategyEntity, PlayerQuoteEntity])]`; `controllers: [QuotationController]`; `providers: [QuotationService, QuotationJob, AdminApiKeyGuard, ApiKeyGuard, { provide: VALUATION_STRATEGY_REPOSITORY, useClass: TypeOrmValuationStrategyRepository }, { provide: PLAYER_QUOTE_REPOSITORY, useClass: TypeOrmPlayerQuoteRepository }]`
- [X] T027 [US2] Registrar `QuotationModule` en `backend/src/app.module.ts`

**Checkpoint**: `POST /quotes/recalculate` funcional con lock 409 y job semanal. Tests e2e en verde.

---

## Phase 5: User Story 3 — Activar una estrategia de valuación (Priority: P3)

**Goal**: El repositorio garantiza que activar una estrategia desactiva las demás atómicamente. La invariante "solo una activa" se verifica en tests.

**Independent Test**: Test de integración del repositorio verificando que tras `activateStrategy(id2)` con la estrategia 1 previamente activa, la estrategia 1 queda `is_active=false` y la 2 queda `is_active=true` — en la misma query.

### Tests para User Story 3

- [X] T028 [P] [US3] Crear tests de integración de `TypeOrmValuationStrategyRepository` en `backend/src/repositories/quotation/__tests__/typeorm-valuation-strategy.repository.spec.ts` usando Testcontainers: `findActive()` retorna la estrategia activa; `activateStrategy(id2)` con estrategia 1 activa → estrategia 2 activa, estrategia 1 inactiva; `activateStrategy()` con id inexistente → lanza error apropiado

### Implementación para User Story 3

- [X] T029 [US3] Verificar e integrar que `TypeOrmValuationStrategyRepository.activateStrategy(id)` (implementado en T018) usa `QueryRunner.startTransaction()`, `UPDATE ... SET is_active = false WHERE is_active = true`, `UPDATE ... SET is_active = true WHERE id = :id`, `commitTransaction()` — y `rollbackTransaction()` en el `catch`. Ajustar si es necesario.
- [X] T030 [US3] Actualizar `ValuationStrategy.create()` para que también valide que el conjunto de claves de `weights` solo contenga métricas conocidas por `NORMALIZATION_BOUNDS`. Lanzar `InvalidStrategyWeightsError` si se pasa una clave sin bound definido. Actualizar tests de T015.

**Checkpoint**: Invariante "solo una activa" garantizada transaccionalmente. Tests de integración del repo en verde.

---

## Phase 6: User Story 4 — Historial de cotizaciones reproducible (Priority: P4)

**Goal**: Cada `PlayerQuote` persiste `weightSnapshot` y `factorEscalaSnapshot` que permiten reproducir el score exactamente. Verificado como criterio de aceptación dentro de los tests e2e de US2.

**Independent Test**: Consultar `player_quotes` tras un recálculo y verificar que aplicando la fórmula con `weight_snapshot` y las métricas del jugador se obtiene el `score` almacenado.

### Implementación para User Story 4

- [X] T031 [P] [US4] Agregar aserción en los tests e2e de T021: tras activar "Impacto táctico" y recalcular, verificar que las nuevas `PlayerQuote` tienen `weight_snapshot` con los pesos de "Impacto táctico" y que las cotizaciones previas (de "Performance general") conservan su snapshot original intacto
- [X] T032 [US4] Agregar método `findLatestByPlayerId(playerId)` completo en `TypeOrmPlayerQuoteRepository` (T019 lo define; aquí se completa la implementación): `ORDER BY calculated_at DESC LIMIT 1`

**Checkpoint**: Reproducibilidad histórica verificada. El snapshot desacopla correctamente las cotizaciones de cambios futuros a la estrategia.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Entregables finales requeridos por Principio X (Definición de terminado).

- [ ] T033 [P] Verificar que la documentación Swagger refleja el nuevo endpoint `POST /quotes/recalculate`: levantar el backend con `pnpm -C backend start:dev` y confirmar que el endpoint aparece en `http://localhost:3000/api` con la descripción, los responses (200, 401, 403, 409, 422) y el header `x-api-key` documentados
- [ ] T034 [P] Actualizar la colección Postman del proyecto con el request `POST /quotes/recalculate` (header `x-api-key`, sin body, environment variable para la URL base)
- [ ] T035 Ejecutar el checklist completo de `quickstart.md`: seed de estrategias presente, recálculo manual 200, cotizaciones en DB, snapshot correcto, 409 en concurrencia, 401 sin key
- [X] T036 [P] Verificar que `pnpm -C backend build` (nest build) pasa sin errores con todos los archivos nuevos
- [X] T037 [P] Ejecutar el test de arquitectura tsarch (`pnpm -C backend test:arch`) y confirmar que el nuevo módulo `quotation` no viola las reglas de capas: `QuotationController` no importa repositorios directamente; `domain/quotation/` no importa TypeORM ni NestJS; `QuotationService` no importa la entidad ni el mapper

---

## Dependencies & Execution Order

### Dependencias entre fases

- **Phase 1 (Setup)**: Sin dependencias — empieza de inmediato
- **Phase 2 (Foundational)**: Depende de Phase 1 — bloquea todas las user stories
- **Phase 3 (US1)**: Depende de Phase 2. No depende de otras user stories.
- **Phase 4 (US2)**: Depende de Phase 2 y Phase 3 (usa `QuotationService` que necesita los repositorios de US1).
- **Phase 5 (US3)**: Depende de Phase 2. Se puede hacer en paralelo con Phase 4 si hay capacidad.
- **Phase 6 (US4)**: Depende de Phase 4 (extiende los tests e2e de US2).
- **Phase 7 (Polish)**: Depende de todas las fases anteriores.

### Dependencias entre user stories

- **US1 (P1)**: Solo depende de Foundational. Puede iniciarse primero.
- **US2 (P2)**: Depende de US1 (el `QuotationService` usa `TypeOrmValuationStrategyRepository` y `TypeOrmPlayerQuoteRepository` de US1).
- **US3 (P3)**: Depende de Foundational únicamente. Puede hacerse en paralelo con US1/US2.
- **US4 (P4)**: Depende de US2 (extiende sus tests e2e).

### Dentro de cada user story

- Siempre: tests antes de implementación (red → green)
- Mappers antes de repositorios
- Repositorios antes de service
- Service antes de controller
- Controller antes de module registration

### Oportunidades de paralelismo

- T002, T003, T004, T005, T006, T007, T008 (Phase 2) — en paralelo entre sí
- T010, T011, T012 — en paralelo entre sí
- T014, T015 (tests US1) — en paralelo
- T016, T017 (mappers US1) — en paralelo
- T023 (DTO US2) — en paralelo con T022
- T028 (tests US3) — en paralelo con T029
- T031, T032 (US4) — en paralelo
- T033, T034, T036, T037 (Polish) — en paralelo

---

## Parallel Example: Phase 2

```bash
# Ejecutar en paralelo:
Task: "T002 Errores de dominio en backend/src/domain/quotation/errors/"
Task: "T003 Registrar errores en AllExceptionsFilter"
Task: "T004 ValuationStrategy domain class"
Task: "T005 PlayerQuote domain class"
Task: "T006 calculatePlayerValue + NORMALIZATION_BOUNDS"
Task: "T007 ValuationStrategyEntity TypeORM"
Task: "T008 PlayerQuoteEntity TypeORM"
Task: "T010 IValuationStrategyRepository interface"
Task: "T011 IPlayerQuoteRepository interface"
Task: "T012 findAllActive en IPlayerRepository"
```

## Parallel Example: User Story 1

```bash
# Tests en paralelo:
Task: "T014 Tests calculate-player-value"
Task: "T015 Tests ValuationStrategy domain"

# Luego mappers en paralelo:
Task: "T016 ValuationStrategyMapper"
Task: "T017 PlayerQuoteMapper"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2)

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational — **CRÍTICO**, bloquea todo
3. Completar Phase 3: US1 — dominio puro y repositorios con seed
4. Completar Phase 4: US2 — endpoint + job + module
5. **STOP y VALIDAR**: `pnpm -C backend test:e2e --testPathPattern=quotation` en verde; `POST /quotes/recalculate` funcional
6. Esto es el MVP: cotizaciones calculadas automáticamente cada semana y disparables manualmente

### Incremental Delivery

1. Setup + Foundational → base lista
2. US1 → cálculo de dominio correcto, seed presente, repositorios listos
3. US2 → endpoint y job operacionales → **MVP demostrable**
4. US3 → activación de estrategia garantizada transaccionalmente
5. US4 → reproducibilidad histórica verificada
6. Polish → documentación, Postman, build verification

### Estrategia de equipo (paralelo)

Con múltiples desarrolladores, tras completar Phase 2:
- Dev A: US1 (función pura + repositorios + seed)
- Dev B: US3 (activación transaccional del repositorio — comparte TypeOrmValuationStrategyRepository con Dev A, coordinar)
- Dev C espera US1 completo: US2 (service + controller + job + module)

---

## Notes

- [P] = archivos distintos, sin dependencias entre sí en ese momento
- Cada user story es completable y testeable de forma independiente
- Los tests deben estar en rojo antes de implementar (red → green)
- Usar `@Cron(CronExpression.EVERY_WEEK, { waitForCompletion: true })` en `QuotationJob` — mismo patrón que `PlayerSyncService`
- El guard correcto es `AdminApiKeyGuard` (existente en `backend/src/guards/api-key/admin-api-key.guard.ts`), no un guard nuevo
- Nombres de métricas en los pesos del seed: `shots` (no `totalShots`), `passesCompleted` (no `accuratePasses`) — usar los nombres del dominio `Player`
- `value` puede ser negativo — persistir sin clamp (riesgo aceptado por la spec)
