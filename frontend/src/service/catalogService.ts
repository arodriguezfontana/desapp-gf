import { httpClient } from './httpClient';
import type { Player, PlayerListResponseDto } from '../types/catalog.types';

export interface GetPlayersParams {
  page?: number;
  pageSize?: number;
  league?: string;
  team?: string;
  position?: string;
}

/** Forma real que devuelve `GET /players` en el backend (no trae `data`/`meta`). */
interface BackendPlayerListResponse {
  items: Player[];
  total: number;
  page: number;
  pageSize: number;
}

export const catalogService = {
  async getPlayers(params: GetPlayersParams = {}): Promise<PlayerListResponseDto> {
    const query = new URLSearchParams();

    if (params.page !== undefined && params.page > 0) {
      query.append('page', params.page.toString());
    }

    if (params.pageSize !== undefined && params.pageSize > 0) {
      query.append('pageSize', params.pageSize.toString());
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

    const response = await httpClient.get<BackendPlayerListResponse>(url, {
      useApiKey: true,
    });

    const pageSize = response.pageSize || params.pageSize || 12;

    return {
      data: response.items,
      meta: {
        total: response.total,
        page: response.page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(response.total / pageSize)),
      },
    };
  },

  async getPlayerById(id: string): Promise<Player> {
    return httpClient.get<Player>(`/players/${id}`, { useApiKey: true });
  },
};
