# Feature Specification: Football-Data Integration

**Feature Branch**: `007-football-data-integration`

**Created**: 2026-09-24

**Status**: Draft

**Input**: User description: "Funcionalidad de integración de Football-Data. Esta feature no expone ningún endpoint REST nuevo: es una capa de sincronización y persistencia, análoga en alcance a la del catálogo de WhoScored. El sincronizador obtiene sus datos de la API oficial de Football-Data.org (por ejemplo, GET /competitions/{code}/matches para partidos, GET /competitions/{code}/standings para tabla de posiciones, y el campo crest de cada equipo para su escudo). Se limita a las mismas 5 ligas que cubre el catálogo (Premier League, Bundesliga, La Liga, Serie A, Ligue 1), y a la temporada en curso, mismo criterio temporal que ya usa el catálogo de WhoScored para sus métricas. Agrega, por cada partido: equipo local, equipo visitante, fecha, marcador (cuando ya se jugó) y competencia/fecha del campeonato (matchday). Agrega, por cada equipo en cada liga: posición en la tabla, puntos, partidos jugados/ganados/empatados/perdidos, goles a favor y en contra, diferencia de gol, y la racha de los últimos partidos (form) — este último campo no se usa todavía en ninguna lógica, pero se persiste. Agrega, por cada equipo: el escudo (crest) como URL. La incorporación de estos datos ocurre mediante una sincronización periódica programada (scheduler), nunca disparada por ninguna request. La frecuencia exacta de esa sincronización es un detalle de implementación que se resuelve en el speckit-plan. Football-Data.org identifica el estado de un partido con varios valores posibles (SCHEDULED, TIMED, IN_PLAY, PAUSED, FINISHED, POSTPONED, SUSPENDED, CANCELLED, AWARDED, entre otros). Documentá como decisión de diseño el siguiente criterio: un partido en estado FINISHED se persiste como resultado, con marcador; un partido en estado SCHEDULED o TIMED se persiste como fixture próximo, sin marcador; cualquier otro estado no se persiste todavía en esa corrida, se vuelve a evaluar en la sincronización siguiente, cuando Football-Data.org actualice ese partido a uno de los dos estados anteriores. En particular, un partido CANCELLED o AWARDED nunca transiciona a ninguno de esos dos estados, por lo que en la práctica queda sin persistirse de forma permanente — decisión aceptada, dado que no hay estadísticas de jugadores asociadas a un partido cancelado o resuelto sin jugarse. Dejá explícito como decisión aceptada que un equipo sin escudo disponible en la API se persiste con ese campo en null, nunca con un valor por defecto inventado — mismo criterio de nulabilidad que ya usa el catálogo de WhoScored para métricas ausentes."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automatic Background Sync of League Standings and Team Crests (Priority: P1)

As a platform administrator or system process, I want the platform to automatically synchronize standings (position, points, played, won, drawn, lost, goals for, goals against, goal difference, form) and team crest URLs for the current season across the 5 target leagues via a background scheduler so that match and team context is kept up to date without requiring HTTP request triggers or manual intervention.

**Why this priority**: Standings and team crests provide essential contextual data across the 5 top European leagues (Premier League, Bundesliga, La Liga, Serie A, Ligue 1) that support market analysis and platform visualization.

**Independent Test**: Can be fully tested by triggering the background synchronization job in isolation for a target league and verifying that team standings and crest URLs are correctly persisted or updated.

**Acceptance Scenarios**:

1. **Given** a scheduled execution of the background synchronizer, **When** standings data is fetched for the 5 target leagues in the current season, **Then** all teams in those leagues have their standings metrics (position, points, played, won, drawn, lost, goals for/against, goal difference, form) updated in local storage.
2. **Given** a team record in Football-Data API containing a valid crest URL, **When** team information is synchronized, **Then** the team's crest URL is persisted exactly as received from the API.
3. **Given** a team record in Football-Data API with no crest URL provided (missing/undefined), **When** team information is synchronized, **Then** the crest URL field is persisted as `null` (never replaced with a synthetic default image URL).

---

### User Story 2 - Filtering and Persistence of Match Results and Fixtures (Priority: P2)

As a platform background synchronizer, I want to filter incoming matches from Football-Data API by their official lifecycle status so that completed match results (with scores) and upcoming fixtures (without scores) are persisted, while transient, suspended, cancelled, or awarded matches are appropriately classified.

**Why this priority**: Distinguishing between finished results, scheduled upcoming fixtures, and non-final or cancelled states ensures data consistency and avoids persisting incomplete or irrelevant match records.

**Independent Test**: Can be tested by running a sync execution with mock match feeds containing various status flags (`FINISHED`, `SCHEDULED`, `TIMED`, `IN_PLAY`, `POSTPONED`, `CANCELLED`, `AWARDED`) and asserting which match entities are stored and how their scores are populated.

**Acceptance Scenarios**:

