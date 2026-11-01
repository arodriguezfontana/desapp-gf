import { League } from '../player/enums/league';

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
  status: 'running' | 'completed' | 'failed';
  trigger: 'manual' | 'cron';
  startedAt: Date;
  finishedAt?: Date;
  summary?: WhoScoredSyncSummary;
  errorMessage?: string;
}
