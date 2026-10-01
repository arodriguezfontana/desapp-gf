# Research: Football-Data Integration

**Feature**: Football-Data Integration (`007-football-data-integration`)
**Date**: 2026-09-24

## 1. Domain Match Status Classifier & Pure Function

### Decision
Implement match status classification as a pure domain function in `backend/src/domain/match-status-classifier.ts`.

### Rationale
- Pure functions are easy to unit test without dependencies or mocks.
- Decouples status filtering from NestJS services, TypeORM repositories, and axios HTTP adapters.
- Keeps domain rules explicit and consistent with specification requirements.

### Status Rules & Mapping
- `FINISHED` → `{ persist: true, type: 'RESULT', includeScore: true }`
- `SCHEDULED`, `TIMED` → `{ persist: true, type: 'FIXTURE', includeScore: false }`
- `IN_PLAY`, `PAUSED`, `POSTPONED`, `SUSPENDED` → `{ persist: false, reason: 'DEFERRED_TEMPORARY' }`
- `CANCELLED`, `AWARDED` → `{ persist: false, reason: 'DEFERRED_PERMANENT' }` (accepted design decision: unplayed matches have no relevant player stats)
- Any other unknown status → `{ persist: false, reason: 'UNKNOWN_STATUS' }`

---

## 2. External API Contracts & Rate Limiting Strategy

### Decision
1. Pass `FOOTBALL_DATA_API_TOKEN` via `X-Auth-Token` header in `HttpFootballDataAdapter`.
2. Hardcode base URL `https://api.football-data.org/v4` as constant inside `HttpFootballDataAdapter`.
3. Space API calls with a ~7-second delay (`sleep(7000)`) between requests to respect the free plan limit of 10 requests per minute.
4. Catch HTTP 429 status code and retry with backoff or defer remaining requests for that cycle.

### Endpoint Details
- `GET /v4/competitions/{code}/matches?season={year}`: Returns matches list for the competition.
- `GET /v4/competitions/{code}/standings`: Returns table standings and team crest URLs.

### Target Competition Codes
- Premier League: `PL`
- Bundesliga: `BL1`
- La Liga: `PD`
- Serie A: `SA`
- Ligue 1: `FL1`

---

## 3. Resilience & Failure Isolation

### Decision
Treat each competition and resource type (`matches` vs `standings`) as an independent unit of work.

### Rationale
- If `fetchMatches('PL')` fails, standings for `PL` can still sync if `fetchStandings('PL')` succeeds.
- If `PL` fails entirely, the sync process proceeds to `BL1`, `PD`, `SA`, and `FL1` without aborting the entire job.
- Errors are logged per competition and per resource without throwing unhandled exceptions.

---

## 4. Storage & TypeORM Upsert Strategy

### Decision
Use TypeORM repository `upsert` or `save` with unique constraint conflict targets.

### Database Index Constraints
1. **`MatchEntity`**: Unique index on `external_id` (Football-Data match ID).
2. **`StandingEntity`**: Unique index on `(team_id, league_code)` or `(external_team_id, league_code)`.

### Upsert Behavior
- **Matches**: Update home score, away score, match date, matchday, and status classification based on `external_id`.
- **Standings**: Update position, points, played, won, drawn, lost, goals_for, goals_against, goal_difference, and form based on composite unique constraint `(external_team_id, league_code)`.
- **Teams**: Update crest URL (`crest_url`) when present, set to `null` if missing from API (never invent default fallback image URLs).

---

## 5. Testing & Fixture Strategy

### Decision
Use offline JSON fixtures versioned in `backend/test/fixtures/football-data/` for unit and integration testing.

### Fixtures
- `matches-sample.json`: Representative response from `/v4/competitions/PL/matches` containing matches across all lifecycle statuses (`FINISHED`, `SCHEDULED`, `TIMED`, `IN_PLAY`, `POSTPONED`, `CANCELLED`).
- `standings-sample.json`: Representative response from `/v4/competitions/PL/standings` containing table rows and crest URLs.

### Test Isolation
- Mock `FootballDataAdapter` or `axios` in test suites so zero HTTP requests leave the test runner.
- Validate integration flows using Testcontainers for Postgres DB interactions.

