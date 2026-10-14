# Implementation Plan: Perfiles de Pesos por Posición

**Branch**: `014-position-weight-profiles` | **Date**: 2026-10-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-position-weight-profiles/spec.md`

## Summary

Extender `ValuationStrategy` con un mapa opcional de perfiles de pesos por posición (`positionWeights`, jsonb, hasta 4 entradas FW/MF/DF/GK, cada una un subconjunto de métricas que debe sumar 1.0 ±0.001). Al calcular la cotización de un jugador, la función de dominio pura `calculatePlayerValue` selecciona automáticamente el perfil de la posición declarada del jugador si la estrategia activa lo define; si no, usa los pesos generales (comportamiento preexistente, sin flag). `PlayerQuote` registra en su snapshot qué conjunto de pesos se usó mediante un nuevo campo `appliedPosition: Position | null`. Dos migraciones (columnas + seed de los 8 perfiles especificados) y una actualización menor del frontend (`PlayerDetailPage`) para mostrar el origen de la cotización vigente.

## Technical Context

**Language/Version**: Node.js 20, TypeScript 5.7 `strict` (backend); TypeScript + React 19 (frontend) — sin cambios respecto al stack ya establecido.

**Primary Dependencies**: NestJS 11, TypeORM (backend, ya en uso para `ValuationStrategy`/`PlayerQuote`); React 19 + Vite + Tailwind (frontend, ya en uso para `PlayerDetailPage`).

**Storage**: PostgreSQL vía TypeORM. Dos columnas nuevas: `valuation_strategies.position_weights` (`jsonb`, nullable) y `player_quotes.applied_position` (`varchar(2)`, nullable).

**Testing**: Jest + Testcontainers + tsarch (backend, siguiendo el patrón ya usado en `calculate-player-value.spec.ts` y `quotation.service.integration.spec.ts`); Vitest + React Testing Library (frontend, `PlayerDetailPage.spec.tsx`).

**Target Platform**: Web (aplicación ya desplegada; sin cambios de plataforma).

**Project Type**: Web (monorepo `backend/` + `frontend/`, Opción 2 de la estructura del plan — ya establecida).

**Performance Goals**: Ninguno nuevo. El recálculo masivo sigue siendo O(n) en jugadores; esta feature añade un lookup `O(1)` por jugador (`positionWeights[position]`), sin impacto medible sobre el SC-003 de 012-valuation-strategies (<30s para 1.000 jugadores).

**Constraints**: Ninguna restricción nueva más allá de las ya vigentes (constitución: columnas de pesos sin `float`/`double`; dominio sin dependencias de NestJS/TypeORM).

**Scale/Scope**: 2 estrategias seedeadas × hasta 4 perfiles de posición cada una × 3-5 métricas por perfil — volumen trivial, sin implicancias de escala.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Arquitectura en capas | PASS. El cambio vive en dominio (`ValuationStrategy`, `PlayerQuote`, `calculate-player-value.ts`), Repository/Mapper (nuevas columnas) y Controller (DTOs). Ningún Service adquiere lógica de cálculo propia; `QuotationService` solo pasa el resultado de `calculatePlayerValue` al snapshot. |
| II. Modelo de dominio rico | PASS. La selección de perfil vs. pesos generales y la validación de suma=1.0 por perfil viven en `ValuationStrategy`/`calculate-player-value.ts`, no en Service ni Controller. Cada cotización sigue registrando snapshot reproducible (ahora con el origen del peso incluido). |
| III. Cada validación en su nivel | PASS. La validación de suma de pesos por perfil ocurre en el dominio (`ValuationStrategy.create`), igual que ya ocurre para los pesos generales; no se duplica en DTO ni Service. |
| IV. Autenticación | N/A. No se agregan ni modifican endpoints protegidos; los endpoints existentes (`GET /quotes/player/:playerId`, `GET /players/:id/quote`) mantienen su guard actual (`ApiKeyGuard`). |
| V. Auditoría inmutable | N/A. No hay operaciones de compra/venta de tokens involucradas. |
| VI. Integridad transaccional | N/A. No hay una operación que modifique múltiples estados a la vez; el recálculo ya persiste `PlayerQuote` fila por fila, sin cambios en esa unidad. |
| VII. Observabilidad | PASS (sin cambios). No se agregan nuevas rutas ni se afecta el middleware de correlación existente. |
| VIII. Documentación de la API | PASS, condicionado: los DTOs `PlayerQuoteResponseDto` y `PlayerQuoteDetailResponseDto` se extienden con el nuevo campo; Swagger se regenera automáticamente desde los decoradores (sin edición manual). |
| IX. Testing | PASS, condicionado: se extienden los tests de dominio puro de `calculate-player-value.spec.ts` y `valuation-strategy.spec.ts` (perfil presente, perfil ausente, estrategia sin perfiles) y se agrega un test de componente para `PlayerDetailPage` que verifica el nuevo indicador. |
| X. Definición de terminado | PASS, condicionado: ver tasks.md para checklist de tests backend+frontend, build, Swagger y Postman. |
| XI. Idioma | PASS. `appliedPosition`/`positionWeights` en inglés (identificadores); mensajes de error y UI en español. |
| XII. Spec-first | PASS. Esta feature nace de `specs/014-position-weight-profiles/spec.md`, ya clarificado. |

Sin violaciones. No se requiere Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/014-position-weight-profiles/
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
│   ├── domain/
│   │   ├── player/
│   │   │   └── enums/position.ts                      # Reutilizado (sin cambios): FW/MF/DF/GK
│   │   └── quotation/
│   │       ├── valuation-strategy.ts                   # + positionWeights, validación por perfil
│   │       ├── player-quote.ts                         # + appliedPosition
│   │       ├── calculate-player-value.ts                # selección de perfil vs. pesos generales
│   │       └── __tests__/
│   │           ├── valuation-strategy.spec.ts            # + casos de positionWeights
│   │           └── calculate-player-value.spec.ts        # + casos de perfil/fallback
│   ├── repositories/quotation/
│   │   ├── entities/
│   │   │   ├── valuation-strategy.entity.ts              # + columna position_weights (jsonb)
│   │   │   └── player-quote.entity.ts                    # + columna applied_position (varchar)
│   │   ├── valuation-strategy.mapper.ts                  # + mapeo positionWeights
│   │   └── player-quote.mapper.ts                        # + mapeo appliedPosition
│   ├── services/quotation/
│   │   └── quotation.service.ts                          # usa el weightsUsed/appliedPosition devuelto por calculatePlayerValue
│   ├── controllers/
│   │   ├── quotation/dto/player-quote-response.dto.ts     # + appliedPosition
│   │   └── player/dto/player-quote-detail-response.dto.ts # + appliedPosition
│   └── database/migrations/
│       ├── <ts>-AddPositionWeightsColumns.ts              # ALTER TABLE ×2
│       └── <ts+1d>-SeedPositionWeightProfiles.ts          # UPDATE de los 2 seeds existentes
└── test/
    └── quotation/                                        # e2e existentes, sin nuevo endpoint que cubrir

frontend/
└── src/
    ├── types/catalog.types.ts                             # PlayerQuote.appliedPosition
    └── pages/
        ├── PlayerDetailPage.tsx                            # indicador perfil/pesos generales
        └── PlayerDetailPage.spec.tsx                       # + caso de test del indicador
```

**Structure Decision**: Se reutiliza la estructura por capas ya existente en `backend/src/{domain,repositories,services,controllers}/quotation` y `backend/src/domain/player/enums/position.ts` (sin crear módulos nuevos); en frontend, el cambio es puntual dentro de `pages/PlayerDetailPage.tsx` y el tipo `PlayerQuote` de `types/catalog.types.ts`, sin tocar `service/` ni `hooks/` porque el shape de la respuesta ya fluye sin transformación adicional desde `catalogService.getLatestQuoteByPlayerId`.
