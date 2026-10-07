import { League } from './enums/league';

export type SyncRunStatus = 'running' | 'completed' | 'failed';

export interface SyncFailedUnit {
  league: League;
  team?: string;
  reason: 'league-fetch-failed' | 'no-seed-player' | 'roster-fetch-failed';
}

export interface WhoScoredSyncSummary {
  teamsSynced: number;
  playersSynced: number;
  failedUnits: SyncFailedUnit[];
}

export interface SyncRunState {
  runId: string;
  status: SyncRunStatus;
  trigger: 'manual' | 'cron';
  startedAt: Date;
  finishedAt?: Date;
  summary?: WhoScoredSyncSummary;
  errorMessage?: string;
}
