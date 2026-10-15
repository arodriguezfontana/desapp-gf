import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminService } from './adminService';
import { httpClient } from './httpClient';

describe('adminService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('triggerWhoScoredSync llama a POST /sync/whoscored con useApiKey: true', async () => {
    const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
      runId: 'run-1',
      status: 'running',
      trigger: 'manual',
      startedAt: '2026-10-12T00:00:00.000Z',
    });

    const result = await adminService.triggerWhoScoredSync();

    expect(postSpy).toHaveBeenCalledWith('/sync/whoscored', undefined, { useApiKey: true });
    expect(result.runId).toBe('run-1');
  });

  it('getWhoScoredRunStatus llama a GET /sync/whoscored/:runId con useApiKey: true', async () => {
    const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
      runId: 'run-1',
      status: 'completed',
      trigger: 'manual',
      startedAt: '2026-10-12T00:00:00.000Z',
    });

    const result = await adminService.getWhoScoredRunStatus('run-1');

    expect(getSpy).toHaveBeenCalledWith('/sync/whoscored/run-1', { useApiKey: true });
    expect(result.status).toBe('completed');
  });

  it('getWhoScoredRunStatus codifica el runId en la URL', async () => {
    const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
      runId: 'run con espacio',
      status: 'running',
      trigger: 'manual',
      startedAt: '2026-10-12T00:00:00.000Z',
    });

    await adminService.getWhoScoredRunStatus('run con espacio');

    expect(getSpy).toHaveBeenCalledWith('/sync/whoscored/run%20con%20espacio', { useApiKey: true });
  });

  it('triggerFootballDataSync llama a POST /sync/football-data con useApiKey: true', async () => {
    const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
      leagues: [],
      failedLeagues: [],
    });

    const result = await adminService.triggerFootballDataSync();

    expect(postSpy).toHaveBeenCalledWith('/sync/football-data', undefined, { useApiKey: true });
    expect(result.leagues).toEqual([]);
  });
});
