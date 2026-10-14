import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { usePortfolio } from './usePortfolio';
import { portfolioService } from '../service/portfolioService';
import type { PortfolioResponse } from '../types/portfolio';

// Mock useCurrentUser
vi.mock('./useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'default-user-id', email: 'test@mail.com', role: 'user' },
    isAdmin: false,
    isLoading: false,
    error: null,
    refreshUser: vi.fn(),
  }),
}));

describe('usePortfolio', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('obtiene el portfolio del usuario y expone holdings y summary provistos', async () => {
    const mockResponse: PortfolioResponse = {
      holdings: [
        {
          playerId: 'p1',
          playerName: 'Luka Modric',
          tokenQuantity: 5,
          averageBuyPrice: 50,
          currentPrice: 60,
          totalProfitLoss: 50,
        },
      ],
      summary: {
        totalInvested: 250,
        totalCurrentValue: 300,
        netProfitLoss: 50,
      },
    };

    vi.spyOn(portfolioService, 'getPortfolio').mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => usePortfolio({ userId: 'u1' }));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockResponse);
    expect(result.current.holdings).toHaveLength(1);
    expect(result.current.summary).toEqual(mockResponse.summary);
    expect(result.current.isEmpty).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('calcula summary dinámicamente si el backend no lo provee', async () => {
    const mockResponse: PortfolioResponse = {
      holdings: [
        {
          playerId: 'p1',
          playerName: 'Pedri',
          tokenQuantity: 10,
          averageBuyPrice: 40,
          currentPrice: 45,
          totalProfitLoss: 50,
        },
        {
          playerId: 'p2',
          playerName: 'Gavi',
          tokenQuantity: 10,
          averageBuyPrice: 50,
          currentPrice: 40,
          totalProfitLoss: -100,
        },
      ],
    };

    vi.spyOn(portfolioService, 'getPortfolio').mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => usePortfolio({ userId: 'u1' }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.summary.totalInvested).toBe(900); // 400 + 500
    expect(result.current.summary.totalCurrentValue).toBe(850); // 450 + 400
    expect(result.current.summary.netProfitLoss).toBe(-50);
    expect(result.current.isEmpty).toBe(false);
  });

  it('marca isEmpty en true cuando holdings es una lista vacía', async () => {
    const mockResponse: PortfolioResponse = {
      holdings: [],
      summary: {
        totalInvested: 0,
        totalCurrentValue: 0,
        netProfitLoss: 0,
      },
    };

    vi.spyOn(portfolioService, 'getPortfolio').mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => usePortfolio({ userId: 'u1' }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isEmpty).toBe(true);
    expect(result.current.holdings).toEqual([]);
  });

  it('gestiona errores de red y expone el mensaje de error', async () => {
    vi.spyOn(portfolioService, 'getPortfolio').mockRejectedValueOnce(new Error('Fallo de conexión'));

    const { result } = renderHook(() => usePortfolio({ userId: 'u1' }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Fallo de conexión');
    expect(result.current.data).toBeNull();
  });

  it('permite reintentar la consulta llamando a refetch()', async () => {
    const getPortfolioSpy = vi
      .spyOn(portfolioService, 'getPortfolio')
      .mockRejectedValueOnce(new Error('Fallo temporal'))
      .mockResolvedValueOnce({
        holdings: [],
        summary: { totalInvested: 0, totalCurrentValue: 0, netProfitLoss: 0 },
      });

    const { result } = renderHook(() => usePortfolio({ userId: 'u1' }));

    await waitFor(() => {
      expect(result.current.error).toBe('Fallo temporal');
    });

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data).toBeDefined();
    expect(getPortfolioSpy).toHaveBeenCalledTimes(2);
  });
});

