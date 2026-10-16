import { httpClient } from './httpClient';
import type { Player, PlayerListResponseDto, PlayerQuote } from '../types/catalog.types';
import type { PlayerValuationResponseDto as PlayerValuation } from '../types/userStrategy.types';

export interface GetPlayersParams {
  page?: number;
  pageSize?: number;
  league?: string;
  team?: string;
  position?: string;
}

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

  /**
   * Valuación al vuelo del jugador según mi estrategia seleccionada
   * (019-per-user-valuation-strategies, JWT — reemplaza el extinto
   * GET /quotes/player/:playerId de 012, que era global y sin dueño).
   */
  async getMyValuationByPlayerId(playerId: string): Promise<PlayerValuation | null> {
    try {
      return await httpClient.get<PlayerValuation>(`/players/${playerId}/valuation`);
    } catch {
      return null;
    }
  },

  /** Mi propio historial de cotizaciones de este jugador (JWT, acotado por usuario). */
  async getQuoteHistoryByPlayerId(playerId: string): Promise<PlayerQuote[]> {
    return httpClient.get<PlayerQuote[]>(`/players/${playerId}/quotes`);
  },
};