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
});
