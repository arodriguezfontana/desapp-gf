# Implementation Plan: Estrategias de Valuación Propias por Usuario

**Branch**: `019-per-user-valuation-strategies` | **Date**: 2026-10-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/019-per-user-valuation-strategies/spec.md`

## Summary

Reemplaza el modelo de `ValuationStrategy` única de sistema (activada por admin, ver
012-valuation-strategies) por dos estrategias propias y fijas por usuario, creadas
automáticamente al alta (incluido el seed del admin/superusuario). `PlayerQuote` deja de
ser un historial global por jugador y pasa a estar segmentado por `(userId, playerId)`.
El recálculo deja de ser un cron semanal global (`QuotationJob`) y pasa a ser una acción
síncrona disparada por el propio usuario vía JWT, con lock de concurrencia por usuario
(409 si hay uno en curso) y skip-and-continue ante fallos puntuales de un jugador en un
recálculo masivo. Se eliminan los tres endpoints admin de `quotation.controller.ts`
(`GET strategies`, `PATCH strategies/:id/activate`, `POST recalculate` bajo
`AdminApiKeyGuard`) y se agregan endpoints JWT user-scoped equivalentes bajo
`/users/me/strategies` y `/users/me/quotes/recalculate`.

## Technical Context

**Language/Version**: TypeScript 5.7 (strict), Node.js 20

**Primary Dependencies**: NestJS 11, TypeORM, class-validator, `@nestjs/swagger`; React 19 + Vite 8 + Tailwind 4 en frontend

**Storage**: PostgreSQL vía TypeORM. `valuation_strategies` y `player_quotes` ganan columna `user_id` (uuid, FK a `users`, NOT NULL, `ON DELETE CASCADE`)

**Testing**: Jest + supertest + Testcontainers + tsarch (backend); Vitest + React Testing Library (frontend)

**Target Platform**: Linux server (backend), navegador web responsivo (frontend)

**Project Type**: Web application (monorepo `backend/` + `frontend/`)

**Performance Goals**: Sin objetivo numérico nuevo; el recálculo síncrono de catálogo completo debe completar dentro del timeout HTTP estándar del backend (no se introduce un valor nuevo no pedido por la spec)

**Constraints**: Recálculo síncrono (no job en background); lock de concurrencia estrictamente por usuario (nunca bloquea a otro usuario); ownership check (403) en todo endpoint de `/users/me/strategies`; suma de pesos 1.0 ±0.001 en toda edición, sin persistir cambios parciales

**Scale/Scope**: 2 estrategias fijas por usuario (sin alta/baja), historial de `PlayerQuote` crece por cada recálculo manual de cada usuario para cada jugador

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principio I (capas)**: Cumple — el provisioning de estrategias al alta se expone
  como servicio de dominio/aplicación inyectado en `AuthService`/`AdminSeedService`, sin
  que estos importen repositorios de `quotation` directamente (se inyecta un servicio de
  `QuotationModule` exportado, mismo patrón que el `forwardRef` ya existente
  `QuotationModule → PlayerModule`).
- **Principio II (dominio rico, Strategy pattern)**: Cumple — `ValuationStrategy` sigue
  siendo una clase de dominio con Strategy pattern; gana `userId` como campo de identidad
  de propietario, no cambia el patrón de cálculo. Cada `PlayerQuote` sigue registrando
  `strategyId` (versión de la estrategia que la produjo).
- **Principio III (validación por nivel)**: Cumple — DTO valida forma (ids, rangos de
  pesos), Service valida existencia (jugador/estrategia existen) y ownership, dominio
  valida invariantes (suma=1.0±0.001, posición válida). 403/404/409 vía
  `AllExceptionsFilter` existente.
- **Principio IV (autenticación)**: Cumple — `/users/me/strategies/*`,
  `/users/me/quotes/recalculate` y `/players/:id/valuation` usan `JwtAuthGuard` (son
  operaciones ligadas a un usuario individual, no "operación de sistema"). Se eliminan
  los 3 endpoints `AdminApiKeyGuard` existentes porque la operación de sistema que
  protegían (activar una estrategia global) deja de existir.
- **Principio V (auditoría inmutable)**: N/A directo — `PlayerQuote` ya es append-only;
  esta feature solo le agrega `userId`, no cambia su inmutabilidad.
- **Principio VI (integridad transaccional)**: Aplica a `selectStrategy` (desmarcar la
  previamente seleccionada + marcar la nueva, atómico) y al provisioning de las dos
  estrategias al alta (ambas se crean o ninguna). Vive en el dominio/servicio de
  aplicación con transacción explícita, igual que el `activateStrategy` transaccional ya
  existente en `typeorm-valuation-strategy.repository.ts`.
- **Principio VII (observabilidad)**: Sin cambios — se reutiliza logging estructurado y
  Correlation ID ya existentes; el recálculo síncrono loguea jugadores recalculados y
  saltados.
- **Principio VIII (Swagger)**: Pendiente de generar desde los nuevos DTOs/decoradores
  en Phase 1 (no se escribe a mano).
- **Principio IX (testing)**: Plan incluye tests de dominio sin NestJS/DB para
  `ValuationStrategy`/`PlayerQuote` con `userId`, tests de integración con Testcontainers
  para los nuevos endpoints y el lock por usuario, y tsarch sigue corriendo sin cambios
  de capas.
- **Principio X (Decimal)**: Cumple — `weights`/`positionWeights` siguen en `jsonb` (no
  son columnas decimales individuales, sin cambio respecto al esquema actual);
  `factorEscala`, `score`, `value` mantienen sus `DECIMAL` ya definidos.
- **Principio XI (idioma)**: Identificadores en inglés, mensajes de error y dominio
  conceptual en español, consistente con el código existente.
- **Principio XII (spec-first)**: Cumple — toda ambigüedad resuelta en `spec.md` bajo
  `## Clarifications` antes de este plan.

Sin violaciones. No se requiere `Complexity Tracking`.

## Project Structure

### Documentation (this feature)

```text
specs/019-per-user-valuation-strategies/
├── plan.md              # Este archivo
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── users-me-strategies-api.md
└── tasks.md             # Phase 2 output (/speckit-tasks, no generado por /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── domain/
│   │   ├── quotation/
│   │   │   ├── valuation-strategy.ts        # + userId, + isSelected (reemplaza isActive), sin activate()/deactivate() globales → select()/deselect()
│   │   │   ├── player-quote.ts              # + userId
│   │   │   └── errors/
│   │   │       └── strategy-ownership.error.ts   # nuevo: 403 al operar sobre estrategia ajena
│   │   └── auth/
│   │       └── user-strategy-provisioning.ts     # nuevo: fábrica de las 2 estrategias default (reusa los pesos seed de Performance general / Impacto táctico)
│   ├── services/
│   │   └── quotation/
│   │       ├── quotation.service.ts          # + selectStrategy, + editWeights, + editPositionWeights, + recalculate(userId, playerId?) síncrono con lock por usuario
│   │       └── quotation.job.ts              # ELIMINADO (cron semanal global discontinuado, DD-003)
│   ├── controllers/
│   │   ├── quotation/
│   │   │   └── quotation.controller.ts       # elimina GET strategies / PATCH strategies/:id/activate / POST recalculate (AdminApiKeyGuard)
│   │   ├── user-strategy/                    # nuevo
│   │   │   ├── user-strategy.controller.ts   # GET/PATCH /users/me/strategies... bajo JwtAuthGuard
│   │   │   └── dto/
│   │   │       ├── user-strategy-response.dto.ts
│   │   │       ├── edit-weights-request.dto.ts
│   │   │       └── edit-position-weights-request.dto.ts
│   │   └── player/
│   │       └── player.controller.ts          # + GET /players/:id/valuation, + GET /players/:id/quotes (reemplaza el histórico global existente)
│   ├── repositories/quotation/
│   │   ├── valuation-strategy.repository.ts  # findByUserId(userId), findByIdAndUserId(id, userId), save — elimina findActive/activateStrategy globales
│   │   ├── typeorm-valuation-strategy.repository.ts
│   │   ├── player-quote.repository.ts        # + userId en todas las firmas (saveMany, findAllByPlayerIdAndUserId, findLatestByPlayerIdAndUserId)
│   │   └── typeorm-player-quote.repository.ts
│   ├── database/migrations/
│   │   ├── <timestamp>-AddUserIdToValuationStrategies.ts
│   │   ├── <timestamp>-AddUserIdToPlayerQuotes.ts
│   │   ├── <timestamp>-DropIsActiveAddIsSelectedToValuationStrategies.ts
│   │   └── <timestamp>-BackfillOrDropLegacyGlobalRows.ts   # ver research.md (decisión sobre filas preexistentes sin userId)
│   └── modules/
│       └── quotation/quotation.module.ts     # quita ScheduleModule/QuotationJob; exporta provisioning service; importa UserModule (o AuthModule exporta hacia Quotation vía forwardRef)
└── test/
    └── (e2e nuevos: user-strategy, recalculate, player-quotes-history)

frontend/
├── src/
│   ├── service/
│   │   ├── userStrategyService.ts            # nuevo cliente para /users/me/strategies y /users/me/quotes/recalculate
│   │   └── adminService.ts                   # se elimina activateStrategy/listStrategies (o se recorta esa porción)
│   ├── hooks/
│   │   └── useUserStrategies.ts              # nuevo
│   ├── pages/
│   │   ├── AdminPage.tsx                     # se quita la sección de activación de estrategia de sistema
│   │   └── MyStrategiesPage.tsx              # nuevo: "Mis estrategias"
│   ├── components/
│   │   └── QuoteHistoryChart.tsx             # reutilizado sin cambios de forma; repointed a la nueva fuente de datos por-usuario
│   └── types/
│       └── userStrategy.types.ts             # nuevo
└── test/
    └── userStrategyService.test.tsx          # nuevo, contra backend real + Testcontainers (Principio IX)
```

**Structure Decision**: Se mantiene la estructura por capas ya vigente en
`backend/src/` (Principio I) y `frontend/src/` (sección Estructura de la
constitución). No se introduce ningún directorio nuevo de alto nivel; los cambios son
extensiones dentro de `domain/quotation`, `services/quotation`, `controllers/quotation`
más un controller nuevo (`controllers/user-strategy/`) que sigue el mismo patrón que
`controllers/quotation/`.

## Complexity Tracking

*Sin violaciones de la Constitution Check — sección no aplica.*
