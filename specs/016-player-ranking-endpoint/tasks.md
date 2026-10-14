# Tasks: Ranking de Jugadores por Cotización Vigente (GET /players/ranking)

**Branch**: `016-player-ranking-endpoint` | **Date**: 2026-10-14 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 1: Setup (Shared Infrastructure & Domain Types)

**Purpose**: Definir las interfaces de dominio y tipos compartidos para el ranking de jugadores.

- [X] T001 [P] Crear las interfaces de dominio `RankedPlayerQuote`, `PlayerRankingPage`, `RankedPlayerWithCrest` y `PlayerRankingPageWithCrests` en `backend/src/domain/player/player-ranking.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestructura central de acceso a datos y servicios requerida antes de implementar los endpoints de historias de usuario.

**⚠️ CRITICAL**: No comenzar la implementación de historias de usuario hasta completar esta fase.

- [X] T002 Declarar el método `findRanking(filters: PlayerFilters, pagination: PlayerPagination): Promise<PlayerRankingPage>` en la interfaz del puerto `PlayerRepository` en `backend/src/repositories/player/player.repository.ts`
- [X] T003 Implementar `findRanking` en `backend/src/repositories/player/typeorm-player.repository.ts` utilizando CTE con `ROW_NUMBER() OVER (PARTITION BY pq.player_id ORDER BY pq.calculated_at DESC) = 1` y un `INNER JOIN` con `players` (`removed_at IS NULL`) y `valuation_strategies`, aplicando ordenamiento por `valor DESC`, `score DESC`, `id ASC` y paginación con `LIMIT` y `OFFSET`
- [X] T004 Escribir tests de integración para `TypeOrmPlayerRepository.findRanking` en `backend/src/repositories/player/typeorm-player.repository.integration.spec.ts` validando la ejecución del CTE contra PostgreSQL real, la exclusión de jugadores sin cotizaciones y el ordenamiento determinista
- [X] T005 [P] Implementar el método `findRanking` en `backend/src/services/player/player.service.ts` delegando la llamada al `PlayerRepository`
- [X] T006 [P] Escribir tests unitarios para `PlayerService.findRanking` en `backend/src/services/player/player.service.spec.ts`
- [X] T007 Implementar el método `getRankingWithCrests` en `backend/src/services/player/player-enrichment.service.ts` enriqueciendo cada jugador con su `crestUrl` vía `TeamRepository` y calculando la posición ordinal `rank = (pagination.page - 1) * pagination.pageSize + index + 1`
- [X] T008 Escribir tests unitarios para `PlayerEnrichmentService.getRankingWithCrests` en `backend/src/services/player/player-enrichment.service.spec.ts`

**Checkpoint**: Base de persistencia y servicios lista — la implementación de endpoints de usuario puede proceder.

---

## Phase 3: User Story 1 - Consultar ranking general ordenado por valor (Priority: P1) 🎯 MVP

**Goal**: Permitir consultar la lista de jugadores clasificados descendentemente por su cotización vigente (`valor`), asignando posiciones correlativas (`rank: 1..N`), exponiendo `valor`, `score`, `strategyName` y datos del jugador.

**Independent Test**: Enviar una solicitud `GET /players/ranking` con ApiKey válida teniendo jugadores con cotizaciones previas, verificando respuesta 200 con `items` ordenados estrictamente por `valor` desc, primer elemento con `rank: 1` y campos de cotización presentes.

### Tests para User Story 1 🧪

- [X] T009 [P] [US1] Escribir tests unitarios para el controlador `PlayerController.ranking` en `backend/src/controllers/player/player.controller.spec.ts`
- [X] T010 [P] [US1] Escribir tests e2e para `GET /players/ranking` (ordenamiento por valor, rank correlativo y estructura de items) en `backend/test/player/player-ranking.e2e.spec.ts`

### Implementación para User Story 1

- [X] T011 [P] [US1] Crear el DTO de respuesta individual `PlayerRankingResponseDto` con campos `rank`, `id`, `name`, `league`, `team`, `position`, `crestUrl`, `valor`, `score`, `strategyName` y estadísticas en `backend/src/controllers/player/dto/player-ranking-response.dto.ts`
- [X] T012 [P] [US1] Crear el DTO contenedor paginado `PlayerRankingListResponseDto` con campos `items`, `total`, `page`, `pageSize` en `backend/src/controllers/player/dto/player-ranking-list-response.dto.ts`
- [X] T013 [US1] Exponer el endpoint `@Get('ranking')` en `backend/src/controllers/player/player.controller.ts` **ubicado antes de `@Get(':id')`** para evitar colisión de rutas en NestJS, transformando los filtros al dominio y retornando `PlayerRankingListResponseDto`

**Checkpoint**: User Story 1 completamente funcional e independientemente verificable (MVP alcanzado).

---

## Phase 4: User Story 2 - Paginación y navegación del ranking (Priority: P2)

**Goal**: Permitir la navegación fluida entre páginas del ranking (`page`, `pageSize`), garantizando la continuidad secuencial del `rank` a través del offset y manejando páginas fuera de rango.

**Independent Test**: Solicitar `page=2&pageSize=5` y comprobar que los elementos devueltos contienen `rank` del 6 al 10 y que `total` refleja el universo completo; solicitar `page=99` y comprobar respuesta 200 con `items: []`.

### Tests para User Story 2 🧪

- [X] T014 [P] [US2] Escribir tests e2e de paginación para `GET /players/ranking` en `backend/test/player/player-ranking.e2e.spec.ts` verificando la continuidad de `rank` entre páginas consecutivas y respuesta 200 con lista vacía en páginas fuera de rango

### Implementación para User Story 2

- [X] T015 [US2] Asegurar la validación de `page` (min 1, default 1) y `pageSize` (min 1, max 50, default 10) en los DTOs de query y controller en `backend/src/controllers/player/player.controller.ts`

**Checkpoint**: User Stories 1 y 2 funcionando y testeadas de forma independiente.

---

## Phase 5: User Story 3 - Filtrado por liga, equipo y posición (Priority: P2)

**Goal**: Permitir acotar el ranking aplicando filtros independientes o combinados (AND) por `league`, `position` y `team`, retornando 200 OK con lista vacía ante búsquedas sin coincidencias.

**Independent Test**: Solicitar `GET /players/ranking?league=La%20Liga&position=FW`, verificando que todos los registros pertenecen a esa liga y posición con `rank` 1..N dentro del subconjunto; solicitar un equipo inexistente y comprobar 200 OK con `items: []` y `total: 0`.

### Tests para User Story 3 🧪

- [X] T016 [P] [US3] Escribir tests de integración y e2e para filtros combinados (`league`, `position`, `team`) y caso de búsqueda vacía (200 OK con `total: 0`) en `backend/test/player/player-ranking.e2e.spec.ts`

### Implementación para User Story 3

- [X] T017 [US3] Habilitar y mapear los parámetros `league`, `position` y `team` en el manejador `@Get('ranking')` en `backend/src/controllers/player/player.controller.ts`, delegando los filtros a `PlayerEnrichmentService` y `PlayerRepository`

**Checkpoint**: User Stories 1, 2 y 3 operativas e integradas.

---

## Phase 6: User Story 4 - Exclusión de no cotizados y manejo de cambios de estrategia (Priority: P3)

**Goal**: Garantizar que solo los jugadores con al menos una cotización aparezcan en el ranking, seleccionando su cotización más reciente por `calculatedAt` y reportando el `strategyName` correcto aun cuando la estrategia activa del sistema haya cambiado.

**Independent Test**: Crear jugadores sin cotización y verificar que no figuran en el ranking; modificar la estrategia activa sin recalcular y verificar que se reportan las cotizaciones previas con su nombre de estrategia original.

### Tests para User Story 4 🧪

- [X] T018 [P] [US4] Escribir tests de integración en `backend/src/repositories/player/typeorm-player.repository.integration.spec.ts` verificando que jugadores sin registros en `player_quotes` son omitidos, y que para jugadores con múltiples cotizaciones se selecciona la más reciente por `calculatedAt`
- [X] T019 [P] [US4] Escribir test e2e en `backend/test/player/player-ranking.e2e.spec.ts` verificando la resolución de `strategyName` histórico ante cambios en la estrategia activa

**Checkpoint**: Exclusión de no cotizados y resiliencia de estrategias verificadas.

---

## Phase 7: User Story 5 - Protección de acceso mediante ApiKey (Priority: P3)

**Goal**: Restringir el acceso a `GET /players/ranking` exclusivamente a clientes autenticados con una ApiKey válida, rechazando solicitudes no autorizadas con 401.

**Independent Test**: Realizar peticiones sin header `x-api-key`, con claves falsas o con tokens JWT, comprobando status 401 Unauthorized en todos los casos.

### Tests para User Story 5 🧪

- [X] T020 [P] [US5] Escribir tests e2e de autenticación y seguridad en `backend/test/player/player-ranking.e2e.spec.ts` verificando rechazo 401 ante ausencia de ApiKey, ApiKey inválida o presentación de JWT

### Implementación para User Story 5

- [X] T021 [US5] Verificar y asegurar que `@Get('ranking')` en `backend/src/controllers/player/player.controller.ts` aplique correctamente los decoradores de seguridad `@ApiSecurity('ApiKeyAuth')`, `@Public()` y `ApiKeyGuard` a nivel de clase o método

**Checkpoint**: Seguridad y control de acceso verificado.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentación formal, actualización de artefactos compartidos y validación integral.

- [X] T022 [P] Documentar el endpoint en OpenAPI/Swagger mediante decoradores `@ApiOperation`, `@ApiResponse` (200, 400, 401) y `@ApiQuery` en `backend/src/controllers/player/player.controller.ts`
- [X] T023 [P] Actualizar la colección de Postman incorporando la solicitud `GET /players/ranking` con ejemplos en `docs/postman/desapp.postman_collection.json`
- [X] T024 Ejecutar la suite completa de pruebas del backend (`pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`) y verificar compilación limpia (`pnpm build`)
- [X] T025 Ejecutar las pruebas de validación descritas en `specs/016-player-ranking-endpoint/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — inicia de inmediato creando tipos de dominio.
- **Foundational (Phase 2)**: Depende de Phase 1 — BLOQUEA todas las historias de usuario.
- **User Stories (Phases 3 a 7)**: Dependen de Phase 2.
  - US1 (P1): MVP del ranking general y DTOs de respuesta.
  - US2 (P2): Paginación y validación de rangos (depende de US1).
  - US3 (P2): Filtrado por liga/posición/equipo y lista vacía (depende de US1).
  - US4 (P3): Integridad de quotes y estrategias (amplía la suite de integración de US1).
  - US5 (P3): Seguridad y guards (valida las reglas de acceso sobre el endpoint de US1).
