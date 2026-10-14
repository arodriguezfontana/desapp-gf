# Implementation Plan: Ranking de Jugadores por Cotización Vigente (GET /players/ranking)

**Branch**: `016-player-ranking-endpoint` | **Date**: 2026-10-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/016-player-ranking-endpoint/spec.md`

## Summary

Implementar el endpoint `GET /players/ranking` para consultar el listado de futbolistas clasificados en orden descendente según su cotización vigente (`valor`), utilizando el último quote disponible de cada jugador bajo una estrategia activa o previa.
- En `PlayerRepository` / `TypeOrmPlayerRepository`, agregar el método `findRanking(filters: PlayerFilters, pagination: PlayerPagination): Promise<PlayerRankingPage>` ejecutando una consulta SQL que emplea un CTE con la función de ventana `ROW_NUMBER() OVER (PARTITION BY pq.player_id ORDER BY pq.calculated_at DESC) = 1` y un `INNER JOIN` con `players` (`removed_at IS NULL`) y `valuation_strategies`. Se aplican filtros condicionales por `league`, `position` y `team`, y ordenamiento determinista por `valor DESC`, `score DESC`, `id ASC` junto con `LIMIT` y `OFFSET`.
- En `PlayerService`, incorporar `findRanking(filters: PlayerFilters, pagination: PlayerPagination)` que delega directamente al repositorio.
- En `PlayerEnrichmentService`, implementar `getRankingWithCrests(filters: PlayerFilters, pagination: PlayerPagination): Promise<PlayerRankingPageWithCrests>` que obtiene el resultado de `PlayerService`, enriquece los escudos de los clubes mediante `teams.findByWhoScoredName` y calcula la posición ordinal secuencial `rank = (pagination.page - 1) * pagination.pageSize + index + 1`.
- En `PlayerController`, exponer la ruta `@Get('ranking')` **ubicada antes de `@Get(':id')`** para evitar colisiones de rutas en NestJS, protegida con `ApiKeyGuard` y `@Public()`. Reutiliza la validación de query (`ListPlayersQueryDto` / `PlayerRankingQueryDto`) y retorna `200 OK` con `PlayerRankingListResponseDto`. Si no hay coincidencias, devuelve lista vacía `items: []` con `total: 0`.

## Technical Context

**Language/Version**: TypeScript 5.7, Node.js 22 LTS, NestJS 11

**Primary Dependencies**: `@nestjs/common`, `@nestjs/swagger`, `typeorm` (PostgreSQL), `class-validator`, `class-transformer`

**Storage**: PostgreSQL 16 (tablas existentes `players`, `player_quotes`, `valuation_strategies`, `teams`). Sin modificaciones de esquema DDL.

**Testing**: Jest (unit tests para controladores, servicios y DTOs; integration tests con Postgres real para `TypeOrmPlayerRepository.findRanking`; e2e tests con `supertest`).

**Target Platform**: Backend NestJS (REST API)

**Project Type**: Monorepo web service

**Performance Goals**: Tiempo de respuesta < 500 ms p95 para consultas de ranking con paginación sobre base completa de jugadores y cotizaciones.

**Constraints**: Respetar la arquitectura en capas (Principio I), el filtro único de excepciones (Principio III), la autenticación simétrica por `ApiKeyGuard` (Principio IV) y la precisión DECIMAL (10,2 para valor, 8,6 para score).

**Scale/Scope**: Catálogo de futbolistas de las 5 grandes ligas europeas con cotizaciones calculadas por el motor de pricing.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Impacto en esta Feature | Estado |
|---|---|---|
| **I. Arquitectura en capas** | `PlayerController` → `PlayerEnrichmentService` → `PlayerService` → `PlayerRepository` (`TypeOrmPlayerRepository`). El Controller no accede a repositorios ni entidades de persistencia. DTOs se transforman antes de cruzar hacia el servicio. | ✅ Cumple |
| **II. Modelo de dominio rico** | El ranking se expresa mediante tipos e interfaces de dominio (`RankedPlayerQuote`, `RankedPlayerWithCrest`). | ✅ Cumple |
| **III. Validaciones en su nivel** | DTO valida tipos y rangos de query params (`page`, `pageSize`, `league`, `position`). Errores canalizados por `AllExceptionsFilter`. Búsqueda vacía retorna 200 OK con `items: []`. | ✅ Cumple |
| **IV. Autenticación** | Protegido con `ApiKeyGuard` y decorado con `@Public()`, simétrico a `GET /players` y `GET /players/:id/quote`. | ✅ Cumple |
| **V. Auditoría inmutable** | Solo lectura (SELECT). No modifica registros ni cotizaciones históricas. | ✅ Cumple |
| **VI. Integridad transaccional** | Lectura idempotente y consistente. | ✅ Cumple |
| **VII. Observabilidad** | El exception filter emite logs estructurados sin filtrar información sensible ni stack traces. | ✅ Cumple |
| **VIII. Documentación API** | Documentado en Swagger mediante `@ApiOperation`, `@ApiResponse`, `@ApiQuery` y `@ApiSecurity('ApiKeyAuth')`. | ✅ Cumple |
| **IX. Testing** | Tests unitarios para Controller, DTOs y Servicios; tests de integración para el método `findRanking` de repositorio; test e2e del endpoint completo. | ✅ Cumple |
| **X. Definición de terminado** | Tests unitarios, integración y e2e pasando; Swagger y colección Postman actualizados; build limpio. | ✅ Cumple |
| **XI. Idioma** | Código, interfaces y variables en inglés; mensajes de usuario y documentación en español. | ✅ Cumple |
| **XII. Spec-first** | Especificación ratificada en `specs/016-player-ranking-endpoint/spec.md`. | ✅ Cumple |

## Project Structure

### Documentation (this feature)

```text
specs/016-player-ranking-endpoint/
├── plan.md              # Este archivo de planificación
├── research.md          # Investigación de CTE con Window Function y precedencia de rutas
├── data-model.md        # Definición de entidades de dominio, páginas y DTOs
├── quickstart.md        # Guía de validación paso a paso y comandos de test
├── contracts/
│   └── player-ranking-api.md # Contrato OpenAPI/HTTP de GET /players/ranking
├── checklists/
│   └── requirements.md  # Checklist de calidad de la especificación
└── tasks.md             # Tareas de implementación (/speckit-tasks)
```

### Source Code (repository root)

```text
backend/src/
├── controllers/
│   └── player/
│       ├── dto/
│       │   ├── player-ranking-response.dto.ts      # DTO de item con rank, valor, score, strategyName y stats
│       │   └── player-ranking-list-response.dto.ts # DTO contenedor con items, total, page, pageSize
│       ├── player.controller.ts                   # @Get('ranking') agregado antes de @Get(':id')
│       └── player.controller.spec.ts              # Unit tests del controlador para /players/ranking
│
├── domain/
│   └── player/
│       └── player-ranking.ts                      # Interfaces de dominio: RankedPlayerQuote, PlayerRankingPage
│
├── repositories/
│   └── player/
│       ├── player.repository.ts                   # Declaración del método findRanking(...)
│       ├── typeorm-player.repository.ts           # Implementación SQL CTE ROW_NUMBER() OVER ...
│       └── typeorm-player.repository.integration.spec.ts # Test de integración del CTE contra Postgres real
│
├── services/
│   └── player/
│       ├── player.service.ts                      # Delegación findRanking al repositorio
│       ├── player.service.spec.ts                 # Unit tests de PlayerService
│       ├── player-enrichment.service.ts           # getRankingWithCrests con rank correlativo y crestUrl
│       └── player-enrichment.service.spec.ts      # Unit tests de PlayerEnrichmentService
│
└── test/
    └── player/
        └── player-ranking.e2e.spec.ts             # Test e2e completo de GET /players/ranking
```

**Structure Decision**: Se mantiene la arquitectura modular y por capas existente del backend NestJS. El endpoint de ranking se ubica naturalmente en el módulo `player` (coordinado con datos de cotización y escudos), respetando el flujo `PlayerController` → `PlayerEnrichmentService` → `PlayerService` → `PlayerRepository`.

## Complexity Tracking

> Ninguna violación a los principios constitucionales. Todos los requisitos y constraints se satisfacen con el diseño estándar.
