# Implementation Plan: Estrategias de Valuación de Jugadores

**Branch**: `feat/strategies` | **Date**: 2026-10-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/012-valuation-strategies/spec.md`

## Summary

Implementar un sistema de valuación de jugadores basado en estrategias configurables. Una `ValuationStrategy` define pesos por métrica y un factor de escala; la función de cálculo normaliza las métricas del jugador a [0,1] usando bounds fijos, calcula el score ponderado y deriva el valor final (`1 + score × factorEscala`). Cada cotización calculada (`PlayerQuote`) persiste un snapshot completo de los parámetros para garantizar reproducibilidad histórica. El recálculo masivo puede dispararse manualmente vía `POST /quotes/recalculate` (protegido con `AdminApiKeyGuard`) o automáticamente mediante un job semanal, con lock en memoria para prevenir ejecuciones paralelas.

## Technical Context

**Language/Version**: TypeScript 5.7, Node.js 20, NestJS 11

**Primary Dependencies**: TypeORM (PostgreSQL), `@nestjs/schedule` (cron job), `@nestjs/swagger` (documentación)

**Storage**: PostgreSQL — nuevas tablas `valuation_strategies` y `player_quotes`; seed via migration TypeORM

**Testing**: Jest + supertest + Testcontainers (backend e2e/integración); Jest sin DB (tests unitarios de dominio)

**Target Platform**: Backend NestJS; no hay cambios de frontend en esta feature

**Project Type**: Web service (backend únicamente)

**Performance Goals**: Recálculo completo de hasta 1.000 jugadores en < 30 segundos

**Constraints**: Pesos y scores persistidos como `DECIMAL` con precision/scale explícitos (constitución v1.9.0). Lock de concurrencia en memoria (aceptado para alcance académico). Cálculo como función de dominio pura, sin NestJS ni TypeORM.

**Scale/Scope**: Catálogo actual de jugadores (~decenas a algunos cientos en contexto académico)

## Constitution Check

| Principio | Impacto | Estado |
|---|---|---|
| **I. Arquitectura en capas** | `QuotationController` → `QuotationService` → `{calculatePlayerValue (dominio), IValuationStrategyRepository, IPlayerQuoteRepository, IPlayerRepository}`. Función de cálculo en dominio sin NestJS. | ✅ Cumple |
| **II. Modelo de dominio rico** | `ValuationStrategy` y `PlayerQuote` son clases de dominio. La función `calculatePlayerValue` es lógica de dominio pura. Strategy pattern: `ValuationStrategy` es la estrategia; se intercambia activando/desactivando. | ✅ Cumple |
| **III. Validaciones en su nivel** | DTO valida presencia del header API key. Service valida existencia de estrategia activa. Dominio valida invariantes (suma de pesos, factorEscala > 0) en `ValuationStrategy.create()`. | ✅ Cumple |
| **IV. Autenticación** | `POST /quotes/recalculate` protegido con `AdminApiKeyGuard` existente (mismo patrón que sync-trigger). | ✅ Cumple |
| **V. Auditoría inmutable** | No aplica directamente. `PlayerQuote` es append-only por naturaleza (nunca se modifica). | ✅ N/A |
| **VI. Integridad transaccional** | La activación de una estrategia (desactivar todas + activar la nueva) ocurre en una transacción en el repositorio. | ✅ Cumple |
| **VII. Observabilidad** | `QuotationService` emite logs estructurados con correlation ID. El resultado del recálculo (procesados, errores, duración) se loguea. | ✅ Cumple |
| **VIII. Documentación API** | `@ApiOperation`, `@ApiResponse`, `@ApiBearerAuth` en `QuotationController`. Generado desde decoradores, no escrito a mano. | ✅ Cumple |
| **IX. Testing** | Tests unitarios de dominio sin NestJS ni DB (función `calculatePlayerValue`, `ValuationStrategy.create()`). Tests e2e con Testcontainers. No hay UI en esta feature. | ✅ Cumple |
| **X. Definición de terminado** | Tests unitarios + e2e en verde. `nest build` sin errores. Swagger actualizado. Postman actualizado. | ✅ A verificar al terminar |
| **XI. Idioma** | Identificadores en inglés (`ValuationStrategy`, `PlayerQuote`, `calculatePlayerValue`). Mensajes de error en español o inglés según convención del proyecto. | ✅ Cumple |
| **XII. Spec-first** | Esta spec existe y está ratificada. | ✅ Cumple |
| **Persistencia DECIMAL** | `factorEscala` → `DECIMAL(10,4)`. `score` → `DECIMAL(8,6)`. `value` → `DECIMAL(10,2)`. Pesos en jsonb (decimales dentro del JSON). | ✅ Cumple |

## Project Structure

### Documentation (this feature)

```text
specs/012-valuation-strategies/
├── plan.md              # Este archivo
├── research.md          # Decisiones de investigación resueltas
├── data-model.md        # Modelo de datos
├── quickstart.md        # Guía de validación
├── contracts/
│   └── quotes-api.md   # Contratos del endpoint
└── tasks.md             # Pendiente (/speckit-tasks)
```

### Source Code (repository root)

```text
backend/src/
├── domain/
│   └── quotation/
│       ├── valuation-strategy.ts          # Clase de dominio ValuationStrategy
│       ├── player-quote.ts                # Clase de dominio PlayerQuote
│       ├── calculate-player-value.ts      # Función pura de cálculo + NORMALIZATION_BOUNDS
│       └── errors/
│           ├── invalid-strategy-weights.error.ts
│           ├── no-active-strategy.error.ts
│           └── recalculation-in-progress.error.ts
│
├── repositories/
│   └── quotation/
│       ├── valuation-strategy.repository.ts        # Interfaz IValuationStrategyRepository
│       ├── player-quote.repository.ts              # Interfaz IPlayerQuoteRepository
│       ├── typeorm-valuation-strategy.repository.ts
│       ├── typeorm-player-quote.repository.ts
│       ├── valuation-strategy.mapper.ts
│       ├── player-quote.mapper.ts
│       └── entities/
│           ├── valuation-strategy.entity.ts
│           └── player-quote.entity.ts
│
├── services/
│   └── quotation/
│       ├── quotation.service.ts   # Orquestación + lock isRunning + recalculateAll()
│       └── quotation.job.ts       # @Cron(EVERY_WEEK) → llama quotationService.recalculateAll()
│
├── controllers/
│   └── quotation/
│       └── quotation.controller.ts  # POST /quotes/recalculate con AdminApiKeyGuard
│
├── modules/
│   └── quotation/
│       └── quotation.module.ts
│
└── database/
    └── migrations/
        └── <timestamp>-SeedValuationStrategies.ts

