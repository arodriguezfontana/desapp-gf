# Implementation Plan: Consulta de Cotización de Jugador (GET /players/:id/quote)

**Branch**: `013-player-quote-endpoint` | **Date**: 2026-10-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/013-player-quote-endpoint/spec.md`

## Summary

Implementar el endpoint `GET /players/:id/quote` para consultar la cotización vigente de un jugador, con soporte para el parámetro opcional `at` (fecha en formato ISO 8601).
- En el repositorio `PlayerQuoteRepository`, agregar el método `findLatestAtDate(playerId: string, date: Date): Promise<PlayerQuote | null>` ejecutando una consulta SQL con `WHERE player_id = :playerId AND calculated_at <= :date ORDER BY calculated_at DESC LIMIT 1`.
- En `QuotationService`, incorporar el método `getQuoteAtDate(playerId: string, date?: Date)` que valida la existencia del jugador mediante `playerRepository.findById` (lanzando `PlayerNotFoundError` / HTTP 404 si no existe), resuelve la cotización correspondiente (o `null` sin excepción si no hay cotización vigente), y obtiene el nombre de la estrategia aplicada.
- En `PlayerController`, exponer la ruta `@Get(':id/quote')` protegida por `ApiKeyGuard`, validar y transformar `at` mediante un `ParseDatePipe` dedicado (lanzando `BadRequestException` ante fecha inválida), retornando HTTP 200 con `PlayerQuoteResponseDto` o HTTP 204 No Content sin cuerpo cuando no hay cotización.

## Technical Context

**Language/Version**: TypeScript 5.7, Node.js 20, NestJS 11

**Primary Dependencies**: `@nestjs/common`, `@nestjs/swagger`, `typeorm` (PostgreSQL)

**Storage**: PostgreSQL (`player_quotes`, `players`, `valuation_strategies` existentes)

**Testing**: Jest + Testcontainers + supertest (tests de integración y e2e con PostgreSQL efímero); Jest aislado (unit tests de pipes, servicios y mappers)

**Target Platform**: Backend NestJS (sin cambios en frontend)

**Project Type**: Web service (REST API)

**Performance Goals**: Tiempo de respuesta < 100 ms para consultas de cotización

**Constraints**: Respetar las reglas de capas (Principio I) y el exception filter único (Principio III). No alterar entidades ni esquemas de base de datos existentes.

**Scale/Scope**: Catálogo actual de jugadores y sus cotizaciones históricas

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Impacto | Estado |
|---|---|---|
| **I. Arquitectura en capas** | `PlayerController` → `QuotationService` → `{PlayerQuoteRepository, ValuationStrategyRepository, PlayerRepository}`. El Controller no toca Repositories. El Service no toca entidades ni mappers. | ✅ Cumple |
| **II. Modelo de dominio rico** | Las cotizaciones y estrategias se manejan como objetos de dominio (`PlayerQuote`, `ValuationStrategy`). | ✅ Cumple |
| **III. Validaciones en su nivel** | `ParseDatePipe` valida formato de fecha (HTTP 400); `QuotationService` valida existencia de jugador (404); el dominio mantiene sus invariantes. `AllExceptionsFilter` maneja todas las respuestas de error. | ✅ Cumple |
| **IV. Autenticación** | Protegido con `ApiKeyGuard` y `@Public()`, simétrico a `GET /players` y `GET /players/:id`. | ✅ Cumple |
| **V. Auditoría inmutable** | `player_quotes` es append-only; las consultas son de solo lectura. | ✅ Cumple |
| **VI. Integridad transaccional** | Operación de solo lectura (SELECT idempotente). | ✅ Cumple |
| **VII. Observabilidad** | El exception filter emite logs estructurados con correlation ID en caso de error. | ✅ Cumple |
| **VIII. Documentación API** | Documentado en Swagger (`@ApiOperation`, `@ApiResponse`, `@ApiSecurity('ApiKeyAuth')`). | ✅ Cumple |
| **IX. Testing** | Tests unitarios para `ParseDatePipe` y `QuotationService`. Tests de integración/e2e con Testcontainers sobre PostgreSQL real efímero. | ✅ Cumple |
| **X. Definición de terminado** | Unit tests + integración pasando; Swagger y colección Postman actualizados; `nest build` limpio. | ✅ Cumple (diseño) |
| **XI. Idioma** | Código y variables en inglés; mensajes de error y documentación en español. | ✅ Cumple |
| **XII. Spec-first** | Spec ratificada en `specs/013-player-quote-endpoint/spec.md`. | ✅ Cumple |

## Project Structure

### Documentation (this feature)

```text
specs/013-player-quote-endpoint/
├── plan.md              # Este archivo
├── research.md          # Decisiones de diseño e investigación (Fase 0)
├── data-model.md        # Modelo de datos y tipos (Fase 1)
├── quickstart.md        # Guía de validación y escenarios (Fase 1)
├── contracts/
│   └── player-quote-api.md  # Contrato formal del endpoint (Fase 1)
├── checklists/
│   └── requirements.md      # Checklist de calidad del spec
└── tasks.md             # Tareas de implementación (/speckit-tasks)
```

### Source Code (repository root)

```text
backend/src/
├── controllers/
│   ├── player/
│   │   ├── pipes/
│   │   │   └── parse-date.pipe.ts             # Pipe de validación y cálculo de final de día UTC
│   │   ├── dto/
│   │   │   └── player-quote-detail-response.dto.ts # DTO con playerId, valor, score, strategyName, weights, calculatedAt
│   │   └── player.controller.ts               # Endpoint GET /players/:id/quote
│
├── repositories/
│   └── quotation/
│       ├── player-quote.repository.ts         # Contrato findLatestAtDate(playerId, date)
│       └── typeorm-player-quote.repository.ts # Query con calculated_at <= :date ORDER BY calculated_at DESC LIMIT 1
│
├── services/
│   └── quotation/
│       └── quotation.service.ts               # getQuoteAtDate(playerId, date?) con validación de jugador
│
├── modules/
│   ├── player/
│   │   └── player.module.ts                   # Inclusión de ParseDatePipe y proveedores necesarios
│   └── quotation/
│       └── quotation.module.ts                # Export de QuotationService para consumo de PlayerController
│
└── test/
    ├── quotation/
    │   └── player-quote-endpoint.e2e.spec.ts  # Test e2e con Testcontainers (200, 204, 400, 404, 401)
    └── unit/
        ├── parse-date.pipe.spec.ts            # Tests unitarios del pipe
        └── quotation.service.spec.ts          # Tests unitarios de getQuoteAtDate
```

**Structure Decision**: El endpoint se incorpora a `PlayerController` (`GET /players/:id/quote`) para mantener todas las rutas `/players/*` agrupadas bajo el mismo recurso REST. La lógica de búsqueda de cotización y resolución de estrategia permanece en `QuotationService`, cumpliendo con la modularidad y las reglas de arquitectura en capas de la Constitución.

## Complexity Tracking

> **Sin violaciones a la Constitución**. No se requieren justificaciones adicionales.
