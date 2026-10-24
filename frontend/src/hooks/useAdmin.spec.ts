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

  it('simulateMarket delega en adminService.simulateMarket', async () => {
    const spy = vi.spyOn(adminService, 'simulateMarket').mockResolvedValueOnce({
      success: true,
      message: 'Simulación completada con éxito.',
      adminEmail: 'abi_admin@ejemplo.com',
      holdingsCreated: 4,
      transactionsCreated: 9,
      ordersCreated: 4,
      marketOrdersCreated: 24,
      quotesCreated: 20,
      playersInvolved: ['Player One'],
    });

    const { result } = renderHook(() => useAdmin());
    const simResult = await result.current.simulateMarket();

    expect(spy).toHaveBeenCalled();
    expect(simResult.success).toBe(true);
    expect(simResult.holdingsCreated).toBe(4);
  });

  it('recalculateQuotes delega en adminService.recalculateQuotes', async () => {
    const spy = vi.spyOn(adminService, 'recalculateQuotes').mockResolvedValueOnce({
      recalculated: [{ userId: 'u-1', playerId: 'p-1', value: 50, score: 0.5 }],
      skipped: [],
    });

    const { result } = renderHook(() => useAdmin());
    const recalcResult = await result.current.recalculateQuotes();

    expect(spy).toHaveBeenCalled();
    expect(recalcResult.recalculated).toHaveLength(1);
  });
});
