import { describe, it, expect, vi, beforeEach } from 'vitest';
import { catalogService } from './catalogService';
import { httpClient } from './httpClient';

describe('catalogService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('getPlayers construye los query params y llama a httpClient.get con useApiKey: true', async () => {
    const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
      data: [],
      meta: { total: 0, page: 1, pageSize: 10, totalPages: 0 },
    });

    await catalogService.getPlayers({
      page: 2,
      league: 'Premier League',
      team: ' Arsenal ',
      position: 'FW',
    });

    expect(getSpy).toHaveBeenCalledWith(
      '/players?page=2&league=Premier+League&team=Arsenal&position=FW',
      { useApiKey: true },
    );
  });

  it('getPlayers llama a /players sin query params si no se pasan filtros ni pagina', async () => {
    const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
      data: [],
      meta: { total: 0, page: 1, pageSize: 10, totalPages: 0 },
    });

    await catalogService.getPlayers();

    expect(getSpy).toHaveBeenCalledWith('/players', { useApiKey: true });
  });

  it('getPlayerById llama a /players/:id con useApiKey: true', async () => {
    const playerMock = {
      id: 'player-1',
      name: 'Lionel Messi',
      league: 'Ligue 1',
      team: 'PSG',
      position: 'FW',
    };

    const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce(playerMock);

    const result = await catalogService.getPlayerById('player-1');

    expect(result).toEqual(playerMock);
    expect(getSpy).toHaveBeenCalledWith('/players/player-1', { useApiKey: true });
  });
});

