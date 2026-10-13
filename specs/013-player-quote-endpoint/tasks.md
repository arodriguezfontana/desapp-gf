# Tasks: Consulta de Cotización de Jugador (GET /players/:id/quote)

**Feature Branch**: `013-player-quote-endpoint`
**Specification**: [spec.md](./spec.md)
**Implementation Plan**: [plan.md](./plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verificación de estructura y dependencias de la feature.

- [X] T001 Verificar entorno de desarrollo y dependencias de compilación en `backend/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Contratos de repositorio, implementación de base de datos y DTOs requeridos por todas las historias de usuario.

**⚠️ CRITICAL**: Ninguna historia de usuario puede implementarse hasta completar esta fase.

- [X] T002 [P] Declarar el método `findLatestAtDate(playerId: string, date: Date): Promise<PlayerQuote | null>` en la interfaz de dominio `backend/src/repositories/quotation/player-quote.repository.ts`
- [X] T003 Implementar el método `findLatestAtDate(playerId: string, date: Date): Promise<PlayerQuote | null>` en `backend/src/repositories/quotation/typeorm-player-quote.repository.ts` ejecutando la consulta `WHERE player_id = :playerId AND calculated_at <= :date ORDER BY calculated_at DESC LIMIT 1`
- [X] T004 [P] Crear el DTO de respuesta `PlayerQuoteDetailResponseDto` en `backend/src/controllers/player/dto/player-quote-detail-response.dto.ts` con campos `playerId` (UUID), `valor` (DECIMAL 10,2), `score` (DECIMAL 8,6), `strategyName` (string), `weights` (JSON snapshot `Record<string, number>`) y `calculatedAt` (ISO 8601 string)
- [X] T005 Exportar `QuotationService` en `backend/src/modules/quotation/quotation.module.ts` e importar `QuotationModule` (usando `forwardRef` para resolver dependencia circular si corresponde) en `backend/src/modules/player/player.module.ts`

**Checkpoint**: Base de persistencia y DTOs listos. La implementación de historias de usuario puede comenzar.

---

## Phase 3: User Story 1 - Consultar cotización vigente más reciente de un jugador (Priority: P1) 🎯 MVP

**Goal**: Permitir consultar `GET /players/:id/quote` sin parámetro `at`, retornando la cotización más reciente del jugador (200 OK con DTO), 204 No Content si el jugador no tiene cotizaciones, 404 Not Found si no existe (`PLAYER_NOT_FOUND`), y 401 si falta ApiKey.

**Independent Test**: Invocar `GET /players/:id/quote` para un jugador existente con cotizaciones y verificar que devuelve status 200 con la cotización más reciente y todos sus campos de ponderación y valor.

### Tests for User Story 1

- [X] T006 [P] [US1] Crear test unitario para `QuotationService.getQuoteAtDate` en `backend/src/services/quotation/__tests__/quotation.service.spec.ts` validando existencia de jugador (lanza `PlayerNotFoundError`), retorno de última cotización con `strategyName`, y retorno de `null` sin excepción cuando no hay cotizaciones

### Implementation for User Story 1

- [X] T007 [US1] Implementar el método `getQuoteAtDate(playerId: string, date?: Date)` en `backend/src/services/quotation/quotation.service.ts` validando existencia de jugador vía `playerRepository.findById` (lanzando `PlayerNotFoundError`), obteniendo cotización vigente y resolviendo `strategyName` vía `strategyRepository.findById`
- [X] T008 [US1] Implementar el endpoint `@Get(':id/quote')` en `backend/src/controllers/player/player.controller.ts` protegido con `ApiKeyGuard` y `@Public()`, delegando a `quotationService.getQuoteAtDate(id)` y retornando 200 con `PlayerQuoteDetailResponseDto` o 204 No Content sin cuerpo vía `@Res({ passthrough: true })`
- [X] T009 [US1] Implementar test de integración/e2e con Testcontainers en `backend/test/quotation/player-quote-latest.e2e-spec.ts` validando respuestas 200 (cotización encontrada), 204 (jugador sin cotizaciones), 404 (jugador inexistente) y 401 (sin ApiKey)

**Checkpoint**: MVP funcional. `GET /players/:id/quote` opera de manera completa e independiente.

---

## Phase 4: User Story 2 - Consultar cotización histórica vigente en una fecha dada (Priority: P2)

**Goal**: Permitir consultar la cotización histórica vigente al cierre de una fecha dada mediante `GET /players/:id/quote?at=...`, retornando la cotización calculada con `calculatedAt <=` final del día UTC (23:59:59.999Z), 400 Bad Request ante formato de fecha inválido, y 204 si la fecha es anterior a cualquier cotización del jugador.

**Independent Test**: Invocar `GET /players/:id/quote?at=2026-09-15` para un jugador con cotizaciones en fechas previas y posteriores, verificando que devuelve la cotización vigente al cierre de esa fecha.

### Tests for User Story 2

- [X] T010 [P] [US2] Crear test unitario para `ParseDatePipe` en `backend/src/controllers/player/pipes/__tests__/parse-date.pipe.spec.ts` verificando pasaje de `undefined`, cálculo de final del día UTC (`23:59:59.999Z`), y lanzamiento de `BadRequestException` ante fechas inválidas

### Implementation for User Story 2

- [X] T011 [US2] Implementar `ParseDatePipe` en `backend/src/controllers/player/pipes/parse-date.pipe.ts` validando formato de fecha y calculando el timestamp de final del día en UTC (`23:59:59.999Z`), lanzando `BadRequestException` si no parsea como fecha válida
- [X] T012 [US2] Conectar `@Query('at', ParseDatePipe) at?: Date` en el endpoint `@Get(':id/quote')` de `backend/src/controllers/player/player.controller.ts` y transferir el parámetro `date` a `quotationService.getQuoteAtDate(id, at)`
- [X] T013 [US2] Implementar test de integración/e2e con Testcontainers en `backend/test/quotation/player-quote-historical.e2e-spec.ts` validando cotizaciones históricas, semántica `calculatedAt <= date`, status 204 previo a la primera cotización y status 400 ante fecha inválida

**Checkpoint**: Historias de usuario 1 y 2 completamente operativas e integradas.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Documentación, especificaciones de API y validaciones de calidad de código.

- [X] T014 [P] Documentar el endpoint `GET /players/:id/quote` con decoradores de `@nestjs/swagger` (`@ApiOperation`, `@ApiResponse` para 200, 204, 400, 401, 404, y `@ApiSecurity('ApiKeyAuth')`) en `backend/src/controllers/player/player.controller.ts`
- [X] T015 [P] Actualizar la colección de Postman con requests para `GET /players/:id/quote` (con y sin parámetro `at`) en `docs/postman/desapp.postman_collection.json`
- [X] T016 Ejecutar suite de arquitectura `backend/test/architecture.spec.ts` y validar compilación limpia con `pnpm build` en `backend/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias, inicio inmediato.
- **Foundational (Phase 2)**: Depende de Setup. Bloquea las historias de usuario.
- **User Story 1 (Phase 3)**: Depende de Foundational (T002 - T005).
- **User Story 2 (Phase 4)**: Depende de Foundational y amplía el endpoint de US1 con el query parameter `at`.
- **Polish (Phase 5)**: Depende de la finalización de US1 y US2.

### Within Each User Story

- Tests unitarios primero (T006 para US1, T010 para US2).
- Lógica de repositorio / servicio antes de cablear el controlador.
- Test e2e final para verificar integración de extremo a extremo.

---

## Parallel Opportunities

- **Fase 2**: T002 (`player-quote.repository.ts`) y T004 (`player-quote-detail-response.dto.ts`) pueden desarrollarse en paralelo por tocar archivos distintos.
- **Fase 3**: T006 (unit test) puede escribirse en paralelo con la preparación de contratos.
- **Fase 4**: T010 (`parse-date.pipe.spec.ts`) y T011 (`parse-date.pipe.ts`) pueden implementarse como unidad aislada antes de conectar el endpoint.
- **Fase 5**: T014 (Swagger) y T015 (Postman) pueden ejecutarse en paralelo.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Fase 1 y Fase 2 (Foundational).
2. Implementar Fase 3 (User Story 1: consulta actual de cotización).
3. **Validar MVP**: El endpoint ya funciona para consultar precios actuales de jugadores con control de acceso por ApiKey.

### Incremental Delivery

1. Setup + Foundational completado.
2. User Story 1 añadida -> Validación independiente -> MVP entregado.
3. User Story 2 añadida -> Soporte de histórico con `at` -> Feature completa.
4. Polish -> Swagger, Postman y verificación de arquitectura tsarch.

