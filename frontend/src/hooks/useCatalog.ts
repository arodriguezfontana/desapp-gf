import { useCallback } from 'react';
import { catalogService, type GetPlayersParams } from '../service/catalogService';
import type { Player, PlayerListResponseDto, PlayerQuote } from '../types/catalog.types';
import type { PlayerValuationResponseDto } from '../types/userStrategy.types';

/**
 * Encapsula las llamadas de red del catálogo (`service/catalogService`)
 * para que las páginas nunca importen `service/` directamente (constitución:
 * "hooks/ y contexts/ — únicas capas que MUST invocar service/").
 */
export function useCatalog() {
  const getPlayers = useCallback(
    (params?: GetPlayersParams): Promise<PlayerListResponseDto> =>
      catalogService.getPlayers(params),
    [],
  );

  const getPlayerById = useCallback(
    (id: string): Promise<Player> => catalogService.getPlayerById(id),
    [],
  );

  const getMyValuationByPlayerId = useCallback(
    (playerId: string): Promise<PlayerValuationResponseDto | null> =>
      catalogService.getMyValuationByPlayerId(playerId),
    [],
  );

  const getQuoteHistoryByPlayerId = useCallback(
    (playerId: string): Promise<PlayerQuote[]> =>
      catalogService.getQuoteHistoryByPlayerId(playerId),
    [],
  );

  return { getPlayers, getPlayerById, getMyValuationByPlayerId, getQuoteHistoryByPlayerId };
}

// Re-exportado para que PlayerDetailPage pueda narrowear el error sin importar `service/` directamente.
export { ApiError } from '../service/httpClient';
