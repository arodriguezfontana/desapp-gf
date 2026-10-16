import { useState, useEffect, useCallback } from 'react';
import { ordersService } from '../service/ordersService';
import type { TokenTransactionDto } from '../types/orders.types';

export function useOrderHistory() {
  const [transactions, setTransactions] = useState<TokenTransactionDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await ordersService.getHistory();
      setTransactions(data);
    } catch (err: unknown) {
      if (err instanceof Error && err.message !== 'No autorizado.') {
        setError(err.message || 'Error al cargar el historial.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { transactions, isLoading, error, refetch: fetch };
}
