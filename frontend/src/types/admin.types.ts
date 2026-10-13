import type { Position } from './catalog.types';

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

export interface RecalculateResponseDto {
  processedPlayers: number;
  errors: number;
  durationMs: number;
}

export interface StrategyResponseDto {
  id: string;
  name: string;
  weights: Record<string, number>;
  factorEscala: number;
  isActive: boolean;
  positionWeights: Partial<Record<Position, Record<string, number>>>;
}

