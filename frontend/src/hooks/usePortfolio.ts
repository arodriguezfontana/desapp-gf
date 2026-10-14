import { useState, useEffect, useCallback, useMemo } from 'react';
import { portfolioService } from '../service/portfolioService';
import { useCurrentUser } from './useCurrentUser';
import type { Holding, PortfolioResponse, PortfolioSummary } from '../types/portfolio';

export interface UsePortfolioOptions {
  userId?: string;
}

function extractErrorMessage(err: unknown): string | null {
  if (!(err instanceof Error)) {
    return 'Error inesperado al consultar el portfolio.';
  }
  if (err.message === 'No autorizado.') {
    return null;
  }
  return err.message || 'Error inesperado al consultar el portfolio.';
}

function computeHoldingProfitLoss(holding: Holding): number {
  if (holding.totalProfitLoss !== undefined) {
    return holding.totalProfitLoss;
  }
  return (holding.currentPrice - holding.averageBuyPrice) * holding.tokenQuantity;
}

function computeSummary(holdings: Holding[]): PortfolioSummary {
  let totalInvested = 0;
  let totalCurrentValue = 0;
  let netProfitLoss = 0;

  for (const h of holdings) {
    totalInvested += h.tokenQuantity * h.averageBuyPrice;
    totalCurrentValue += h.tokenQuantity * h.currentPrice;
    netProfitLoss += computeHoldingProfitLoss(h);
  }

  return { totalInvested, totalCurrentValue, netProfitLoss };
}

export function usePortfolio(options: UsePortfolioOptions = {}) {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const targetUserId = options.userId ?? user?.id;

  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
    if (!targetUserId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await portfolioService.getPortfolio(targetUserId);
      setData(response);
    } catch (err: unknown) {
      const message = extractErrorMessage(err);
      if (message) {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    const load = async () => {
      await fetchPortfolio();
    };
    void load();
  }, [fetchPortfolio]);

  const holdings: Holding[] = useMemo(() => data?.holdings ?? [], [data]);

  const summary: PortfolioSummary = useMemo(() => {
    if (data?.summary) {
      return data.summary;
    }
    return computeSummary(holdings);
  }, [data, holdings]);

  const isEmpty = holdings.length === 0;
  const isPendingUser = isUserLoading && !options.userId;

  return {
    data,
    holdings,
    summary,
    isEmpty,
    isLoading: isPendingUser ? true : isLoading,
    error,
    refetch: fetchPortfolio,
  };
}
