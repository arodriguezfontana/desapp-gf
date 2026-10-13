import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAdmin } from './useAdmin';
import { adminService } from '../service/adminService';

describe('useAdmin', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('triggerWhoScoredSync delega en adminService.triggerWhoScoredSync', async () => {
    const spy = vi.spyOn(adminService, 'triggerWhoScoredSync').mockResolvedValueOnce({
      runId: 'run-1',
      status: 'running',
      trigger: 'manual',
      startedAt: '2026-10-12T00:00:00.000Z',
    });

    const { result } = renderHook(() => useAdmin());
    const accepted = await result.current.triggerWhoScoredSync();

    expect(spy).toHaveBeenCalled();
    expect(accepted.runId).toBe('run-1');
  });

  it('getWhoScoredRunStatus delega en adminService.getWhoScoredRunStatus con el runId', async () => {
    const spy = vi.spyOn(adminService, 'getWhoScoredRunStatus').mockResolvedValueOnce({
      runId: 'run-1',
      status: 'completed',
      trigger: 'manual',
      startedAt: '2026-10-12T00:00:00.000Z',
    });

    const { result } = renderHook(() => useAdmin());
    const status = await result.current.getWhoScoredRunStatus('run-1');

    expect(spy).toHaveBeenCalledWith('run-1');
    expect(status.status).toBe('completed');
  });

  it('triggerFootballDataSync delega en adminService.triggerFootballDataSync', async () => {
    const spy = vi.spyOn(adminService, 'triggerFootballDataSync').mockResolvedValueOnce({
      leagues: [],
      failedLeagues: [],
    });

    const { result } = renderHook(() => useAdmin());
    const summary = await result.current.triggerFootballDataSync();

    expect(spy).toHaveBeenCalled();
    expect(summary.leagues).toEqual([]);
  });

  it('recalculateQuotes delega en adminService.recalculateQuotes', async () => {
    const spy = vi.spyOn(adminService, 'recalculateQuotes').mockResolvedValueOnce({
      processedPlayers: 150,
      errors: 0,
      durationMs: 840,
    });

    const { result } = renderHook(() => useAdmin());
    const recalcResult = await result.current.recalculateQuotes();

    expect(spy).toHaveBeenCalled();
    expect(recalcResult.processedPlayers).toBe(150);
  });

  it('listStrategies delega en adminService.listStrategies', async () => {
    const strategiesMock = [
      { id: 's-1', name: 'Performance general', weights: { goals: 0.25 }, factorEscala: 99, isActive: true },
    ];
    const spy = vi.spyOn(adminService, 'listStrategies').mockResolvedValueOnce(strategiesMock);

    const { result } = renderHook(() => useAdmin());
    const strategies = await result.current.listStrategies();

    expect(spy).toHaveBeenCalled();
    expect(strategies).toEqual(strategiesMock);
  });

  it('activateStrategy delega en adminService.activateStrategy con el strategyId', async () => {
    const strategyMock = {
      id: 's-2',
      name: 'Impacto táctico',
      weights: { totalTackles: 0.25 },
      factorEscala: 99,
      isActive: true,
    };
    const spy = vi.spyOn(adminService, 'activateStrategy').mockResolvedValueOnce(strategyMock);

    const { result } = renderHook(() => useAdmin());
    const strategy = await result.current.activateStrategy('s-2');

    expect(spy).toHaveBeenCalledWith('s-2');
    expect(strategy).toEqual(strategyMock);
  });
});
