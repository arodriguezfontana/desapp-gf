import { httpClient } from './httpClient';
import { buildPlayerQuery } from './buildPlayerQuery';
import type { RankedPlayer, RankingResponseDto, GetRankingParams } from '../types/catalog.types';

interface BackendRankingResponse {
  items: RankedPlayer[];
  total: number;
  page: number;
  pageSize: number;
}

export const rankingService = {
  async getRanking(params: GetRankingParams = {}): Promise<RankingResponseDto> {
    const queryString = buildPlayerQuery(params);
    const url = queryString ? `/players/ranking?${queryString}` : '/players/ranking';

    const response = await httpClient.get<BackendRankingResponse>(url);

    return {
      items: response.items,
      total: response.total,
      page: response.page,
      pageSize: response.pageSize || params.pageSize || 10,
    };
  },
};