1. **Given** a match in state `FINISHED`, **When** synchronized, **Then** it is persisted as a completed result containing home team, away team, date, competition, matchday, and full match score.
2. **Given** a match in state `SCHEDULED` or `TIMED`, **When** synchronized, **Then** it is persisted as an upcoming fixture containing home team, away team, date, competition, and matchday, with score set to `null` / unpopulated.
3. **Given** a match in state `IN_PLAY`, `PAUSED`, `POSTPONED`, or `SUSPENDED`, **When** synchronized, **Then** it is ignored during the current run without error and left to be re-evaluated in subsequent sync cycles when updated to `FINISHED`, `SCHEDULED`, or `TIMED`.
4. **Given** a match in state `CANCELLED` or `AWARDED`, **When** synchronized, **Then** it is intentionally ignored and permanently remains unpersisted (accepted design decision: unplayed or cancelled matches carry no player statistics relevant to the domain).

---

### Edge Cases

- **Unavailable or missing team crest in API**: Persisted as `null`. No fallback or placeholder image URL is generated.
- **Provider API temporary failure or network failure**: The background job logs the issue cleanly and defers sync; existing persisted local standings and match records remain accessible without system disruption.
- **Match status transition over time**: A match previously in `SCHEDULED` status that becomes `FINISHED` in a later sync run is updated with its final score and status.
- **Cancelled or Awarded matches**: Intentionally never persisted because they never transition to `FINISHED` or `SCHEDULED`/`TIMED` and do not contain valid player performance stats.
- **Unused team form data**: The recent match form string (e.g. `WWDLW`) is stored as provided by the API even if no business domain logic actively consumes it yet.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST perform background data ingestion strictly via a scheduled periodic job (scheduler), never triggered by incoming HTTP requests.
- **FR-002**: System MUST limit data collection exclusively to the current season of the 5 supported leagues: Premier League, Bundesliga, La Liga, Serie A, and Ligue 1.
- **FR-003**: System MUST persist for each match: home team, away team, match date, competition, matchday, and score (when completed).
- **FR-004**: System MUST process match statuses according to explicit design criteria:
  - Status `FINISHED`: Persist as a completed match result including final score.
  - Status `SCHEDULED` or `TIMED`: Persist as an upcoming fixture without a score.
  - Statuses `IN_PLAY`, `PAUSED`, `POSTPONED`, `SUSPENDED`: Do NOT persist during current run; defer evaluation to subsequent sync runs.
  - Statuses `CANCELLED` or `AWARDED`: Do NOT persist during current run or any future runs (permanently left unpersisted as accepted design decision).
- **FR-005**: System MUST persist for each team in each league: table position, total points, matches played, won, drawn, lost, goals for, goals against, goal difference, and recent form string (`form`).
- **FR-006**: System MUST persist each team's crest URL (`crest`). If the crest URL is absent or null from the external API, the field MUST be stored as `null`, avoiding dummy or fallback default values.
- **FR-007**: System MUST NOT expose any new public or administrative REST endpoints for triggering or querying raw Football-Data integration jobs.

### Key Entities *(include if feature involves data)*

- **League / Competition**: Represents one of the 5 supported competitions (Premier League, Bundesliga, La Liga, Serie A, Ligue 1) for the current season.
- **Team**: Represents a football club operating in one of the covered leagues. Key attributes: name, crest URL (nullable).
- **League Standing**: Represents the performance snapshot of a team within a specific league competition. Attributes: position, points, played, won, drawn, lost, goals for, goals against, goal difference, form string.
- **Match**: Represents a scheduled fixture or completed result. Attributes: home team, away team, date, competition, matchday, status classification (Finished vs Scheduled), home score, away score.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of teams belonging to the 5 covered leagues for the current season are synchronized with accurate standings and crest URLs (or `null` when omitted by API).
- **SC-002**: 100% of matches in `FINISHED` state are stored with accurate final scores, and 100% of matches in `SCHEDULED` or `TIMED` state are stored as upcoming fixtures without score.
- **SC-003**: Zero matches in transient or cancelled/awarded states (`IN_PLAY`, `POSTPONED`, `CANCELLED`, `AWARDED`, etc.) are persisted as final results or fixtures, preventing corrupted match states.
- **SC-004**: Background synchronization runs without exposing any new REST HTTP endpoints, operating entirely as a scheduled background process.

## Assumptions

- **API Coverage**: Football-Data.org API provides coverage for the 5 target leagues (Premier League, Bundesliga, La Liga, Serie A, Ligue 1) for the current active season.
- **Nullability consistency**: Storing missing crest URLs as `null` is consistent with existing catalog policies (e.g. WhoScored absent metrics).
- **Cancelled/Awarded non-persistence**: Non-persistence of `CANCELLED` and `AWARDED` matches is an explicit, accepted design decision since no player performance stats exist for unplayed matches.
- **Scheduler Frequency**: The exact cron schedule or periodic interval will be defined during implementation planning (`speckit-plan`).

