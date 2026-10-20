import { httpClient } from './httpClient';
import type { RankedPlayer, RankingResponseDto, GetRankingParams } from '../types/catalog.types';

interface BackendRankingResponse {
  items: RankedPlayer[];
  total: number;
  page: number;
  pageSize: number;
}

export const rankingService = {
  async getRanking(params: GetRankingParams = {}): Promise<RankingResponseDto> {
    const query = new URLSearchParams();

    if (params.page !== undefined && params.page > 0) {
      query.append('page', params.page.toString());
    }
    if (params.pageSize !== undefined && params.pageSize > 0) {
      query.append('pageSize', params.pageSize.toString());
    }
    if (params.league?.trim()) {
      query.append('league', params.league.trim());
    }
    if (params.team?.trim()) {
      query.append('team', params.team.trim());
    }
    if (params.position?.trim()) {
      query.append('position', params.position.trim());
    }

    const queryString = query.toString();
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
