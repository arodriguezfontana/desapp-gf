export interface SyncAcceptedDto {
  runId: string;
  status: 'running' | 'completed' | 'failed';
  trigger: 'manual' | 'cron';
  startedAt: string;
}

export interface SyncFailedUnitDto {
  league: string;
  team?: string;
  reason: 'league-fetch-failed' | 'no-seed-player' | 'roster-fetch-failed';
}

export interface SyncRunStatusDto {
  runId: string;
  status: 'running' | 'completed' | 'failed';
  trigger: 'manual' | 'cron';
  startedAt: string;
  finishedAt?: string;
  teamsSynced?: number;
  playersSynced?: number;
  failedUnits?: SyncFailedUnitDto[];
  errorMessage?: string;
}

export interface LeagueSyncResultDto {
  leagueCode: string;
  standingsSynced: number;
  matchesSynced: number;
  failedSteps: ('standings' | 'matches')[];
}

export interface SyncSummaryDto {
  leagues: LeagueSyncResultDto[];
  failedLeagues: string[];
}

export interface RecalculatedQuoteEntryDto {
  userId: string;
  playerId: string;
  value: number;
  score: number;
}

export interface SkippedQuoteEntryDto {
  userId: string;
  playerId: string;
  reason: string;
}

export interface RecalculateQuotesResultDto {
  recalculated: RecalculatedQuoteEntryDto[];
  skipped: SkippedQuoteEntryDto[];
}

export interface SimulationResultDto {
  success: boolean;
  message: string;
  adminEmail: string;
  holdingsCreated: number;
  transactionsCreated: number;
  ordersCreated: number;
  marketOrdersCreated: number;
  quotesCreated: number;
  playersInvolved: string[];
}
