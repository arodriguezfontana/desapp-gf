import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCatalog } from './useCatalog';
import { catalogService } from '../service/catalogService';

describe('useCatalog', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('getPlayers delega en catalogService.getPlayers con los mismos params', async () => {
    const spy = vi.spyOn(catalogService, 'getPlayers').mockResolvedValueOnce({
      data: [],
      meta: { total: 0, page: 1, pageSize: 12, totalPages: 1 },
    });

    const { result } = renderHook(() => useCatalog());
    await result.current.getPlayers({ page: 2, league: 'La Liga' });

    expect(spy).toHaveBeenCalledWith({ page: 2, league: 'La Liga' });
  });

  it('getPlayerById delega en catalogService.getPlayerById con el id', async () => {
    const spy = vi.spyOn(catalogService, 'getPlayerById').mockResolvedValueOnce({
      id: 'p-1',
      name: 'Lionel Messi',
      league: 'Ligue 1',
      team: 'PSG',
      position: 'FW',
    });

    const { result } = renderHook(() => useCatalog());
    const player = await result.current.getPlayerById('p-1');

    expect(spy).toHaveBeenCalledWith('p-1');
    expect(player.name).toBe('Lionel Messi');
  });

  it('getMyValuationByPlayerId delega en catalogService.getMyValuationByPlayerId con el playerId', async () => {
    const valuationMock = {
      playerId: 'p-1',
      strategyId: 's-1',
      score: 0.75,
      value: 75.25,
      appliedPosition: null,
    };
    const spy = vi.spyOn(catalogService, 'getMyValuationByPlayerId').mockResolvedValueOnce(valuationMock);

    const { result } = renderHook(() => useCatalog());
    const valuation = await result.current.getMyValuationByPlayerId('p-1');

    expect(spy).toHaveBeenCalledWith('p-1');
    expect(valuation).toEqual(valuationMock);
  });
});
