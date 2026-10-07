# Tasks: Extensión de Métricas de Jugador (WhoScored)

**Feature**: `011-whoscored-player-metrics`
**Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparación de tipos e interfaces base para métricas extendidas.

- [X] T001 [P] Actualizar la interfaz `WhoScoredRawMetrics` con las 7 métricas (`goals`, `assists`, `keyPasses`, `dribbles`, `totalTackles`, `yellowCards`, `redCards`) en `backend/src/adapters/player-sync/whoscored-adapter.ts`
- [X] T002 [P] Actualizar la interfaz `PlayerMetrics` con las 7 métricas (`goals`, `assists`, `keyPasses`, `dribbles`, `totalTackles`, `yellowCards`, `redCards`) en `backend/src/domain/player/player-sync-input.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestructura de persistencia, migración y modelo de dominio que bloquea las historias de usuario.

- [X] T003 Actualizar el modelo de dominio `Player` con los 7 nuevos campos enteros nulleables (`goals`, `assists`, `keyPasses`, `dribbles`, `totalTackles`, `yellowCards`, `redCards`) en `backend/src/domain/player/player.ts`
- [X] T004 Actualizar la entidad `PlayerEntity` con las 7 nuevas columnas de tipo `integer` (`nullable: true`) en `backend/src/repositories/player/entities/player.entity.ts`
- [X] T005 [P] Crear la migración `1791331200000-AddExtendedMetricsToPlayers.ts` para agregar las 7 columnas (`goals`, `assists`, `keyPasses`, `dribbles`, `totalTackles`, `yellowCards`, `redCards`) a la tabla `players` en `backend/src/database/migrations/1791331200000-AddExtendedMetricsToPlayers.ts`
- [X] T006 Actualizar el mapeador de persistencia `PlayerMapper` (`toDomain` y `toEntity`) con las 7 métricas en `backend/src/repositories/player/mappers/player.mapper.ts`
- [X] T007 Actualizar `UPSERT_OVERWRITE_COLUMNS` y la inserción/actualización en `TypeOrmPlayerRepository.applyTeamRosterSync` en `backend/src/repositories/player/typeorm-player.repository.ts`

**Checkpoint**: Foundation ready - La base de datos, entidad, mapeador y modelo de dominio soportan las 7 métricas.

---

## Phase 3: User Story 1 - Consulta de catálogo y detalle con métricas extendidas (Priority: P1) 🎯 MVP

**Goal**: Exponer las 7 métricas estadísticas en `GET /players` y `GET /players/:id` a través de `PlayerResponseDto` con documentación Swagger.

**Independent Test**: Realizar peticiones a `GET /players` y `GET /players/:id` verificando que la respuesta incluya los 7 campos (`goals`, `assists`, `keyPasses`, `dribbles`, `totalTackles`, `yellowCards`, `redCards`) con sus valores enteros o `null`.

### Tests for User Story 1
- [X] T008 [P] [US1] Actualizar tests unitarios de dominio `Player` en `backend/src/domain/player/player.spec.ts`
- [X] T009 [P] [US1] Actualizar tests de integración de repositorio `TypeOrmPlayerRepository` en `backend/src/repositories/player/typeorm-player.repository.integration.spec.ts`
- [X] T010 [P] [US1] Actualizar tests de integración de servicio `PlayerService` en `backend/src/services/player/player.service.integration.spec.ts`

### Implementation for User Story 1
- [X] T011 [US1] Actualizar `PlayerResponseDto` con las 7 propiedades, decoradores Swagger `@ApiProperty` y mapeo en `fromDomain` en `backend/src/controllers/player/dto/player-response.dto.ts`
- [X] T012 [US1] Actualizar los tests end-to-end del catálogo y detalle de jugador en `backend/test/player-catalog.e2e-spec.ts`

**Checkpoint**: User Story 1 completa y testeable de forma independiente (API expone y serializa métricas extendidas).

---

## Phase 4: User Story 2 - Ingesta y persistencia de las 7 métricas en la sincronización de WhoScored (Priority: P1)

**Goal**: Extraer los campos `Goals`, `Assists`, `KeyPasses`, `Dribbles`, `TotalTackles`, `Yellow`, `Red` durante el scraping de WhoScored y persistirlos en base de datos.

**Independent Test**: Ejecutar el adapter con fixtures de WhoScored y verificar que los datos se parsean y persisten correctamente en la base de datos de prueba.

### Tests for User Story 2
- [X] T013 [P] [US2] Actualizar tests unitarios de `HttpWhoScoredAdapter` con fixtures de métricas completas y valores en `null` en `backend/src/adapters/player-sync/http-whoscored-adapter.spec.ts`
- [X] T014 [P] [US2] Actualizar tests unitarios de `PlayerSyncService` en `backend/src/services/player-sync/player-sync.service.spec.ts`
- [X] T015 [P] [US2] Actualizar tests de integración de `PlayerSyncService` en `backend/src/services/player-sync/player-sync.service.integration.spec.ts`

### Implementation for User Story 2
- [X] T016 [US2] Actualizar `HttpWhoScoredAdapter.fetchPlayerMetrics` y la interfaz `WhoScoredTournamentSeasonStats` para extraer `Goals`, `Assists`, `KeyPasses`, `Dribbles`, `TotalTackles`, `Yellow`, `Red` en `backend/src/adapters/player-sync/http-whoscored-adapter.ts`
- [X] T017 [US2] Actualizar `PlayerSyncService.buildSyncInputs` para propagar las 7 métricas a `PlayerSyncInput` en `backend/src/services/player-sync/player-sync.service.ts`
- [X] T018 [US2] Actualizar los tests e2e de sincronización en `backend/test/sync-trigger.e2e-spec.ts`

**Checkpoint**: User Story 2 completa y testeable de forma independiente (Scraper extrae y sincroniza métricas en BD).

---

## Phase 5: User Story 3 - Visualización de métricas clave en la tarjeta y detalle del jugador en Frontend (Priority: P2)

**Goal**: Mostrar goles, asistencias y tarjetas amarillas en `PlayerCard` y el conjunto de 11 estadísticas en `PlayerDetailPage`.

**Independent Test**: Renderizar `PlayerCard` y `PlayerDetailPage` verificando la correcta visualización de métricas y el formateo de valores nulos con un indicador neutro (`—`).

### Tests for User Story 3
- [X] T019 [P] [US3] Actualizar tests unitarios de `PlayerCard` en `frontend/src/components/PlayerCard.spec.tsx`
- [X] T020 [P] [US3] Actualizar tests unitarios de `PlayerDetailPage` en `frontend/src/pages/PlayerDetailPage.spec.tsx`

### Implementation for User Story 3
- [X] T021 [US3] Actualizar la interfaz `Player` con los 7 campos opcionales/nulleables en `frontend/src/types/catalog.types.ts`
- [X] T022 [US3] Actualizar el componente `PlayerCard` para renderizar al menos `goals`, `assists` y `yellowCards` en `frontend/src/components/PlayerCard.tsx`
- [X] T023 [US3] Actualizar el componente `PlayerDetailPage` para renderizar la grilla de métricas extendidas con soporte para `null` en `frontend/src/pages/PlayerDetailPage.tsx`

**Checkpoint**: Todas las historias de usuario completas y funcionales extremo a extremo.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verificación integral de arquitectura, compilación y suite completa.

- [X] T024 [P] Ejecutar y validar test de arquitectura tsarch en `backend/test/architecture.spec.ts`
- [X] T025 Ejecutar suite completa de tests de backend (`pnpm test`, `pnpm test:e2e`) y frontend (`pnpm test:unit`)
- [X] T026 Ejecutar build de backend (`pnpm build`) y frontend (`pnpm build`) para garantizar cero errores de tipos

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: Sin dependencias — inicio inmediato.
- **Foundational (Phase 2)**: Depende de Phase 1 — Bloquea todas las historias de usuario.
- **User Story 1 (Phase 3)**: Depende de Foundational (Phase 2).
- **User Story 2 (Phase 4)**: Depende de Foundational (Phase 2).
- **User Story 3 (Phase 5)**: Depende de Foundational (Phase 2) y contratos de API de US1.
- **Polish (Phase 6)**: Depende de completar todas las fases anteriores.

### User Story Dependencies
- **User Story 1 (P1)**: Exposición y contrato API de métricas.
- **User Story 2 (P1)**: Ingesta WhoScored y persistencia de métricas.
- **User Story 3 (P2)**: Consumo y renderizado frontend.

### Parallel Opportunities
- T001 y T002 en Phase 1 son completamente paralelizables.
- T005 (migración) puede realizarse en paralelo a T003 y T004.
- T008, T009 y T010 pueden escribirse en paralelo.
- T013, T014 y T015 pueden escribirse en paralelo.
- T019 y T020 en frontend pueden escribirse en paralelo a las tareas de backend una vez definidos los tipos.

---

## Parallel Example: User Story 1 & User Story 2

```bash
# Escribir tests de US1 y US2 en paralelo:
Task: T008 "Actualizar tests unitarios de dominio Player en backend/src/domain/player/player.spec.ts"
Task: T013 "Actualizar tests unitarios de HttpWhoScoredAdapter en backend/src/adapters/player-sync/http-whoscored-adapter.spec.ts"

# Implementar frontend types en paralelo con DTOs de backend:
Task: T011 "Actualizar PlayerResponseDto en backend/src/controllers/player/dto/player-response.dto.ts"
Task: T021 "Actualizar la interfaz Player en frontend/src/types/catalog.types.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 & Foundation)
1. Completar Phase 1 (Setup) y Phase 2 (Foundational).
2. Completar Phase 3 (User Story 1).
3. Validar de forma independiente: endpoints `GET /players` y `GET /players/:id` responden con los 7 campos extendidos en formato JSON.

### Entrega Incremental
1. Setup + Foundational → Base del modelo de datos lista.
2. User Story 1 → API pública y contrato DTO expuestos (MVP).
3. User Story 2 → Sincronización automática alimentando las nuevas métricas desde WhoScored.
4. User Story 3 → Visualización de métricas en tarjetas y detalle del frontend.
5. Polish → Verificación de arquitectura y suite completa verde.