backend/src/repositories/player/
└── player.repository.ts    # Agregar findAllActive(): Promise<Player[]>

backend/test/
└── quotation/
    └── quotation.e2e-spec.ts

backend/src/domain/quotation/
└── __tests__/
    ├── calculate-player-value.spec.ts
    └── valuation-strategy.spec.ts
```

**Structure Decision**: Option 2 (web application / backend only). La organización sigue la estructura por capas del Principio I. La función de cálculo es dominio puro. El módulo `QuotationModule` importa `PlayerModule` (para `PLAYER_REPOSITORY`) y `ApiKeyModule` (para que `AdminApiKeyGuard` pueda inyectar sus dependencias).

## Complexity Tracking

No hay violaciones de constitución. No se requiere justificación adicional.

---

## Phase 0: Research — Resuelto

Ver [research.md](./research.md) para todas las decisiones investigadas.

**Resumen de decisiones clave**:
1. Reutilizar `AdminApiKeyGuard` existente (no crear nuevo guard)
2. Nombres de métricas: `passesCompleted` y `shots` (nombres del dominio, no los del proveedor)
3. Cron: `CronExpression.EVERY_WEEK` con `waitForCompletion: true`
4. Agregar `findAllActive()` a `IPlayerRepository`
5. Pesos en jsonb (confirmado)
6. Lock pattern: variable booleana `isRunning` + `RecalculationInProgressError` → 409

---

## Phase 1: Design

Ver artefactos generados:
- [data-model.md](./data-model.md)
- [contracts/quotes-api.md](./contracts/quotes-api.md)
- [quickstart.md](./quickstart.md)

### Puntos clave de diseño

#### Función de cálculo pura

```
calculatePlayerValue(player: Player, strategy: ValuationStrategy): { score: number; value: number }

Para cada (metricKey, peso) en strategy.weights:
  metricValue = player[metricKey] ?? 0
  bound = NORMALIZATION_BOUNDS[metricKey]
  normalized = clamp(metricValue, 0, bound) / bound
  score += peso * normalized

value = 1 + (score * strategy.factorEscala)
```

El clamp superior a `bound` garantiza que métricas que superan el bound no excedan 1.0. El clamp inferior a 0 previene normalizaciones negativas por datos corruptos.

#### Lock de concurrencia en QuotationService

Mismo patrón que `PlayerSyncService.activeRunId`:
```
isRunning: boolean = false

recalculateAll():
  if (isRunning) throw RecalculationInProgressError()
  isRunning = true
  try:
    players = playerRepository.findAllActive()
    strategy = valuationStrategyRepository.findActive()
    if (!strategy) throw NoActiveStrategyError()
    for each player:
      { score, value } = calculatePlayerValue(player, strategy)
      playerQuoteRepository.save(PlayerQuote { ... weightSnapshot: strategy.weights ... })
    return { processedPlayers, errors, durationMs }
  finally:
    isRunning = false
```

#### IPlayerRepository — nuevo método

```typescript
findAllActive(): Promise<Player[]>
```
Implementación en `TypeOrmPlayerRepository`: `WHERE removed_at IS NULL` sin paginación.

#### Activación de estrategia (repositorio transaccional)

```typescript
// En IValuationStrategyRepository:
activateStrategy(id: string): Promise<ValuationStrategy>

// Implementación:
// 1. UPDATE valuation_strategies SET is_active = false WHERE is_active = true
// 2. UPDATE valuation_strategies SET is_active = true WHERE id = :id
// Ambas en la misma transacción con QueryRunner
```

#### Migration seed

Timestamp sugerido: próximo disponible después de `1791417600000`.  
Patrón: `INSERT INTO valuation_strategies (...) VALUES (...), (...) ON CONFLICT (id) DO NOTHING`.
