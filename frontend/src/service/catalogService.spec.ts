import { describe, it, expect, vi, beforeEach } from 'vitest';
import { catalogService } from './catalogService';
import { httpClient } from './httpClient';

describe('catalogService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('getPlayers construye los query params y llama a httpClient.get con useApiKey: true', async () => {
    const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
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
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
    });

    await catalogService.getPlayers();

    expect(getSpy).toHaveBeenCalledWith('/players', { useApiKey: true });
  });

  it('getPlayers traduce la respuesta real del backend ({ items, total, page, pageSize }) al contrato interno { data, meta }', async () => {
    const player = {
      id: 'player-1',
      name: 'Lionel Messi',
      league: 'Ligue 1',
      team: 'PSG',
      position: 'FW',
    };
    vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
      items: [player],
      total: 21,
      page: 2,
      pageSize: 10,
    });

    const result = await catalogService.getPlayers({ page: 2 });

    expect(result).toEqual({
      data: [player],
      meta: { total: 21, page: 2, pageSize: 10, totalPages: 3 },
    });
  });

  it('getPlayers calcula totalPages en 1 (no 0) cuando el catálogo filtrado está vacío', async () => {
    vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
    });

    const result = await catalogService.getPlayers();

    expect(result.meta).toEqual({ total: 0, page: 1, pageSize: 10, totalPages: 1 });
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

