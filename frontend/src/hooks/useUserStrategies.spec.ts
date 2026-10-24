import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUserStrategies } from './useUserStrategies';
import { userStrategyService } from '../service/userStrategyService';

describe('useUserStrategies', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('listStrategies delega en userStrategyService.listStrategies', async () => {
    const spy = vi.spyOn(userStrategyService, 'listStrategies').mockResolvedValueOnce({
      strategies: [],
    });

    const { result } = renderHook(() => useUserStrategies());
    await result.current.listStrategies();

    expect(spy).toHaveBeenCalled();
  });

  it('selectStrategy delega en userStrategyService.selectStrategy con el strategyId', async () => {
    const strategyMock = {
      id: 's-1', name: 'Performance general', weights: {}, factorEscala: 99, isSelected: true, positionWeights: {},
    };
    const spy = vi.spyOn(userStrategyService, 'selectStrategy').mockResolvedValueOnce(strategyMock);

    const { result } = renderHook(() => useUserStrategies());
    const strategy = await result.current.selectStrategy('s-1');

    expect(spy).toHaveBeenCalledWith('s-1');
    expect(strategy).toEqual(strategyMock);
  });

  it('editWeights delega en userStrategyService.editWeights con strategyId y weights', async () => {
    const weights = { goals: 0.5, assists: 0.5 };
    const strategyMock = {
      id: 's-1', name: 'Performance general', weights, factorEscala: 99, isSelected: true, positionWeights: {},
    };
    const spy = vi.spyOn(userStrategyService, 'editWeights').mockResolvedValueOnce(strategyMock);

    const { result } = renderHook(() => useUserStrategies());
    await result.current.editWeights('s-1', weights);

    expect(spy).toHaveBeenCalledWith('s-1', weights);
  });

  it('editPositionWeights delega en userStrategyService.editPositionWeights con strategyId, position y weights', async () => {
    const weights = { rating: 1.0 };
    const strategyMock = {
      id: 's-1', name: 'Performance general', weights: {}, factorEscala: 99, isSelected: true, positionWeights: { GK: weights },
    };
    const spy = vi.spyOn(userStrategyService, 'editPositionWeights').mockResolvedValueOnce(strategyMock);

    const { result } = renderHook(() => useUserStrategies());
    await result.current.editPositionWeights('s-1', 'GK', weights);

    expect(spy).toHaveBeenCalledWith('s-1', 'GK', weights);
  });
});
