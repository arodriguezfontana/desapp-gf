# Implementation Plan: Historial de Cotizaciones del Jugador

**Branch**: `015-player-quote-history` | **Date**: 2026-10-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-player-quote-history/spec.md`

## Summary

Agregar `GET /players/:id/quotes`: devuelve el array completo de `PlayerQuote` de un jugador (entidad ya existente de 012-valuation-strategies, extendida en 014-position-weight-profiles), ordenado ascendente por `calculatedAt`. 404 si el jugador no existe; 200 con `[]` si existe pero no tiene cotizaciones. Sin paginación. En el frontend, un componente de gráfico de líneas nuevo en `PlayerDetailPage` consume este endpoint vía `service/` y muestra la evolución del valor en el tiempo, con un estado vacío si no hay historial.

## Technical Context

**Language/Version**: Node.js 20, TypeScript 5.7 `strict` (backend); TypeScript + React 19 (frontend) — sin cambios respecto al stack ya establecido.

**Primary Dependencies**: NestJS 11, TypeORM (backend, reutiliza `PlayerQuoteEntity`/`PlayerQuoteRepository` ya existentes). Frontend: React 19 + Vite + Tailwind, sin librería de gráficos nueva (ver research.md Decisión 3).

**Storage**: PostgreSQL vía TypeORM. Ninguna columna ni migration nueva: se agrega un método de lectura (`findAllByPlayerId`) sobre la tabla `player_quotes` ya existente, usando su índice ya definido `(player_id, calculated_at DESC)` (012-valuation-strategies, data-model.md).

**Testing**: Jest + Testcontainers (backend, dominio puro + integración de repositorio + e2e); Vitest + React Testing Library (frontend, componente de gráfico + `PlayerDetailPage`).

**Target Platform**: Web (aplicación ya desplegada; sin cambios de plataforma).

**Project Type**: Web (monorepo `backend/` + `frontend/`, Opción 2 de la estructura del plan — ya establecida).

**Performance Goals**: Ninguno nuevo y explícito más allá de SC-001/SC-004 (una sola consulta, sin paginar). El volumen esperado (una cotización por jugador por semana, ver spec.md Assumptions) hace que un `SELECT ... ORDER BY calculated_at ASC` sin límite sea trivial incluso para jugadores con años de historial.

**Constraints**: Ninguna restricción nueva. El endpoint reutiliza `ApiKeyGuard` (no admin), igual que el resto de las consultas de catálogo/cotización (spec FR-007).

**Scale/Scope**: Un endpoint de lectura nuevo + un componente de frontend nuevo. Sin nuevas entidades de dominio ni migraciones.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Arquitectura en capas | PASS. El Controller (`PlayerController`) solo habla con el Service (`QuotationService`); el nuevo método de repositorio (`findAllByPlayerId`) vive detrás de la interfaz `PlayerQuoteRepository`, igual que los métodos ya existentes. Sin lógica de negocio en Controller/Service: el ordenamiento ascendente es una cláusula de la query del Repository, no una decisión de negocio que requiera el dominio. |
| II. Modelo de dominio rico | PASS. Se reutiliza `PlayerQuote` tal cual; esta feature no agrega lógica de cálculo nueva, solo lectura/listado de cotizaciones ya calculadas por 012/014. |
| III. Cada validación en su nivel | PASS. La existencia del jugador (404) se valida en el Service (mismo patrón que `getQuoteAtDate`, que ya lanza `PlayerNotFoundError`); no hay invariantes de dominio nuevas que validar. |
| IV. Autenticación | PASS. El endpoint usa `ApiKeyGuard` (no `AdminApiKeyGuard`), igual que `GET /players/:id/quote` y el resto de las consultas de catálogo — no es una operación de sistema ni expone datos sensibles nuevos. |
| V. Auditoría inmutable | N/A. No hay operación de compra/venta de tokens. |
| VI. Integridad transaccional | N/A. Es una lectura pura de datos ya persistidos; no modifica ningún estado. |
| VII. Observabilidad | PASS (sin cambios). No se agrega ninguna ruta que requiera logging estructurado adicional al ya existente a nivel de aplicación. |
| VIII. Documentación de la API | PASS, condicionado: el nuevo endpoint y su DTO de respuesta se documentan con decoradores `@ApiOperation`/`@ApiResponse` de `@nestjs/swagger`, generados automáticamente. |
| IX. Testing | PASS, condicionado: se agregan tests de integración del nuevo método de repositorio (Testcontainers) y tests e2e del endpoint (404, 200 vacío, 200 con varias cotizaciones ordenadas), más tests de componente del gráfico y de `PlayerDetailPage` en frontend. |
| X. Definición de terminado | PASS, condicionado: ver tasks.md para el checklist de tests, build, Swagger y Postman. |
| XI. Idioma | PASS. Identificadores en inglés (`findAllByPlayerId`, `PlayerQuoteHistoryResponseDto` si aplica); mensajes/UI en español. |
| XII. Spec-first | PASS. Nace de `specs/015-player-quote-history/spec.md`, ya clarificado (sin ambigüedades pendientes). |

Sin violaciones. No se requiere Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/015-player-quote-history/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── repositories/quotation/
│   │   ├── player-quote.repository.ts                 # + findAllByPlayerId(playerId): Promise<PlayerQuote[]>
│   │   └── typeorm-player-quote.repository.ts          # + implementación ORDER BY calculated_at ASC
│   ├── services/quotation/
│   │   └── quotation.service.ts                        # + getQuoteHistory(playerId): valida existencia del jugador, delega al repo
│   ├── controllers/
│   │   ├── player/
│   │   │   ├── player.controller.ts                    # + GET /players/:id/quotes
│   │   │   └── dto/player-quote-history-item.dto.ts     # reutiliza la forma de PlayerQuoteResponseDto
│   │   └── quotation/dto/player-quote-response.dto.ts   # reutilizado (sin cambios) como item del array
│   └── (sin migrations nuevas — mismo esquema de player_quotes)
└── test/quotation/
    └── player-quote-history.e2e-spec.ts                 # nuevo (no confundir con player-quote-historical.e2e-spec.ts de 013, que es ?at=)

frontend/
└── src/
    ├── service/catalogService.ts                        # + getQuoteHistoryByPlayerId(playerId)
    ├── hooks/useCatalog.ts                                # + getQuoteHistoryByPlayerId
    ├── components/
    │   ├── QuoteHistoryChart.tsx                          # nuevo: SVG line chart + estado vacío
    │   └── QuoteHistoryChart.spec.tsx                     # nuevo
    └── pages/
        ├── PlayerDetailPage.tsx                            # + sección que renderiza <QuoteHistoryChart />
        └── PlayerDetailPage.spec.tsx                       # + casos de historial con datos / vacío
```

**Structure Decision**: Se reutiliza íntegramente la estructura por capas ya existente (`backend/src/{repositories,services,controllers}/quotation` y `.../player`); no se crean módulos nuevos. En frontend, el gráfico se extrae a un componente propio en `components/` (reutilizable, sin llamadas HTTP propias — Constitución, Technology Stack & Constraints § Frontend) consumido desde `pages/PlayerDetailPage.tsx`, con su propio método en `service/catalogService.ts` y `hooks/useCatalog.ts`.
