import { httpClient } from './httpClient';
import type { Player, PlayerListResponseDto } from '../types/catalog.types';

export interface GetPlayersParams {
  page?: number;
  league?: string;
  team?: string;
  position?: string;
}

export const catalogService = {
  async getPlayers(params: GetPlayersParams = {}): Promise<PlayerListResponseDto> {
    const query = new URLSearchParams();

    if (params.page !== undefined && params.page > 0) {
      query.append('page', params.page.toString());
    }

    if (params.league && params.league.trim()) {
      query.append('league', params.league.trim());
    }

    if (params.team && params.team.trim()) {
      query.append('team', params.team.trim());
    }

    if (params.position && params.position.trim()) {
      query.append('position', params.position.trim());
    }

    const queryString = query.toString();
    const url = queryString ? `/players?${queryString}` : '/players';

    return httpClient.get<PlayerListResponseDto>(url, { useApiKey: true });
  },

  async getPlayerById(id: string): Promise<Player> {
    return httpClient.get<Player>(`/players/${id}`, { useApiKey: true });
  },
};

