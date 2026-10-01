# Implementation Plan: Football-Data Integration

**Branch**: `007-football-data-integration` | **Date**: 2026-09-24 | **Spec**: [spec.md](file:///c:/Users/arodr/OneDrive/Desktop/Archivos/Universidad/Repos/desapp-gf/specs/007-football-data-integration/spec.md)

**Input**: Feature specification from `specs/007-football-data-integration/spec.md` and user technical directives.

## Summary

Implement a background synchronization and persistence service (`FootballDataSyncService`) that fetches match fixtures/results and league standings for the 5 target European leagues (Premier League `PL`, Bundesliga `BL1`, La Liga `PD`, Serie A `SA`, Ligue 1 `FL1`) from the official Football-Data.org API.

The service runs periodically via NestJS `@Cron(CronExpression.EVERY_WEEK)` (`waitForCompletion: true`), applies a pure domain classifier for match statuses (`FINISHED` → result with score; `SCHEDULED`/`TIMED` → upcoming fixture without score; `IN_PLAY`/`PAUSED`/`POSTPONED`/`SUSPENDED`/`CANCELLED`/`AWARDED` → deferred/unpersisted), and performs upserts into PostgreSQL database via TypeORM repositories.

## Technical Context

**Language/Version**: TypeScript 5 / Node.js (NestJS framework)

**Primary Dependencies**: `@nestjs/schedule`, `axios` (encapsulated within `HttpFootballDataAdapter`), `typeorm`, `@nestjs/typeorm`

**Storage**: PostgreSQL (local dev / Docker / Testcontainers), TypeORM entities `MatchEntity` and `StandingEntity` with unique indexes for upsert target resolution.

**Testing**: Jest unit tests (with captured offline JSON fixtures) + NestJS integration tests (with Testcontainers PostgreSQL).

**Target Platform**: Node.js NestJS backend microservice / server.

**Project Type**: Backend web service (internal background scheduler component).

**Performance Goals**: Controlled API requests spaced ~7s apart to strictly respect Football-Data free tier rate limit of 10 req/min.

**Constraints**:
- `FOOTBALL_DATA_API_TOKEN` configured via environment variable (never hardcoded or logged).
- Base URL `https://api.football-data.org/v4` hardcoded as constant in adapter.
- Zero public or administrative REST endpoints exposed for this feature.
- Missing crest URLs persisted as `null` (no fake defaults).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I: Resilience & Isolation**: Passed. Per-league and per-resource failure isolation implemented (failure in matches does not crash standings sync, failure in one league does not affect other leagues).
- **Principle II: Security & Secrets**: Passed. `FOOTBALL_DATA_API_TOKEN` consumed from env vars, secret header masked in logs.
- **Principle III: Clean Architecture & Decoupling**: Passed. Domain interface `FootballDataAdapter` decouples sync service from axios HTTP details. Domain status classification implemented as pure function.

## Project Structure

### Documentation (this feature)

```text
specs/007-football-data-integration/
├── spec.md              # Feature specification
├── plan.md              # Implementation plan (this file)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── football-data-adapter.interface.ts
└── checklists/
    └── requirements.md  # Quality checklist
```

### Source Code (repository root)

```text
backend/src/
├── domain/
│   ├── match-status-classifier.ts
│   └── match-status-classifier.spec.ts
├── adapters/
│   ├── football-data-adapter.ts
│   ├── http-football-data-adapter.ts
│   └── http-football-data-adapter.spec.ts
├── repositories/
│   ├── entities/
│   │   ├── match.entity.ts
│   │   └── standing.entity.ts
│   ├── match.repository.ts
│   ├── typeorm-match.repository.ts
│   ├── standing.repository.ts
│   └── typeorm-standing.repository.ts
└── services/
    ├── football-data-sync.service.ts
    ├── football-data-sync.service.spec.ts
    └── football-data-sync.service.integration.spec.ts

backend/test/fixtures/football-data/
├── matches-sample.json
└── standings-sample.json
```

**Structure Decision**: Monorepo backend layout (`backend/src/`), following existing domain/adapter/repository/service layer pattern.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *None* | *Fully aligned with project architecture & constitution* | *N/A* |
