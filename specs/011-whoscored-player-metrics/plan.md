# Implementation Plan: Extensión de Métricas de Jugador (WhoScored)

**Branch**: `011-whoscored-player-metrics` | **Date**: 2026-10-07 | **Spec**: [specs/011-whoscored-player-metrics/spec.md](spec.md)

**Input**: Feature specification from `specs/011-whoscored-player-metrics/spec.md`

## Summary

Esta feature extiende el modelo de datos de `Player` en backend y frontend para capturar, persistir y exponer 7 métricas estadísticas adicionales proporcionadas por WhoScored (`Goals`, `Assists`, `KeyPasses`, `Dribbles`, `TotalTackles`, `Yellow`, `Red`).

El abordaje técnico consiste en:
1. Actualizar el puerto e implementación de scraping de WhoScored (`HttpWhoScoredAdapter`) para extraer estos 7 campos del objeto `tournaments` en los fixtures de jugador.
2. Extender el modelo de dominio `Player`, el objeto `PlayerSyncInput` y `PlayerMetrics`.
3. Actualizar `PlayerEntity`, `PlayerMapper` y `TypeOrmPlayerRepository` (incluyendo `UPSERT_OVERWRITE_COLUMNS`) junto con una migración explícita para la tabla `players`.
4. Extender `PlayerResponseDto` y documentar los campos en OpenAPI / Swagger.
5. Actualizar los tipos TypeScript del frontend, la tarjeta de jugador (`PlayerCard`) y la vista de detalle (`PlayerDetailPage`).

## Technical Context

**Language/Version**: TypeScript 5.7 (Node.js 20, NestJS 11, React 19)

**Primary Dependencies**: NestJS 11, TypeORM, `@nestjs/swagger`, `got-scraping`, `cheerio`, React 19, Tailwind CSS 4, React Router DOM 7

**Storage**: PostgreSQL (TypeORM)

**Testing**: Jest + supertest + Testcontainers + tsarch (Backend); Vitest + React Testing Library (Frontend)

**Target Platform**: Node.js Linux/Windows server & Web responsive client

**Project Type**: Monorepo Web Application (`backend/` + `frontend/`)

**Performance Goals**: Sin impacto perceptible en latencia de API (O(1) adicionales por registro) y ejecución fluida del sync semanal.

**Constraints**: Sin librerías nuevas; adherencia estricta a la arquitectura en capas (Principio I); persistencia nullable; fidelidad a datos de WhoScored.

**Scale/Scope**: ~98 equipos en 5 ligas europeas, ~2500 jugadores activos en catálogo.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principio I (Arquitectura en capas)**: PASS.
  - Controller solo interactúa con Service vía DTOs.
  - Dominio (`Player`) sin decoradores TypeORM ni dependencias de NestJS o base de datos.
  - Mapper `PlayerMapper` aísla persistencia (`PlayerEntity`) de dominio.
  - Adapter `HttpWhoScoredAdapter` aísla scraping de WhoScored.
- **Principio II (Modelo de dominio rico)**: PASS. El modelo `Player` encapsula la reconstrucción inmutable de todas las métricas.
- **Principio III (Validaciones en su nivel)**: PASS. DTOs documentan y tipan; validaciones de estado en Service/Dominio.
- **Principio VIII (OpenAPI / Swagger)**: PASS. Decoradores `@ApiProperty` actualizados en `PlayerResponseDto`.
- **Principio IX (Testing con base efímera & Unitarios)**: PASS. Testcontainers para integración con Postgres; Vitest para frontend; tsarch para arquitectura.
- **Principio X (Definición de Terminado)**: PASS. Tests en verde, compilación sin errores, Swagger actualizado.
- **Principio XI (Idioma)**: PASS. Identificadores en inglés, documentación y UI en español.
- **Principio XII (Spec-First)**: PASS. Especificación formal creada y aprobada previamente.

## Project Structure

### Documentation (this feature)

```text
specs/011-whoscored-player-metrics/
├── plan.md              # Implementation plan (this file)
├── research.md          # Technical research & decisions
├── data-model.md        # Data models & schema alterations
├── quickstart.md        # Verification and testing guide
├── contracts/           # API and payload contracts
│   └── player-api.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── adapters/
│   │   └── player-sync/
│   │       ├── http-whoscored-adapter.ts
│   │       └── whoscored-adapter.ts
│   ├── domain/
│   │   └── player/
│   │       ├── player.ts
│   │       └── player-sync-input.ts
│   ├── repositories/
│   │   └── player/
│   │       ├── entities/player.entity.ts
│   │       ├── mappers/player.mapper.ts
│   │       └── typeorm-player.repository.ts
│   ├── controllers/
│   │   └── player/
│   │       └── dto/player-response.dto.ts
│   └── database/
│       └── migrations/
│           └── 1791331200000-AddExtendedMetricsToPlayers.ts
frontend/
├── src/
│   ├── types/
│   │   └── catalog.types.ts
│   ├── components/
│   │   ├── PlayerCard.tsx
│   │   └── PlayerCard.spec.tsx
│   └── pages/
│       ├── PlayerDetailPage.tsx
│       └── PlayerDetailPage.spec.tsx
```

**Structure Decision**: Monorepo estructurado por capas en backend (`adapters`, `domain`, `repositories`, `services`, `controllers`) y frontend (`types`, `components`, `pages`, `service`), validado por `tsarch`.

## Complexity Tracking

*No violations to constitution or architecture detected.*
