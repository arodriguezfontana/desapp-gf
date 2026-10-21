import { useState, useEffect, useCallback } from 'react';
import { catalogService } from '../service/catalogService';
import type { OrderBookResponseDto } from '../types/orders.types';

/**
 * Hook para consultar la profundidad de mercado (Order Book Level 2) de un jugador
 * (024-player-order-book). Ofrece snapshot bajo demanda y función de recarga manual.
 */
export function useOrderBook(playerId: string | undefined) {
  const [orderBook, setOrderBook] = useState<OrderBookResponseDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrderBook = useCallback(async () => {
    if (!playerId) {
      setOrderBook(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await catalogService.getOrderBook(playerId);
      setOrderBook(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar el libro de órdenes.');
    } finally {
      setIsLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    fetchOrderBook();
  }, [fetchOrderBook]);

  return {
    orderBook,
    isLoading,
    error,
    reload: fetchOrderBook,
  };
}

