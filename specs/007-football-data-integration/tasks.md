# Tasks: Football-Data Integration

**Feature**: Football-Data Integration (`007-football-data-integration`)
**Branch**: `007-football-data-integration`
**Spec**: [spec.md](file:///c:/Users/arodr/OneDrive/Desktop/Archivos/Universidad/Repos/desapp-gf/specs/007-football-data-integration/spec.md)
**Plan**: [plan.md](file:///c:/Users/arodr/OneDrive/Desktop/Archivos/Universidad/Repos/desapp-gf/specs/007-football-data-integration/plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Test fixtures setup, environment variable configuration, and test infrastructure initialization.

- [x] T001 [P] Version Football-Data API test fixture for matches in `backend/test/fixtures/football-data/matches-sample.json`
- [x] T002 [P] Version Football-Data API test fixture for standings in `backend/test/fixtures/football-data/standings-sample.json`
- [x] T003 Ensure `FOOTBALL_DATA_API_TOKEN` environment variable is defined in `backend/.env.example`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Domain logic, contracts, database entities, and repository interfaces required by all user stories.

**CRITICAL**: All tasks in this phase MUST be complete before user story execution begins.

- [x] T004 [P] Implement pure domain match status classifier function `classifyMatchStatus` in `backend/src/domain/match-status-classifier.ts` mapping `FINISHED` -> `{ persist: true, classification: 'RESULT', includeScore: true }`, `SCHEDULED`/`TIMED` -> `{ persist: true, classification: 'FIXTURE', includeScore: false }`, `IN_PLAY`/`PAUSED`/`POSTPONED`/`SUSPENDED` -> `{ persist: false, reason: 'DEFERRED_TEMPORARY' }`, and `CANCELLED`/`AWARDED` -> `{ persist: false, reason: 'DEFERRED_PERMANENT' }`
- [x] T005 [P] Implement unit tests for match status classifier in `backend/src/domain/match-status-classifier.spec.ts` testing all status categories
- [x] T006 [P] Create `FootballDataAdapter` domain interface and DTO types in `backend/src/adapters/football-data-adapter.ts`
- [x] T007 [P] Create `MatchEntity` TypeORM entity in `backend/src/repositories/entities/match.entity.ts` with columns `external_id` (integer, unique index `idx_matches_external_id`), `league_code`, `season`, `matchday`, `utc_date`, `status`, `classification`, `home_team_id`, `home_team_name`, `away_team_id`, `away_team_name`, `home_score` (nullable), and `away_score` (nullable)
- [x] T008 [P] Create `StandingEntity` TypeORM entity in `backend/src/repositories/entities/standing.entity.ts` with columns `external_team_id`, `team_name`, `league_code`, `season`, `position`, `played_games`, `won`, `draw`, `lost`, `points`, `goals_for`, `goals_against`, `goal_difference`, `form` (nullable string), `crest_url` (nullable string), and composite unique index `idx_standings_team_league` on `(external_team_id, league_code)`
- [x] T009 Create repository interfaces `MatchRepository` in `backend/src/repositories/match.repository.ts` and `StandingRepository` in `backend/src/repositories/standing.repository.ts`

**Checkpoint**: Foundation ready - Domain classifier, entities, and interfaces defined.

---

## Phase 3: User Story 1 - Automatic Background Sync of League Standings and Team Crests (Priority: P1) MVP

**Goal**: Synchronize league standings (position, points, played, won, draw, lost, goals for, goals against, goal difference, form) and team crest URLs across the 5 target leagues (`PL`, `BL1`, `PD`, `SA`, `FL1`).

**Independent Test**: Trigger standings sync against captured JSON fixtures and verify that standings records and crest URLs are upserted, with missing crests stored as `null`.

### Implementation for User Story 1

- [x] T010 [P] [US1] Implement TypeORM standing repository `TypeOrmStandingRepository` in `backend/src/repositories/typeorm-standing.repository.ts` with upsert targeted by `(external_team_id, league_code)`
- [x] T011 [P] [US1] Implement `HttpFootballDataAdapter.fetchStandings` in `backend/src/adapters/http-football-data-adapter.ts` calling `GET /v4/competitions/{code}/standings` with `X-Auth-Token` header, returning team standings and crest URLs (storing absent crests as `null`)
- [x] T012 [P] [US1] Create unit tests for `HttpFootballDataAdapter.fetchStandings` in `backend/src/adapters/http-football-data-adapter.spec.ts` using mocked axios and `standings-sample.json`
- [x] T013 [US1] Implement standings sync logic in `FootballDataSyncService.syncStandingsForLeague` in `backend/src/services/football-data-sync.service.ts` iterating over the 5 leagues (`PL`, `BL1`, `PD`, `SA`, `FL1`) with rate-limiting delay (~7s) and per-league error logging
- [x] T014 [P] [US1] Create unit tests for standings sync in `backend/src/services/football-data-sync.service.spec.ts`
- [x] T015 [US1] Create database integration test for standing repository in `backend/src/repositories/typeorm-standing.repository.integration.spec.ts` using Testcontainers PostgreSQL

**Checkpoint**: User Story 1 complete and independently testable.

---

## Phase 4: User Story 2 - Filtering and Persistence of Match Results and Fixtures (Priority: P2)

**Goal**: Fetch, classify, and persist match results (`FINISHED` with score) and upcoming fixtures (`SCHEDULED`/`TIMED` without score), deferring or ignoring other match statuses.

**Independent Test**: Trigger matches sync against mock fixture feed containing `FINISHED`, `SCHEDULED`, `TIMED`, `IN_PLAY`, `POSTPONED`, `CANCELLED`, and `AWARDED` matches, asserting only `FINISHED` and `SCHEDULED`/`TIMED` matches are stored.

### Implementation for User Story 2

- [x] T016 [P] [US2] Implement TypeORM match repository `TypeOrmMatchRepository` in `backend/src/repositories/typeorm-match.repository.ts` with upsert targeted by `external_id`
- [x] T017 [P] [US2] Implement `HttpFootballDataAdapter.fetchMatches` in `backend/src/adapters/http-football-data-adapter.ts` calling `GET /v4/competitions/{code}/matches` with `X-Auth-Token` header
- [x] T018 [P] [US2] Create unit tests for `HttpFootballDataAdapter.fetchMatches` in `backend/src/adapters/http-football-data-adapter.spec.ts` using mocked axios and `matches-sample.json`
- [x] T019 [US2] Implement matches sync logic in `FootballDataSyncService.syncMatchesForLeague` in `backend/src/services/football-data-sync.service.ts` applying `classifyMatchStatus` filtering, persisting only valid results/fixtures, and isolating per-league errors
- [x] T020 [P] [US2] Create unit tests for match classification and sync in `backend/src/services/football-data-sync.service.spec.ts`
- [x] T021 [US2] Create database integration test for match repository in `backend/src/repositories/typeorm-match.repository.integration.spec.ts` using Testcontainers PostgreSQL

**Checkpoint**: User Story 2 complete and independently testable.

---

## Phase 5: Scheduler & NestJS Module Integration

**Purpose**: Wire `FootballDataSyncService` into NestJS cron scheduler with `@Cron(CronExpression.EVERY_WEEK)` and register entities in `AppModule`.

- [x] T022 Implement `@Cron(CronExpression.EVERY_WEEK)` handler with `waitForCompletion: true` in `FootballDataSyncService.handleCron` in `backend/src/services/football-data-sync.service.ts`
- [x] T023 Register `MatchEntity`, `StandingEntity`, `FootballDataSyncService`, and `HttpFootballDataAdapter` in NestJS module `backend/src/football-data-sync.module.ts` and `backend/src/app.module.ts`
- [x] T024 Create full service integration test `backend/src/services/football-data-sync.service.integration.spec.ts` verifying scheduled end-to-end sync execution against PostgreSQL Testcontainer

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation, logging, and code cleanliness.

- [x] T025 [P] Audit structured logger output to ensure `FOOTBALL_DATA_API_TOKEN` is never logged in error messages or debug logs in `backend/src/adapters/http-football-data-adapter.ts`
- [x] T026 Execute quickstart validation steps from `specs/007-football-data-integration/quickstart.md` running unit and integration tests

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately.
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS User Stories 1 and 2.
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) completion.
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2) completion. Can run in parallel with US1.
- **Scheduler Integration (Phase 5)**: Depends on US1 and US2 completion.
- **Polish (Phase 6)**: Depends on Phase 5 completion.

### Parallel Opportunities

- T001, T002, T003 in Phase 1 can run in parallel.
- T004, T005, T006, T007, T008 in Phase 2 can run in parallel.
- Once Phase 2 completes, US1 (T010-T015) and US2 (T016-T021) can run in parallel.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (User Story 1 - Standings & Crests).
3. Validate standings sync with offline test fixtures.

### Full Delivery

1. Complete Phase 4 (User Story 2 - Match Results & Fixtures).
2. Complete Phase 5 (Scheduler & Cron Integration).
3. Complete Phase 6 (Validation & Token Audit).
