import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminService } from './adminService';
import { httpClient } from './httpClient';
import { apiKeyStorage } from './apiKeyStorage';

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

  it('simulateMarket llama a POST /admin/simulate-market con useApiKey según almacenamiento', async () => {
    vi.spyOn(apiKeyStorage, 'getApiKey').mockReturnValue('fval_testkey');
    const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
      success: true,
      message: 'Simulación completada con éxito.',
      adminEmail: 'abi_admin@ejemplo.com',
      holdingsCreated: 5,
      transactionsCreated: 12,
      ordersCreated: 4,
      marketOrdersCreated: 36,
      quotesCreated: 30,
      playersInvolved: ['Emiliano Martínez'],
    });

    const result = await adminService.simulateMarket();

    expect(postSpy).toHaveBeenCalledWith('/admin/simulate-market', undefined, { useApiKey: true });
    expect(result.success).toBe(true);
    expect(result.holdingsCreated).toBe(5);
  });

  it('recalculateQuotes llama a POST /quotes/recalculate con useApiKey: true', async () => {
    const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
      recalculated: [{ userId: 'u-1', playerId: 'p-1', value: 50, score: 0.5 }],
      skipped: [],
    });

    const result = await adminService.recalculateQuotes();

    expect(postSpy).toHaveBeenCalledWith('/quotes/recalculate', undefined, { useApiKey: true });
    expect(result.recalculated).toHaveLength(1);
  });
});
