import { describe, it, expect, vi, beforeEach } from 'vitest';
import { portfolioService } from './portfolioService';
import { httpClient } from './httpClient';
import type { PortfolioResponse } from '../types/portfolio';

describe('portfolioService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('llama a /users/:id/portfolio con el id codificado', async () => {
    const mockResponse: PortfolioResponse = {
      holdings: [
        {
          playerId: 'player-1',
          playerName: 'Erling Haaland',
          tokenQuantity: 10,
          averageBuyPrice: 100,
          currentPrice: 120,
          totalProfitLoss: 200,
        },
      ],
      summary: {
        totalInvested: 1000,
        totalCurrentValue: 1200,
        netProfitLoss: 200,
      },
    };

    const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce(mockResponse);

    const result = await portfolioService.getPortfolio('user-123');

    expect(getSpy).toHaveBeenCalledWith('/users/user-123/portfolio');
    expect(result).toEqual(mockResponse);
  });

  it('codifica correctamente caracteres especiales en el userId', async () => {
    const mockResponse: PortfolioResponse = {
      holdings: [],
      summary: {
        totalInvested: 0,
        totalCurrentValue: 0,
        netProfitLoss: 0,
      },
    };

    const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce(mockResponse);

    await portfolioService.getPortfolio('user#456/test');

    expect(getSpy).toHaveBeenCalledWith('/users/user%23456%2Ftest/portfolio');
  });

  it('propaga errores lanzados por httpClient', async () => {
    vi.spyOn(httpClient, 'get').mockRejectedValueOnce(new Error('Network error'));

    await expect(portfolioService.getPortfolio('user-123')).rejects.toThrow('Network error');
  });
});

