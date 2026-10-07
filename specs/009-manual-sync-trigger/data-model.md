# Data Model: Disparo manual de sincronización

**Feature**: `009-manual-sync-trigger` | **Date**: 2026-10-06

No hay entidades persistentes nuevas, ni tablas, ni migrations. Todo es estado en memoria del proceso y tipos de respuesta.

## WhoScored

Archivo: `backend/src/domain/player/sync-run.ts` (tipos de dominio, sin decoradores de Nest ni TypeORM).

### `SyncRunStatus`

`'running' | 'completed' | 'failed'`

### `SyncFailedUnit`

| Campo | Tipo | Nota |
|-------|------|------|
| `league` | `League` | Liga de la unidad fallida. |
| `team` | `string \| undefined` | Ausente cuando falló la liga completa. |
| `reason` | `'league-fetch-failed' \| 'no-seed-player' \| 'roster-fetch-failed'` | Código fijo. Nunca texto de excepción ni stack. |

Se corresponden con los tres lugares donde `PlayerSyncService` ya saltea una unidad.

### `WhoScoredSyncSummary`

| Campo | Tipo | Nota |
|-------|------|------|
| `teamsSynced` | número | Equipos cuyo `applyTeamRosterSync` terminó. |
| `playersSynced` | número | Suma de los upserts aplicados. |
| `failedUnits` | `SyncFailedUnit[]` | Vacía si no falló nada. |

No incluye conteos de matching (spec, FR-013).

### `SyncRunState`

| Campo | Tipo | Nota |
|-------|------|------|
| `runId` | string (UUID) | `randomUUID()`. |
| `status` | `SyncRunStatus` | |
| `trigger` | `'manual' \| 'cron'` | Quién la disparó. |
| `startedAt` | fecha | |
| `finishedAt` | fecha, opcional | Ausente mientras `running`. |
| `summary` | `WhoScoredSyncSummary`, opcional | Presente en `completed` y, parcial, en `failed`. |
| `errorMessage` | string, opcional | Solo en `failed`. Mensaje genérico fijo. |

**Almacenamiento**: `Map<string, SyncRunState>` dentro de `PlayerSyncService`. Tope de 20 entradas (`MAX_RETAINED_RUNS`): al superarlo se descarta la terminada más vieja, nunca la que está `running`.

**Lock**: `activeRunId: string | null`. `null` = libre; un valor = hay una corrida en curso con ese `runId`.

### Transiciones

```text
(sin corrida) ──inicio──> running ──termina sin error fatal──> completed
                             └────error que aborta la corrida──> failed
```

Una corrida con unidades fallidas termina `completed`. `failed` es solo para una corrida abortada por completo. Estados finales no cambian.

## Football-Data

Archivo: `backend/src/domain/competition/sync-summary.ts`.

### `LeagueSyncResult`

| Campo | Tipo | Nota |
|-------|------|------|
| `leagueCode` | string | `PL`, `BL1`, `PD`, `SA`, `FL1`. |
| `standingsSynced` | número | Clasificaciones actualizadas. `0` si el proveedor no devolvió datos. |
| `matchesSynced` | número | Partidos actualizados. |
| `failedSteps` | `('standings' \| 'matches')[]` | Pasos que lanzaron error. Vacío si ninguno. |

### `FootballDataSyncSummary`

| Campo | Tipo | Nota |
|-------|------|------|
| `leagues` | `LeagueSyncResult[]` | Una entrada por liga. |
| `failedLeagues` | `string[]` | Códigos de las ligas con al menos un paso fallido. |

Sin `runId` ni registro de estado: la corrida es sincrónica.

**Lock**: `isRunning: boolean`, liberado en un `finally`.

## DTOs de respuesta

Viven en la capa Controller; se construyen desde los tipos de dominio con `fromDomain`.

| DTO | Archivo | Campos |
|-----|---------|--------|
| `SyncAcceptedDto` | `controllers/player-sync/dto/sync-accepted.dto.ts` | `runId`, `status` (siempre `running`). |
| `SyncRunStatusDto` | `controllers/player-sync/dto/sync-run-status.dto.ts` | `runId`, `status`, `trigger`, `startedAt`, `finishedAt?`, `teamsSynced?`, `playersSynced?`, `failedUnits?`, `errorMessage?`. |
| `SyncSummaryDto` | `controllers/competition/dto/sync-summary.dto.ts` | `leagues`, `failedLeagues`. |

## Mensajes (constantes)

En `backend/src/shared/errors/messages.ts`: `SYNC_IN_PROGRESS_MESSAGE` y `SYNC_RUN_NOT_FOUND_MESSAGE`, en español, mismo patrón que `FORBIDDEN_ROLE_MESSAGE`.
