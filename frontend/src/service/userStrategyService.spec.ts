import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userStrategyService } from './userStrategyService';
import { httpClient } from './httpClient';
import type { UserStrategyListResponseDto, UserStrategyResponseDto } from '../types/userStrategy.types';

describe('userStrategyService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('listStrategies llama a GET /users/me/strategies sin useApiKey (JWT)', async () => {
    const mockResponse: UserStrategyListResponseDto = {
      strategies: [
        {
          id: 's-1',
          name: 'Performance general',
          weights: { goals: 0.5, assists: 0.5 },
          factorEscala: 99,
          isSelected: true,
          positionWeights: {},
        },
      ],
    };
    const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce(mockResponse);

    const result = await userStrategyService.listStrategies();

    expect(getSpy).toHaveBeenCalledWith('/users/me/strategies');
    expect(result).toEqual(mockResponse);
  });

  it('selectStrategy llama a PATCH /users/me/strategies/:id/select con el id codificado', async () => {
    const mockResponse: UserStrategyResponseDto = {
      id: 's con espacio',
      name: 'Impacto táctico',
      weights: {},
      factorEscala: 99,
      isSelected: true,
      positionWeights: {},
    };
    const patchSpy = vi.spyOn(httpClient, 'patch').mockResolvedValueOnce(mockResponse);

    const result = await userStrategyService.selectStrategy('s con espacio');

    expect(patchSpy).toHaveBeenCalledWith('/users/me/strategies/s%20con%20espacio/select');
    expect(result).toEqual(mockResponse);
  });

  it('editWeights llama a PATCH /users/me/strategies/:id/weights con el body { weights }', async () => {
    const weights = { goals: 0.5, assists: 0.5 };
    const mockResponse = { id: 's-1', name: 'Performance general', weights, factorEscala: 99, isSelected: true, positionWeights: {} };
    const patchSpy = vi.spyOn(httpClient, 'patch').mockResolvedValueOnce(mockResponse);

    const result = await userStrategyService.editWeights('s-1', weights);

    expect(patchSpy).toHaveBeenCalledWith('/users/me/strategies/s-1/weights', { weights });
    expect(result).toEqual(mockResponse);
  });

  it('editPositionWeights llama a PATCH /users/me/strategies/:id/position-weights/:position con el body { weights }', async () => {
    const weights = { rating: 1.0 };
    const mockResponse = { id: 's-1', name: 'Performance general', weights: {}, factorEscala: 99, isSelected: true, positionWeights: { GK: weights } };
    const patchSpy = vi.spyOn(httpClient, 'patch').mockResolvedValueOnce(mockResponse);

    const result = await userStrategyService.editPositionWeights('s-1', 'GK', weights);

    expect(patchSpy).toHaveBeenCalledWith('/users/me/strategies/s-1/position-weights/GK', { weights });
    expect(result).toEqual(mockResponse);
  });

  it('propaga errores lanzados por httpClient', async () => {
    vi.spyOn(httpClient, 'get').mockRejectedValueOnce(new Error('Network error'));

    await expect(userStrategyService.listStrategies()).rejects.toThrow('Network error');
  });
});
