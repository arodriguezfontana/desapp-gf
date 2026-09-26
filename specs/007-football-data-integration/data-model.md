# Data Model: Football-Data Integration

**Feature**: Football-Data Integration (`007-football-data-integration`)
**Date**: 2026-09-24

## 1. Domain Entities & Value Objects

### Match Entity (`backend/src/domain/match.entity.ts`)
Represents a football match (fixture or result) synchronized from Football-Data.org.

| Attribute | Type | Nullable | Description |
|-----------|------|----------|-------------|
| `id` | string (UUID) | No | Internal primary key |
| `externalId` | number | No | Football-Data.org match ID (Unique Index) |
| `leagueCode` | string | No | Competition code (e.g. `PL`, `BL1`, `PD`, `SA`, `FL1`) |
| `season` | number | No | Current season year (e.g. 2025) |
| `matchday` | number | No | Competition round / matchday |
| `utcDate` | Date | No | Scheduled or actual kick-off time |
| `status` | string | No | Raw API status (`FINISHED`, `SCHEDULED`, `TIMED`, etc.) |
| `classification` | MatchClassification | No | Pure domain classification (`RESULT` vs `FIXTURE`) |
| `homeTeamId` | number | No | External ID of home team |
| `homeTeamName` | string | No | Display name of home team |
| `awayTeamId` | number | No | External ID of away team |
| `awayTeamName` | string | No | Display name of away team |
| `homeScore` | number | Yes | Goals scored by home team (`null` for upcoming fixtures) |
| `awayScore` | number | Yes | Goals scored by away team (`null` for upcoming fixtures) |

---

### Standing Entity (`backend/src/domain/standing.entity.ts`)
Represents a team's position and statistics in a specific league table.

| Attribute | Type | Nullable | Description |
|-----------|------|----------|-------------|
| `id` | string (UUID) | No | Internal primary key |
| `externalTeamId` | number | No | Football-Data team ID |
| `teamName` | string | No | Name of the team |
| `leagueCode` | string | No | Competition code (e.g. `PL`) |
| `season` | number | No | Current season year |
| `position` | number | No | League rank (1-20) |
| `playedGames` | number | No | Matches played |
| `won` | number | No | Matches won |
| `draw` | number | No | Matches drawn |
| `lost` | number | No | Matches lost |
| `points` | number | No | Total table points |
| `goalsFor` | number | No | Total goals scored |
| `goalsAgainst` | number | No | Total goals conceded |
| `goalDifference` | number | No | Goal difference (`goalsFor - goalsAgainst`) |
| `form` | string | Yes | Recent match form string (e.g. `W,D,L,W,W`) |
| `crestUrl` | string | Yes | URL to team crest (`null` if absent from API) |

---

## 2. Database Schema (TypeORM Entities)

### `matches` Table (`backend/src/repositories/entities/match.entity.ts`)

```typescript
@Entity('matches')
@Index('idx_matches_external_id', ['externalId'], { unique: true })
export class MatchEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'external_id', type: 'integer', unique: true })
  externalId: number;

  @Column({ name: 'league_code', type: 'varchar', length: 10 })
  leagueCode: string;

  @Column({ name: 'season', type: 'integer' })
  season: number;

  @Column({ name: 'matchday', type: 'integer' })
  matchday: number;

  @Column({ name: 'utc_date', type: 'timestamp with time zone' })
  utcDate: Date;

  @Column({ name: 'status', type: 'varchar', length: 20 })
  status: string;

  @Column({ name: 'classification', type: 'varchar', length: 20 })
  classification: 'RESULT' | 'FIXTURE';

  @Column({ name: 'home_team_id', type: 'integer' })
  homeTeamId: number;

  @Column({ name: 'home_team_name', type: 'varchar', length: 100 })
  homeTeamName: string;

  @Column({ name: 'away_team_id', type: 'integer' })
  awayTeamId: number;

  @Column({ name: 'away_team_name', type: 'varchar', length: 100 })
  awayTeamName: string;

  @Column({ name: 'home_score', type: 'integer', nullable: true })
  homeScore: number | null;

  @Column({ name: 'away_score', type: 'integer', nullable: true })
  awayScore: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

---

### `standings` Table (`backend/src/repositories/entities/standing.entity.ts`)

```typescript
@Entity('standings')
@Index('idx_standings_team_league', ['externalTeamId', 'leagueCode'], { unique: true })
export class StandingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'external_team_id', type: 'integer' })
  externalTeamId: number;

  @Column({ name: 'team_name', type: 'varchar', length: 100 })
  teamName: string;

  @Column({ name: 'league_code', type: 'varchar', length: 10 })
  leagueCode: string;

  @Column({ name: 'season', type: 'integer' })
  season: number;

  @Column({ name: 'position', type: 'integer' })
  position: number;

  @Column({ name: 'played_games', type: 'integer' })
  playedGames: number;

  @Column({ name: 'won', type: 'integer' })
  won: number;

  @Column({ name: 'draw', type: 'integer' })
  draw: number;

  @Column({ name: 'lost', type: 'integer' })
  lost: number;

  @Column({ name: 'points', type: 'integer' })
  points: number;

  @Column({ name: 'goals_for', type: 'integer' })
  goalsFor: number;

  @Column({ name: 'goals_against', type: 'integer' })
  goalsAgainst: number;

  @Column({ name: 'goal_difference', type: 'integer' })
  goalDifference: number;

  @Column({ name: 'form', type: 'varchar', length: 50, nullable: true })
  form: string | null;

  @Column({ name: 'crest_url', type: 'varchar', length: 500, nullable: true })
  crestUrl: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

---

## 3. Classification Domain Logic

```typescript
export interface ClassificationResult {
  persist: boolean;
  classification?: 'RESULT' | 'FIXTURE';
  includeScore?: boolean;
  reason?: string;
}

export function classifyMatchStatus(status: string): ClassificationResult {
  switch (status) {
    case 'FINISHED':
      return { persist: true, classification: 'RESULT', includeScore: true };
    case 'SCHEDULED':
    case 'TIMED':
      return { persist: true, classification: 'FIXTURE', includeScore: false };
    case 'IN_PLAY':
    case 'PAUSED':
    case 'POSTPONED':
    case 'SUSPENDED':
      return { persist: false, reason: 'DEFERRED_TEMPORARY' };
    case 'CANCELLED':
    case 'AWARDED':
      return { persist: false, reason: 'DEFERRED_PERMANENT' };
    default:
      return { persist: false, reason: 'UNKNOWN_STATUS' };
  }
}
```

