import type { Position } from './catalog.types';

export interface UserStrategyResponseDto {
  id: string;
  name: string;
  weights: Record<string, number>;
  factorEscala: number;
  isSelected: boolean;
  positionWeights: Partial<Record<Position, Record<string, number>>>;
}

export interface UserStrategyListResponseDto {
  strategies: UserStrategyResponseDto[];
}

export interface PlayerValuationResponseDto {
  playerId: string;
  strategyId: string;
  score: number;
  value: number;
  appliedPosition: Position | null;
}

export interface RecalculatedEntryDto {
  playerId: string;
  value: number;
  score: number;
}

export interface SkippedEntryDto {
  playerId: string;
  reason: string;
}

export interface UserRecalculateResponseDto {
  recalculated: RecalculatedEntryDto[];
  skipped: SkippedEntryDto[];
}
