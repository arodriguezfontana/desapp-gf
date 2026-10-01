import { useCallback } from 'react';
import { catalogService, type GetPlayersParams } from '../service/catalogService';
import type { Player, PlayerListResponseDto } from '../types/catalog.types';

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

  return { getPlayers, getPlayerById };
}

// Re-exportado para que PlayerDetailPage pueda narrowear el error sin importar `service/` directamente.
export { ApiError } from '../service/httpClient';