- **Polish (Phase 8)**: Depende de la finalización de las historias de usuario deseadas.

### User Story Dependencies

```
Phase 1 (Setup: Types)
       │
       ▼
Phase 2 (Foundational: Repository CTE & Services)
       │
       ▼
Phase 3 (US1 - General Ranking Endpoint & DTOs) [MVP]
       ├───► Phase 4 (US2 - Pagination & Rank Continuity)
       ├───► Phase 5 (US3 - Filters & Empty Result 200 OK)
       ├───► Phase 6 (US4 - Quote Recency & Strategy Name)
       └───► Phase 7 (US5 - ApiKey Authentication & Guard)
                     │
                     ▼
       Phase 8 (Polish, Swagger, Postman, Tests & Build)
```

---

## Parallel Execution Opportunities

- **Fase 1**: `T001` puede crearse de inmediato.
- **Fase 2**: Una vez completado `T003` (repositorio), `T005` y `T006` (servicio) pueden avanzar en paralelo con `T007` y `T008` (enriquecimiento).
- **Fase 3**: Los DTOs `T011` y `T012`, junto con los tests `T009` y `T010`, pueden escribirse en paralelo antes de enlazar el endpoint en `T013`.
- **Fases 4 a 7**: Los tests específicos de paginación (`T014`), filtros (`T016`), recency (`T018`, `T019`) y autenticación (`T020`) pueden prepararse de forma independiente sobre el endpoint base de US1.
- **Fase 8**: La documentación de Swagger (`T022`) y la actualización de Postman (`T023`) pueden ejecutarse concurrentemente.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar **Phase 1: Setup** (interfaces de dominio en `player-ranking.ts`).
2. Completar **Phase 2: Foundational** (`findRanking` en `TypeOrmPlayerRepository`, `PlayerService`, `PlayerEnrichmentService`).
3. Completar **Phase 3: User Story 1** (DTOs de ranking y ruta `@Get('ranking')` en `PlayerController`).
4. **Detenerse y validar**: Probar `GET /players/ranking` con `curl` o test e2e para verificar orden por valor y cálculo de `rank`.

### Incremental Delivery

1. Setup + Foundational terminados → Base lista.
2. US1 implementada → Ranking general operativo (MVP).
3. US2 y US3 añadidas → Paginación controlada y filtros combinados.
4. US4 y US5 verificadas → Integridad de cotizaciones y protección por ApiKey asegurada.
5. Polish → Swagger, Postman y verificación de calidad completa.

