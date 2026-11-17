---
description: "Task list for feature implementation: Caché Redis para endpoints de alta frecuencia y degradación controlada ante fallas externas"
---

# Tasks: Caché Redis para endpoints de alta frecuencia y degradación controlada ante fallas externas

**Input**: Design documents from `/specs/031-redis-cache-fallback/` (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`)

**Prerequisites**: `plan.md` (required), `spec.md` (required for user stories), `research.md`, `data-model.md`, `contracts/`

**Tests**: Incluye pruebas unitarias de dominio y servicio, tests de integración y validación end-to-end con Supertest y Testcontainers para validar aciertos/fallos de caché, invalidaciones reactivas, fail-open y fallback ante fallas externas.

**Organization**: Las tareas están agrupadas por historia de usuario para permitir implementación y verificación independiente de cada incremento.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias incompletas).
- **[Story]**: Historia de usuario a la que pertenece ([US1], [US2], [US3], [US4], [US5]).
- Se incluyen rutas exactas de archivos en cada tarea.

---

## Phase 1: Setup (Infraestructura Compartida)

**Purpose**: Incorporación de dependencias, contenedor de Redis y configuración de entorno.

- [X] T001 Incorporar el servicio `redis` (`redis:7-alpine`) con puerto 6379, volumen persistente y healthcheck en `backend/docker-compose.yml`
- [X] T002 Incorporar dependencia `ioredis` en `dependencies` y `@types/ioredis` en `devDependencies` en `backend/package.json`
- [X] T003 [P] Agregar variables de entorno de Redis (`REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_TTL_CATALOG`, `REDIS_TTL_RANKING`, `REDIS_EXTERNAL_CACHE_TTL`) en `backend/.env.example`

---

## Phase 2: Foundational (Prerrequisitos Bloqueantes)

**Purpose**: Infraestructura transversal de conexión a Redis, serialización y hashing canónico que bloquea a todas las historias de usuario.

**⚠️ CRITICAL**: Ninguna historia de usuario puede implementarse hasta completar esta fase.

- [X] T004 [P] Crear función pura de dominio `buildCacheKey` para normalización y hashing SHA-256 canónico de parámetros en `backend/src/domain/cache/build-cache-key.ts`
- [X] T005 [P] Crear pruebas unitarias para `buildCacheKey` verificando ordenamiento canónico, recorte de espacios y hashing en `backend/src/domain/cache/build-cache-key.spec.ts`
- [X] T006 Implementar servicio `RedisCacheService` con métodos `get`, `set`, `del`, `delByPrefix`, `ping` y manejo de reconexión/fail-open en `backend/src/shared/cache/redis-cache.service.ts`
- [X] T007 [P] Crear pruebas unitarias para `RedisCacheService` con mocks de `ioredis` validando serialización JSON y captura de excepciones en `backend/src/shared/cache/redis-cache.service.spec.ts`
- [X] T008 Crear módulo `RedisCacheModule` registrando `RedisCacheService` como provider global e importarlo en `backend/src/app.module.ts`

**Checkpoint**: Infraestructura base de Redis lista — la implementación de historias de usuario puede comenzar.

---

## Phase 3: User Story 1 - Aceleración de consultas de catálogo de alta frecuencia (Priority: P1) 🎯 MVP

**Goal**: Acelerar las lecturas del catálogo de jugadores (`GET /players`) y detalle (`GET /players/:id`) mediante Cache-Aside con TTL de 1 hora e invalidación proactiva tras sincronizaciones exitosas.

**Independent Test**: Realizar una petición a `GET /players`; verificar que la primera consulta va a base de datos y la segunda se sirve desde Redis en < 15 ms. Al completar una sincronización de catálogo, las claves se purgan.

### Tests para User Story 1

- [X] T009 [P] [US1] Crear pruebas unitarias para `PlayerEnrichmentService` con mock de `RedisCacheService` probando *cache hit*, *cache miss* y almacenamiento con TTL en `backend/src/services/player/player-enrichment.service.spec.ts`
- [X] T010 [P] [US1] Crear prueba de integración en `backend/test/integration/catalog-cache.integration.spec.ts` validando el ciclo completo de consulta y almacenamiento en caché para catálogo y detalle

### Implementación para User Story 1

- [X] T011 [US1] Modificar `PlayerEnrichmentService.listPlayersWithCrests` para consultar caché con clave `futval:catalog:<hash>` antes de consultar el repositorio y persistir con TTL en `backend/src/services/player/player-enrichment.service.ts`
- [X] T012 [US1] Modificar `PlayerEnrichmentService.getPlayerByIdWithCrest` para consultar caché con clave `futval:player:<id>` antes de consultar el repositorio y persistir con TTL en `backend/src/services/player/player-enrichment.service.ts`
- [X] T013 [US1] Incorporar invalidación proactiva vía `RedisCacheService.delByPrefix('futval:catalog:')` y `delByPrefix('futval:player:')` al finalizar exitosamente la sincronización en `backend/src/services/player/player-sync.service.ts`
- [X] T014 [US1] Incorporar invalidación proactiva del catálogo y detalle al finalizar la sincronización de escudos/equipos en `backend/src/services/competition/team-crosswalk-sync.service.ts`

**Checkpoint**: User Story 1 (MVP) completamente funcional y verificable de forma independiente.

---

## Phase 4: User Story 2 - Aceleración e invalidación oportuna del ranking de jugadores por usuario (Priority: P1)

**Goal**: Cachear los resultados del ranking de jugadores (`GET /players/ranking`) aislados por `userId` e invalidarlos inmediatamente cuando el usuario recalcule sus cotizaciones o cambie su estrategia activa.

**Independent Test**: Consultar el ranking de un usuario; verificar que la segunda consulta se sirve desde Redis. Disparar un recálculo manual o modificar la estrategia activa; verificar que la caché de ranking se invalida y la siguiente consulta calcula y cachea los nuevos valores.

### Tests para User Story 2

- [X] T015 [P] [US2] Agregar casos de prueba unitaria en `backend/src/services/player/player-enrichment.service.spec.ts` validando aislamiento por `userId` en `getRankingWithCrests`
- [X] T016 [P] [US2] Crear pruebas unitarias para el listener de invalidación reactiva de ranking en `backend/src/services/quotation/listeners/quotation-cache-invalidation.listener.spec.ts`
- [X] T017 [P] [US2] Crear prueba de integración en `backend/test/integration/ranking-cache.integration.spec.ts` validando el ciclo de consulta, acierto en caché e invalidación por recálculo

### Implementación para User Story 2

- [X] T018 [US2] Modificar `PlayerEnrichmentService.getRankingWithCrests` para consultar y almacenar en caché con clave `futval:ranking:<userId>:<hash>` con TTL de 24 horas en `backend/src/services/player/player-enrichment.service.ts`
- [X] T019 [US2] Crear listener de eventos `QuotationCacheInvalidationListener` suscrito a `quote.recalculated` para invalidar `futval:ranking:${userId}:*` en `backend/src/services/quotation/listeners/quotation-cache-invalidation.listener.ts`
- [X] T020 [US2] Registrar `QuotationCacheInvalidationListener` en `backend/src/modules/quotation/quotation.module.ts`
- [X] T021 [US2] Incorporar llamada a invalidación de caché de ranking del usuario al cambiar la estrategia seleccionada (`selectStrategy`) en `backend/src/services/quotation/strategy.service.ts`
- [X] T022 [US2] Incorporar llamada a invalidación de caché de ranking del usuario al actualizar ponderaciones (`updateWeights`, `updatePositionWeights`) en `backend/src/services/quotation/strategy.service.ts`

**Checkpoint**: User Story 2 completa: ranking acelerado y sincronizado de forma reactiva ante cambios de cotización.

---

## Phase 5: User Story 3 - Degradación controlada y fallback explícito ante fallas externas (Priority: P1)

**Goal**: Implementar el fallback de dos niveles (Redis → base de datos local → `null`) en llamadas a APIs externas (Football-Data.org) para garantizar que caídas, timeouts o HTTP 429 nunca arrojen error 500 al cliente.

**Independent Test**: Simular fallos HTTP 500, timeout y 429 en `HttpFootballDataAdapter`; verificar que la petición responde HTTP 200 entregando los datos locales resguardados o `null`, registrando un log de nivel `warn`.

### Tests para User Story 3

- [X] T023 [P] [US3] Crear pruebas unitarias para `HttpFootballDataAdapter` simulando errores 5xx, timeout y 429 con recuperación desde caché o base local en `backend/src/adapters/competition/http-football-data-adapter.spec.ts`
- [X] T024 [P] [US3] Crear pruebas unitarias en `backend/src/services/player/player-enrichment.service.spec.ts` validando degradación segura a `crestUrl: null` cuando no existe escudo ni en externo ni en local

### Implementación para User Story 3

- [X] T025 [US3] Actualizar `HttpFootballDataAdapter` inyectando `RedisCacheService` y agregando almacenamiento con TTL de 7 días para clasificaciones y escudos en `backend/src/adapters/competition/http-football-data-adapter.ts`
- [X] T026 [US3] Implementar captura de excepciones (error de conexión, timeout >5 s, HTTP 5xx, HTTP 429) en `HttpFootballDataAdapter.fetchStandings` con fallback a datos en caché de Redis o lista vacía y log `warn` en `backend/src/adapters/competition/http-football-data-adapter.ts`
- [X] T027 [US3] Actualizar `TeamCrosswalkSyncService.syncTeamCrests` para asegurar que ante fallo de obtención de escudos de la API externa se mantengan los escudos existentes sin sobreescribir con valores erróneos en `backend/src/services/competition/team-crosswalk-sync.service.ts`
- [X] T028 [US3] Asegurar que `PlayerEnrichmentService.loadCrests` devuelva `null` de forma segura ante equipos no encontrados sin interrumpir la respuesta del catálogo ni del ranking en `backend/src/services/player/player-enrichment.service.ts`

**Checkpoint**: User Story 3 completa: resiliencia y degradación controlada garantizadas ante contingencias de proveedores externos.

---

## Phase 6: User Story 4 - Resiliencia de la aplicación ante caídas de la caché (fail-open) (Priority: P2)

**Goal**: Garantizar que la indisponibilidad de Redis (desconexión, caída del contenedor o saturación) no provoque errores 500 ni interrumpa la atención de las solicitudes de los usuarios.

**Independent Test**: Detener el contenedor de Redis; ejecutar peticiones a `/players`, `/players/:id` y `/players/ranking`; verificar que todas responden HTTP 200 consultando PostgreSQL y emiten un log de advertencia `warn`.

### Tests para User Story 4

- [X] T029 [P] [US4] Crear pruebas unitarias en `backend/src/shared/cache/redis-cache.service.spec.ts` simulando fallos de conexión (`ECONNREFUSED`, `ETIMEDOUT`) y verificando que los métodos retornan `null` o resuelven sin lanzar excepciones
- [X] T030 [P] [US4] Crear prueba de integración en `backend/test/integration/redis-fail-open.integration.spec.ts` validando que `PlayerEnrichmentService` atiende peticiones exitosamente desde PostgreSQL cuando Redis está inalcanzable

### Implementación para User Story 4

- [X] T031 [US4] Configurar opciones de resiliencia en `ioredis` (`lazyConnect: true`, `maxRetriesPerRequest: 1`, `retryStrategy`) dentro de `RedisCacheModule` en `backend/src/shared/cache/redis-cache.module.ts`
- [X] T032 [US4] Implementar envoltorio seguro con bloques `try-catch` y log estructurado de advertencia en todos los métodos de `RedisCacheService` en `backend/src/shared/cache/redis-cache.service.ts`
- [X] T033 [US4] Asegurar que las operaciones de invalidación proactiva capturen errores de Redis sin abortar transacciones de base de datos ni procesos de recálculo en `backend/src/services/quotation/listeners/quotation-cache-invalidation.listener.ts`

**Checkpoint**: User Story 4 completa: resiliencia fail-open validada ante contingencias de infraestructura.

---

## Phase 7: User Story 5 - Optimización de acceso a datos mediante índices medidos en base de datos (Priority: P2)

**Goal**: Crear los índices compuestos medidos en `players` y `player_quotes` y optimizar la consulta SQL de ranking en el repositorio para suprimir ordenamientos globales en memoria.

**Independent Test**: Ejecutar `migration:run`; verificar mediante `EXPLAIN ANALYZE` que las consultas de catálogo y ranking sobre jugadores activos resuelven por *Index Scan* sin escaneo secuencial.

### Tests para User Story 5

- [X] T034 [P] [US5] Crear prueba de integración para la migración de índices en `backend/src/database/migration-specs/add-performance-indexes-migration.integration.spec.ts`
- [X] T035 [P] [US5] Crear pruebas de integración en `backend/src/repositories/player/player.repository.integration.spec.ts` validando el rendimiento y corrección del ordenamiento del ranking con cotizaciones históricas acumuladas

### Implementación para User Story 5

- [X] T036 [US5] Crear migración TypeORM `backend/src/database/migrations/1793200000000-AddPerformanceIndexes.ts` agregando `idx_players_removed_league_position` y `idx_player_quotes_user_player_calc_desc` de forma idempotente con `IF NOT EXISTS`
- [X] T037 [US5] Actualizar metadatos de índices en `PlayerEntity` en `backend/src/repositories/player/entities/player.entity.ts`
- [X] T038 [US5] Actualizar metadatos de índices en `PlayerQuoteEntity` en `backend/src/repositories/quotation/entities/player-quote.entity.ts`
- [X] T039 [US5] Optimizar la consulta SQL en `PlayerRepository.findRanking` en `backend/src/repositories/player/player.repository.ts` para aprovechar el índice descendente y evitar ordenamientos redundantes de filas históricas

**Checkpoint**: User Story 5 completa: base de datos indexada según patrones reales medidos y consultas optimizadas.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Pruebas end-to-end completas, validación de métricas, guía de inicio rápido y aseguramiento de calidad de código.

- [X] T040 Crear suite de pruebas end-to-end completa en `backend/test/e2e/redis-cache-fallback.e2e-spec.ts` cubriendo aciertos de caché, invalidación reactiva por recálculo/estrategia, resiliencia fail-open y fallback de API externa
- [X] T041 Ejecutar y validar todos los escenarios descritos en `specs/031-redis-cache-fallback/quickstart.md`
- [X] T042 [P] Verificar cumplimiento de métricas y latencias SLA en `GET /metrics` y paneles de Grafana
- [X] T043 [P] Ejecutar linters y suite completa de pruebas unitarias e integración (`pnpm lint`, `pnpm test`) garantizando cero regresiones

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — puede ejecutarse de inmediato.
- **Foundational (Phase 2)**: Depende de Phase 1 — **BLOQUEA** a todas las historias de usuario.
- **User Stories (Phase 3 a 7)**: Dependen de Phase 2.
  - **User Story 1 (P1)**: Catálogo y detalle en caché (MVP).
  - **User Story 2 (P1)**: Ranking por usuario e invalidación reactiva.
  - **User Story 3 (P1)**: Fallback ante caídas externas (puede correr en paralelo con US1/US2).
  - **User Story 4 (P2)**: Fail-open de Redis (refuerza US1, US2 y US3).
  - **User Story 5 (P2)**: Índices y optimización SQL en PostgreSQL (independiente de la lógica de caché).
- **Polish (Phase 8)**: Depende de la finalización de las historias de usuario.

### Parallel Opportunities

- T003 (env variables) en paralelo con T001 y T002.
- T004 y T005 (`buildCacheKey` y sus tests) en paralelo con T006 y T007 (`RedisCacheService`).
- Una vez completada la Phase 2:
  - US1 (Catálogo), US2 (Ranking) y US3 (Fallback externo) pueden desarrollarse en paralelo al operar sobre capas y archivos desacoplados.
  - Las tareas de test [P] dentro de cada historia de usuario se ejecutan en paralelo antes de la implementación.
  - US5 (Índices y migración TypeORM) puede ejecutarse en paralelo con el desarrollo de la capa de caché.

---

## Parallel Example: User Story 1 & User Story 2

```bash
# Lanzar tests de US1 y US2 en paralelo:
Task T009: "Unit tests de PlayerEnrichmentService para catálogo en player-enrichment.service.spec.ts"
Task T015: "Unit tests de PlayerEnrichmentService para ranking en player-enrichment.service.spec.ts"
Task T016: "Unit tests de QuotationCacheInvalidationListener en quotation-cache-invalidation.listener.spec.ts"

# Trabajar en implementaciones desacopladas:
Task T011 / T012: Cache-Aside de catálogo y detalle en PlayerEnrichmentService
Task T018: Cache-Aside de ranking en PlayerEnrichmentService
Task T019: Listener de eventos de invalidación en quotation-cache-invalidation.listener.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Completar Phase 1: Setup (`docker-compose.yml`, `package.json`, variables de entorno).
2. Completar Phase 2: Foundational (`buildCacheKey`, `RedisCacheService`, `RedisCacheModule`).
3. Completar Phase 3: User Story 1 (Cache-Aside en catálogo y detalle de jugadores).
4. **VALIDAR**: Probar acierto de caché en `GET /players` y medir latencia < 15 ms.

### Incremental Delivery
1. Setup + Foundational → Base de caché operativa.
2. US1 → Catálogo y detalle cacheados con invalidación en sync (**MVP**).
3. US2 → Ranking cacheado por usuario con invalidación reactiva por recálculo o estrategia.
4. US3 → Fallback de 2 niveles ante caídas de APIs externas (sin errores 500).
5. US4 → Resiliencia fail-open ante caídas de Redis.
6. US5 → Índices compuestos medidos y optimización de consulta SQL en PostgreSQL.
7. Phase 8 → Pruebas e2e integradas, verificación de métricas y validación completa del Quickstart.
