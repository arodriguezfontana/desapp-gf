---

description: "Task list for Estrategias de Valuación Propias por Usuario"
---

# Tasks: Estrategias de Valuación Propias por Usuario

**Input**: Design documents from `/specs/019-per-user-valuation-strategies/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included and REQUIRED — Principio IX de la constitución exige tests
unitarios de dominio sin NestJS/DB, tests de integración/e2e con Testcontainers, y
tests de frontend contra backend real para toda capa `service/`/`hooks/`/`contexts/`.
No son opcionales en este proyecto.

**Organization**: Tasks agrupadas por historia de usuario (spec.md), en orden de
prioridad: US1 (P1), US2 (P1), US4 (P1), US3 (P2), US5 (P2), US6 (P2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: Historia de usuario a la que pertenece (US1...US6)
- Rutas de archivo exactas en cada descripción

## Path Conventions

Monorepo `backend/` (NestJS, por capas) + `frontend/` (React, por capas), según
plan.md § Project Structure.

---

## Phase 1: Setup

**Purpose**: Scaffolding de los archivos/directorios nuevos que necesitan las fases
siguientes; el proyecto ya existe, no hay dependencias nuevas que instalar.

- [X] T001 Crear `backend/src/controllers/user-strategy/` y `backend/src/controllers/user-strategy/dto/` (directorios vacíos listos para los controllers/DTOs de las fases siguientes)
- [X] T002 [P] Crear archivo vacío `backend/src/domain/auth/user-strategy-provisioning.ts` (placeholder para el servicio de provisioning de Foundational)
- [X] T003 [P] Crear archivos vacíos `frontend/src/service/userStrategyService.ts` y `frontend/src/types/userStrategy.types.ts` (placeholders para el cliente de API nuevo)

**Checkpoint**: Scaffolding listo, sin lógica todavía.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Cambios de esquema y de dominio que **todas** las historias necesitan.
Mientras `isActive`/`findActive`/`activateStrategy` sigan existiendo en su forma global,
ninguna historia puede implementarse sin duplicar lógica que se va a tirar; por eso el
rename y el borrado de los endpoints/cron que dependen de esa semántica global van aquí,
no en una historia particular.

**⚠️ CRITICAL**: Ninguna historia de usuario puede empezar hasta que esta fase esté completa.

- [X] T004 Migración que elimina las filas seed globales preexistentes de `valuation_strategies` y los `player_quotes` que las referencian por `strategy_id`, antes de endurecer el esquema (research.md D2) en `backend/src/database/migrations/<timestamp>-DropLegacyGlobalStrategiesAndQuotes.ts`
- [X] T005 Migración que agrega `user_id uuid NOT NULL` con FK `→ users(id) ON DELETE CASCADE` a `valuation_strategies` en `backend/src/database/migrations/<timestamp>-AddUserIdToValuationStrategies.ts` (depende de T004)
- [X] T006 Migración que renombra `is_active` → `is_selected` en `valuation_strategies` (mismo tipo de columna) en `backend/src/database/migrations/<timestamp>-RenameIsActiveToIsSelected.ts` (depende de T005)
- [X] T007 Migración que crea el índice único parcial `UNIQUE (user_id) WHERE is_selected = true` sobre `valuation_strategies` en `backend/src/database/migrations/<timestamp>-AddUniqueSelectedIndex.ts` (depende de T006)
- [X] T008 Migración que agrega `user_id uuid NOT NULL` con FK `→ users(id) ON DELETE CASCADE` y el índice compuesto `(user_id, player_id, calculated_at)` a `player_quotes` en `backend/src/database/migrations/<timestamp>-AddUserIdToPlayerQuotes.ts` (depende de T004)
- [X] T009 Actualizar `ValuationStrategy` en `backend/src/domain/quotation/valuation-strategy.ts`: agregar campo `userId`, renombrar `isActive`→`isSelected`, reemplazar `activate()`/`deactivate()` por `select()`/`deselect()`, agregar `withWeights(weights)`, `withPositionWeights(position, weights)` y `assertOwnedBy(userId)`
- [X] T010 [P] Agregar campo `userId` a `PlayerQuote` en `backend/src/domain/quotation/player-quote.ts`
- [X] T011 [P] Crear `StrategyOwnershipError` (403) en `backend/src/domain/quotation/errors/strategy-ownership.error.ts`
- [X] T012 Actualizar `ValuationStrategyEntity` (agregar columna `user_id`, renombrar `is_active`→`is_selected`) en `backend/src/repositories/quotation/entities/valuation-strategy.entity.ts` (depende de T009)
- [X] T013 [P] Agregar columna `user_id` a `PlayerQuoteEntity` en `backend/src/repositories/quotation/entities/player-quote.entity.ts` (depende de T010)
- [X] T014 Actualizar `ValuationStrategyMapper` para mapear `userId`/`isSelected` en `backend/src/repositories/quotation/valuation-strategy.mapper.ts` (depende de T012)
- [X] T015 [P] Actualizar `PlayerQuoteMapper` para mapear `userId` en `backend/src/repositories/quotation/player-quote.mapper.ts` (depende de T013)
- [X] T016 Reemplazar el puerto `ValuationStrategyRepository` (quitar `findActive`/`activateStrategy` globales, agregar `findByUserId(userId)`, `findByIdAndUserId(id, userId)`, `save`, `selectStrategy(userId, strategyId)`) en `backend/src/repositories/quotation/valuation-strategy.repository.ts` (depende de T014)
- [X] T017 Actualizar `TypeOrmValuationStrategyRepository` implementando el puerto nuevo, con el toggle transaccional de selección acotado por `user_id` en `backend/src/repositories/quotation/typeorm-valuation-strategy.repository.ts` (depende de T016)
- [X] T018 [P] Reemplazar el puerto `PlayerQuoteRepository` agregando `userId` a `saveMany`, `findAllByPlayerIdAndUserId`, `findLatestByPlayerIdAndUserId` en `backend/src/repositories/quotation/player-quote.repository.ts` (depende de T015)
- [X] T019 [P] Actualizar `TypeOrmPlayerQuoteRepository` implementando los métodos acotados por `userId` en `backend/src/repositories/quotation/typeorm-player-quote.repository.ts` (depende de T018)
- [X] T020 Quitar de `backend/src/controllers/quotation/quotation.controller.ts` los endpoints `GET quotes/strategies`, `PATCH quotes/strategies/:id/activate` y `POST quotes/recalculate` (los tres bajo `AdminApiKeyGuard`) (depende de T017, T019)
- [X] T021 Eliminar `backend/src/services/quotation/quotation.job.ts` y quitar su registro/`ScheduleModule.forRoot()` de `backend/src/modules/quotation/quotation.module.ts` (depende de T020)
- [X] T022 Implementar `UserStrategyProvisioningService` (construye las dos `ValuationStrategy` seed — "Performance general" e "Impacto táctico", con los pesos generales y perfiles de posición exactos de data-model.md — con una marcada `isSelected: true`) en `backend/src/domain/auth/user-strategy-provisioning.ts` (depende de T009, T011)
- [X] T023 Exportar `UserStrategyProvisioningService` desde `backend/src/modules/quotation/quotation.module.ts` e importarlo (vía `forwardRef`, mismo patrón que `QuotationModule → PlayerModule`) en `backend/src/modules/auth/auth.module.ts` (depende de T022, T021)
- [X] T024 [P] Tests unitarios de dominio (sin NestJS/DB) para `select()`/`deselect()`/`withWeights()`/`withPositionWeights()`/`assertOwnedBy()` en `backend/src/domain/quotation/__tests__/valuation-strategy.spec.ts`
- [X] T025 [P] Test unitario de dominio para `UserStrategyProvisioningService` (verifica los valores seed exactos de ambas estrategias) en `backend/src/domain/auth/__tests__/user-strategy-provisioning.spec.ts`
- [X] T026 Correr y, si corresponde, actualizar el test de arquitectura tsarch del Principio IX para confirmar que las capas (Controller→Service→{Dominio,Repository,Adapter}) siguen respetadas tras los cambios de repositorio/controller de esta fase

**Checkpoint**: Esquema, dominio, repositorios y provisioning listos; endpoints/cron
globales obsoletos eliminados. Las historias de usuario pueden empezar.

---

## Phase 3: User Story 1 - Recibir las dos estrategias propias al registrarse (Priority: P1) 🎯 MVP

**Goal**: Al crear su cuenta, todo usuario (incluido el superusuario de seed) recibe
automáticamente sus dos estrategias propias, una seleccionada por defecto, sin acción
adicional.

**Independent Test**: Registrar una cuenta nueva y, sin ninguna acción adicional,
verificar que el usuario tiene exactamente dos estrategias propias con los pesos
esperados y una seleccionada.

- [X] T027 [US1] Inyectar `UserStrategyProvisioningService` en `AuthService.register()` para crear las dos estrategias del usuario justo después de persistirlo en `backend/src/services/auth/auth.service.ts`
- [X] T028 [US1] Inyectar `UserStrategyProvisioningService` en `AdminSeedService.run()` para que el superusuario de seed también reciba sus dos estrategias en `backend/src/services/auth/admin-seed.service.ts`
- [X] T029 [P] [US1] Test de integración (Testcontainers): registrar un usuario nuevo produce exactamente 2 `ValuationStrategy` con los pesos/perfiles correctos y una `isSelected=true` en `backend/src/services/auth/__tests__/auth.service.integration.spec.ts`
- [X] T030 [P] [US1] Test de integración (Testcontainers): correr `AdminSeedService.run()` crea las dos estrategias para el admin seedeado en `backend/src/services/auth/__tests__/admin-seed.service.integration.spec.ts`
- [X] T031 [P] [US1] Test e2e (supertest): dos usuarios que se registran por separado obtienen pares de estrategias independientes, sin ids ni filas compartidas en `backend/test/user-strategy-provisioning.e2e-spec.ts`

**Checkpoint**: User Story 1 funcional y testeable de forma independiente (MVP).

---

## Phase 4: User Story 2 - Listar y seleccionar cuál de mis dos estrategias usar (Priority: P1)

**Goal**: El usuario autenticado puede listar sus dos estrategias (viendo cuál está
seleccionada) y cambiar la selección.

**Independent Test**: Listar las estrategias de un usuario recién registrado,
seleccionar la que no estaba seleccionada, y verificar que la selección cambió.

- [X] T032 [US2] Crear `UserStrategyResponseDto` en `backend/src/controllers/user-strategy/dto/user-strategy-response.dto.ts`
- [X] T033 [US2] Implementar `UserStrategyController` con `GET /users/me/strategies` y `PATCH /users/me/strategies/:id/select` bajo `JwtAuthGuard` en `backend/src/controllers/user-strategy/user-strategy.controller.ts` (depende de T032, T017)
- [X] T034 [US2] Implementar `selectStrategy(userId, strategyId)` en `QuotationService` con validación de ownership (403) y de existencia (404) en `backend/src/services/quotation/quotation.service.ts` (depende de T017)
- [X] T035 [US2] Registrar `UserStrategyController` en `backend/src/modules/quotation/quotation.module.ts` (depende de T033)
- [X] T036 [P] [US2] Test de integración: `GET /users/me/strategies` devuelve las 2 con exactamente una `isSelected: true` en `backend/test/user-strategy-list.e2e-spec.ts`
- [X] T037 [P] [US2] Test de integración: seleccionar cambia el estado correctamente, es idempotente al repetir, devuelve 403 sobre estrategia ajena y 404 sobre id inexistente en `backend/test/user-strategy-select.e2e-spec.ts`
- [X] T038 [P] [US2] Cliente de API `userStrategyService.ts` (GET lista, PATCH select) en `frontend/src/service/userStrategyService.ts`
- [X] T039 [P] [US2] Hook `useUserStrategies` en `frontend/src/hooks/useUserStrategies.ts` (depende de T038)
- [X] T040 [US2] Página "Mis estrategias" mostrando las dos estrategias y el control de selección en `frontend/src/pages/MyStrategiesPage.tsx` (depende de T038, T039)
- [X] T041 [P] [US2] Test de `userStrategyService.ts` contra backend real + Testcontainers (sin mocks) en `frontend/test/userStrategyService.test.tsx` (depende de T038)

**Checkpoint**: User Stories 1 y 2 funcionan de forma independiente.

---

## Phase 5: User Story 4 - Consultar cuánto valdría un jugador según mi estrategia (Priority: P1)

**Goal**: El usuario puede consultar al vuelo, sin persistir nada, el valor de un
jugador según su estrategia seleccionada o una puntual indicada por query.

**Independent Test**: Dos usuarios con estrategias seleccionadas distintas consultan el
mismo jugador y obtienen valores calculados según su propia estrategia, sin dejar rastro.

- [X] T042 [US4] Implementar `valuate(userId, playerId, strategyId?)` en `QuotationService`: resuelve la estrategia seleccionada o la indicada (validando ownership), calcula sin persistir en `backend/src/services/quotation/quotation.service.ts` (depende de T017)
- [X] T043 [US4] Agregar `GET /players/:id/valuation` bajo `JwtAuthGuard` en `backend/src/controllers/player/player.controller.ts` (depende de T042)
- [X] T044 [P] [US4] Test de integración: sin query, usa la estrategia seleccionada del usuario en `backend/test/player-valuation.e2e-spec.ts`
- [X] T045 [P] [US4] Test de integración: con `?strategyId=`, usa esa estrategia puntual y no altera cuál queda seleccionada en `backend/test/player-valuation-query-strategy.e2e-spec.ts`
- [X] T046 [P] [US4] Test de integración: dos usuarios con estrategias seleccionadas distintas obtienen valores distintos para el mismo jugador en `backend/test/player-valuation-per-user.e2e-spec.ts`
- [X] T047 [P] [US4] Test de integración: `strategyId` ajeno se rechaza, la consulta no persiste nada (historial antes/después idéntico), y jugador inexistente devuelve 404 en `backend/test/player-valuation-rejections.e2e-spec.ts`

**Checkpoint**: User Stories 1, 2 y 4 (todas P1) completas e independientes entre sí.

---

## Phase 6: User Story 3 - Editar los pesos de mis propias estrategias (Priority: P2)

**Goal**: El usuario puede editar los pesos generales o el perfil de una posición de
cualquiera de sus dos estrategias, validando siempre suma = 1.0 ±0.001.

**Independent Test**: Editar los pesos generales de una estrategia propia con valores
que suman 1.0 y verificar que se guardan; intentar guardar una suma inválida y verificar
que se rechaza sin modificar nada.

- [X] T048 [US3] Implementar `editWeights(userId, strategyId, weights)` y `editPositionWeights(userId, strategyId, position, weights)` en `QuotationService`, con ownership, validación de suma y aplicación atómica (todo o nada) en `backend/src/services/quotation/quotation.service.ts` (depende de T009, T017)
- [X] T049 [P] [US3] Crear `EditWeightsRequestDto` en `backend/src/controllers/user-strategy/dto/edit-weights-request.dto.ts`
- [X] T050 [P] [US3] Crear `EditPositionWeightsRequestDto` en `backend/src/controllers/user-strategy/dto/edit-position-weights-request.dto.ts`
- [X] T051 [US3] Agregar `PATCH /users/me/strategies/:id/weights` y `PATCH /users/me/strategies/:id/position-weights/:position` en `backend/src/controllers/user-strategy/user-strategy.controller.ts` (depende de T048, T049, T050)
- [X] T052 [P] [US3] Test de integración: pesos generales con suma válida se aceptan y persisten en `backend/test/user-strategy-edit-weights.e2e-spec.ts`
- [X] T053 [P] [US3] Test de integración: suma inválida (±0.001) se rechaza (400) sin persistir cambios parciales en `backend/test/user-strategy-edit-weights-invalid.e2e-spec.ts`
- [X] T054 [P] [US3] Test de integración: edición de perfil de posición válida para FW/MF/DF/GK, y posición inválida rechazada en `backend/test/user-strategy-edit-position-weights.e2e-spec.ts`
- [X] T055 [P] [US3] Test de integración: editar una estrategia ajena (pesos generales o de posición) devuelve 403 sin aplicar cambios en `backend/test/user-strategy-edit-ownership.e2e-spec.ts`
- [X] T056 [P] [US3] Extender `userStrategyService.ts` con `editWeights`/`editPositionWeights` en `frontend/src/service/userStrategyService.ts` (depende de T038)
- [X] T057 [US3] UI de edición de pesos en `frontend/src/pages/MyStrategiesPage.tsx` (depende de T040, T056)

**Checkpoint**: User Story 3 completa, sin romper 1/2/4.

---

## Phase 7: User Story 5 - Disparar manualmente el recálculo de mis cotizaciones (Priority: P2)

**Goal**: El usuario dispara un recálculo síncrono (todo el catálogo o un jugador
puntual) usando su estrategia seleccionada, con lock de concurrencia por usuario y
skip-and-continue ante fallos puntuales en el modo masivo.

**Independent Test**: Disparar el recálculo para un jugador puntual y verificar que
queda una entrada nueva e inmutable en el historial propio; un segundo recálculo
concurrente del mismo usuario debe responder 409, uno de otro usuario no debe bloquearse.

- [X] T058 [US5] Implementar `recalculate(userId, playerId?)` en `QuotationService`: lock en memoria por `userId` (409 si ya hay uno en curso, liberado en `finally`), procesamiento síncrono, skip-and-continue en modo masivo, 422 si falla un `playerId` puntual, persistencia de un `PlayerQuote` por jugador exitoso en `backend/src/services/quotation/quotation.service.ts` (depende de T019, T034)
- [X] T059 [P] [US5] Crear `RecalculateRequestDto` y `RecalculateResponseDto` (`{recalculated, skipped}`) en `backend/src/controllers/quotation/dto/recalculate-request.dto.ts` y `recalculate-response.dto.ts`
- [X] T060 [US5] Agregar `POST /users/me/quotes/recalculate` bajo `JwtAuthGuard` en `backend/src/controllers/quotation/quotation.controller.ts` (depende de T058, T059)
- [X] T061 [P] [US5] Test de integración: recálculo masivo persiste una cotización por jugador del catálogo, respuesta lista los recalculados en `backend/test/recalculate-bulk.e2e-spec.ts`
- [X] T062 [P] [US5] Test de integración: recálculo con `playerId` puntual persiste solo esa cotización en `backend/test/recalculate-single.e2e-spec.ts`
- [X] T063 [P] [US5] Test de integración: segundo recálculo del mismo usuario mientras el primero está en curso devuelve 409; dos usuarios distintos recalculando en simultáneo no se bloquean en `backend/test/recalculate-concurrency.e2e-spec.ts`
- [X] T064 [P] [US5] Test de integración: recálculo masivo con un jugador que falla (métricas faltantes) lo saltea y persiste el resto, respuesta lista ambos grupos en `backend/test/recalculate-partial-failure.e2e-spec.ts`
- [X] T065 [P] [US5] Test de integración: `playerId` puntual inexistente devuelve 404; `playerId` puntual cuyo cálculo falla devuelve 422 sin persistir en `backend/test/recalculate-rejections.e2e-spec.ts`
- [X] T066 [P] [US5] Agregar `recalculate()` a `userStrategyService.ts` en `frontend/src/service/userStrategyService.ts` (depende de T038)
- [X] T067 [US5] Botón "Recalcular" con feedback de jugadores actualizados/saltados en `frontend/src/pages/MyStrategiesPage.tsx` (depende de T066)

**Checkpoint**: User Story 5 completa.

---

## Phase 8: User Story 6 - Consultar mi propio historial de valor de un jugador (Priority: P2)

**Goal**: El usuario consulta, para un jugador puntual, solo las cotizaciones que él
mismo generó, ordenadas cronológicamente.

**Independent Test**: Disparar dos recálculos sucesivos para el mismo jugador y
verificar que el historial trae ambas entradas en orden; consultar el historial de un
usuario que nunca recalculó y verificar que viene vacío.

- [X] T068 [US6] Implementar `getQuoteHistory(userId, playerId)` en `QuotationService` usando el método de repositorio acotado por `userId` en `backend/src/services/quotation/quotation.service.ts` (depende de T019)
- [X] T069 [US6] Agregar `GET /players/:id/quotes` bajo `JwtAuthGuard` en `backend/src/controllers/player/player.controller.ts` (depende de T068)
- [X] T070 [P] [US6] Test de integración: el historial trae solo las cotizaciones propias, en orden cronológico, tras varios recálculos en `backend/test/player-quotes-history.e2e-spec.ts`
- [X] T071 [P] [US6] Test de integración: dos usuarios que recalcularon el mismo jugador ven únicamente sus propias entradas en `backend/test/player-quotes-history-isolation.e2e-spec.ts`
- [X] T072 [P] [US6] Test de integración: historial vacío para un usuario que nunca recalculó ese jugador; 404 si el jugador no existe en `backend/test/player-quotes-history-empty.e2e-spec.ts`
- [X] T073 [P] [US6] Repuntar la obtención del historial a `GET /players/:id/quotes` en `frontend/src/service/catalogService.ts`
- [X] T074 [US6] Repuntar el consumidor de `QuoteHistoryChart.tsx` a la nueva fuente por-usuario y actualizar el copy a "tu valuación de este jugador en el tiempo" en `frontend/src/components/QuoteHistoryChart.tsx` y la página que lo usa (depende de T073)

**Checkpoint**: Las seis historias de usuario funcionan de forma independiente.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Cierre de la Definición de terminado (Principio X) y limpieza de UI
administrativa obsoleta.

- [X] T075 [P] Quitar la sección de activación de estrategia de sistema de `frontend/src/pages/AdminPage.tsx` y las llamadas obsoletas en `frontend/src/service/adminService.ts`
- [X] T076 [P] Actualizar los decoradores Swagger de todos los DTOs/controllers nuevos o cambiados para que la documentación OpenAPI generada refleje los endpoints de esta feature (Principio VIII)
- [X] T077 Actualizar la colección de Postman del proyecto con los endpoints nuevos/modificados (Principio X)
- [X] T078 Ejecutar manualmente los escenarios de `quickstart.md` contra el stack local (`docker-compose` + `nest start` + `vite dev`)
- [X] T079 [P] Verificar que `nest build` (backend) y `vite build` (frontend) terminan sin errores tras todos los cambios

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — arranca de inmediato.
- **Foundational (Phase 2)**: depende de Setup — BLOQUEA todas las historias.
- **User Stories (Phase 3-8)**: todas dependen de Foundational. Orden de prioridad:
  US1 → US2 → US4 (las tres P1) → US3 → US5 → US6 (las tres P2). US2, US3, US5 y US6
  comparten `QuotationService`/`UserStrategyController`, por lo que en la práctica
  conviene implementarlas en ese orden aunque son independientemente testeables.
- **Polish (Phase 9)**: depende de que las historias que se quieran entregar estén completas.

### User Story Dependencies

- **US1 (P1)**: solo depende de Foundational.
- **US2 (P1)**: depende de Foundational; comparte `UserStrategyController`/`quotation.module.ts` con US3, pero es testeable sin que US3 exista (edición de pesos no es prerequisito de listar/seleccionar).
- **US4 (P1)**: depende de Foundational; no depende de US2/US3.
- **US3 (P2)**: depende de Foundational y de que exista `UserStrategyController` (T033, de US2) para agregarle las rutas de edición; testeable de forma aislada una vez montada.
- **US5 (P2)**: depende de Foundational y de `selectStrategy` (T034, de US2) para resolver "la estrategia seleccionada en ese momento".
- **US6 (P2)**: depende de Foundational; no depende de US5 para ser testeable (puede probarse con historial vacío), pero necesita datos reales de US5 para un escenario con contenido.

### Parallel Opportunities

- Todas las tareas `[P]` de Setup y Foundational pueden correr en paralelo entre sí.
- Una vez cerrada Foundational, US1 puede implementarse en paralelo con el resto si hay
  más de una persona, aunque US2/US3/US5 comparten archivos de controller/service y
  conviene secuenciarlas en una sola rama de trabajo.
- Todos los tests marcados `[P]` dentro de una misma historia corren en paralelo entre sí.

---

## Parallel Example: User Story 2

```bash
# Tests de integración en paralelo:
Task: "Integration test: GET /users/me/strategies devuelve las 2 con una isSelected en backend/test/user-strategy-list.e2e-spec.ts"
Task: "Integration test: seleccionar, idempotencia, 403 y 404 en backend/test/user-strategy-select.e2e-spec.ts"

