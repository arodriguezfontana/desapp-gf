import { useCallback } from 'react';
import { rankingService } from '../service/rankingService';
import type { RankingResponseDto, GetRankingParams } from '../types/catalog.types';

export function useRanking() {
  const getRanking = useCallback(
    (params?: GetRankingParams): Promise<RankingResponseDto> =>
      rankingService.getRanking(params),
    [],
  );

  return { getRanking };
}
