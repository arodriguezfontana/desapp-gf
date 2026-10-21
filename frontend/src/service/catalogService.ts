import { httpClient } from './httpClient';
import { buildPlayerQuery } from './buildPlayerQuery';
import type { Player, PlayerListResponseDto, PlayerQuote } from '../types/catalog.types';
import type { PlayerValuationResponseDto as PlayerValuation } from '../types/userStrategy.types';
import type { OrderBookResponseDto } from '../types/orders.types';

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
    const queryString = buildPlayerQuery(params);
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
  /** Libro de órdenes activas (compras y ventas) del jugador (024-player-order-book, JWT). */
  async getOrderBook(playerId: string): Promise<OrderBookResponseDto> {
    return httpClient.get<OrderBookResponseDto>(`/players/${playerId}/order-book`);
  },
};
