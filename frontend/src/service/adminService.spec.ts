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

  it('recalculateQuotes llama a POST /quotes/recalculate con useApiKey: true', async () => {
    const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
      processedPlayers: 150,
      errors: 0,
      durationMs: 840,
    });

    const result = await adminService.recalculateQuotes();

    expect(postSpy).toHaveBeenCalledWith('/quotes/recalculate', undefined, { useApiKey: true });
    expect(result.processedPlayers).toBe(150);
  });

  it('listStrategies llama a GET /quotes/strategies con useApiKey: true', async () => {
    const strategiesMock = [
      { id: 's-1', name: 'Performance general', weights: { goals: 0.25 }, factorEscala: 99, isActive: true },
      { id: 's-2', name: 'Impacto táctico', weights: { totalTackles: 0.25 }, factorEscala: 99, isActive: false },
    ];
    const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce(strategiesMock);

    const result = await adminService.listStrategies();

    expect(getSpy).toHaveBeenCalledWith('/quotes/strategies', { useApiKey: true });
    expect(result).toEqual(strategiesMock);
  });

  it('activateStrategy llama a PATCH /quotes/strategies/:id/activate con useApiKey: true', async () => {
    const strategyMock = {
      id: 's-2',
      name: 'Impacto táctico',
      weights: { totalTackles: 0.25 },
      factorEscala: 99,
      isActive: true,
    };
    const patchSpy = vi.spyOn(httpClient, 'patch').mockResolvedValueOnce(strategyMock);

    const result = await adminService.activateStrategy('s-2');

    expect(patchSpy).toHaveBeenCalledWith('/quotes/strategies/s-2/activate', undefined, { useApiKey: true });
    expect(result).toEqual(strategyMock);
  });

  it('activateStrategy codifica el strategyId en la URL', async () => {
    const patchSpy = vi.spyOn(httpClient, 'patch').mockResolvedValueOnce({
      id: 's con espacio',
      name: 'Test',
      weights: {},
      factorEscala: 1,
      isActive: true,
    });

    await adminService.activateStrategy('s con espacio');

    expect(patchSpy).toHaveBeenCalledWith('/quotes/strategies/s%20con%20espacio/activate', undefined, {
      useApiKey: true,
    });
  });
});