# Frontend en paralelo:
Task: "Cliente de API en frontend/src/service/userStrategyService.ts"
Task: "Hook en frontend/src/hooks/useUserStrategies.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 solamente)

1. Completar Phase 1: Setup.
2. Completar Phase 2: Foundational (crítico — bloquea todas las historias).
3. Completar Phase 3: User Story 1.
4. **Parar y validar**: registrar un usuario y confirmar sus dos estrategias.

### Entrega incremental

1. Setup + Foundational → base lista.
2. US1 → validar → (ya hay provisioning automático).
3. US2 → validar → (ya se puede listar/seleccionar).
4. US4 → validar → (ya se puede consultar valuación por usuario).
5. US3 → validar → (ya se puede editar pesos).
6. US5 → validar → (ya se puede recalcular y alimentar historial).
7. US6 → validar → (ya se puede consultar historial propio).
8. Polish.

---

## Notes

- `[P]` = archivos distintos, sin dependencias pendientes entre sí.
- Los tests de integración/e2e usan Testcontainers (Principio IX); ningún test corre
  contra la base persistente de desarrollo.
- Ningún test existente se modifica ni se borra para hacerlo pasar sin permiso explícito
  (Principio IX).
- No tocar `GET /players/ranking` (016-player-ranking-endpoint) — fuera de alcance,
  documentado como riesgo conocido en research.md D6.
