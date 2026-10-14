import { useState, useEffect, useCallback, useMemo } from 'react';
import { portfolioService } from '../service/portfolioService';
import { useCurrentUser } from './useCurrentUser';
import type { Holding, PortfolioResponse, PortfolioSummary } from '../types/portfolio';

export interface UsePortfolioOptions {
  userId?: string;
}

export function usePortfolio(options: UsePortfolioOptions = {}) {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const targetUserId = options.userId ?? user?.id;

  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
    if (!targetUserId) {
      if (!isUserLoading) {
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await portfolioService.getPortfolio(targetUserId);
      setData(response);
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message !== 'No autorizado.') {
          setError(err.message || 'Error inesperado al consultar el portfolio.');
        }
      } else {
        setError('Error inesperado al consultar el portfolio.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [targetUserId, isUserLoading]);

  useEffect(() => {
    let cancelled = false;

    const loadPortfolio = async () => {
      if (!targetUserId) {
        if (!cancelled) {
          setIsLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setIsLoading(true);
        setError(null);
      }

      try {
        const res = await portfolioService.getPortfolio(targetUserId);
        if (!cancelled) {
          setData(res);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          if (err instanceof Error) {
            if (err.message !== 'No autorizado.') {
              setError(err.message || 'Error inesperado al consultar el portfolio.');
            }
          } else {
            setError('Error inesperado al consultar el portfolio.');
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadPortfolio();

    return () => {
      cancelled = true;
    };
  }, [targetUserId]);

  const holdings: Holding[] = useMemo(() => data?.holdings ?? [], [data]);

  const summary: PortfolioSummary = useMemo(() => {
    if (data?.summary) {
      return data.summary;
    }

    const totalInvested = holdings.reduce(
      (acc, h) => acc + h.tokenQuantity * h.averageBuyPrice,
      0,
    );
    const totalCurrentValue = holdings.reduce(
      (acc, h) => acc + h.tokenQuantity * h.currentPrice,
      0,
    );
    const netProfitLoss = holdings.reduce(
      (acc, h) =>
        acc +
        (h.totalProfitLoss !== undefined
          ? h.totalProfitLoss
          : (h.currentPrice - h.averageBuyPrice) * h.tokenQuantity),
      0,
    );

    return {
      totalInvested,
      totalCurrentValue,
      netProfitLoss,
    };
  }, [data, holdings]);

  const isEmpty = holdings.length === 0;

  return {
    data,
    holdings,
    summary,
    isEmpty,
    isLoading: isUserLoading && !options.userId ? true : isLoading,
    error,
    refetch: fetchPortfolio,
  };
}
