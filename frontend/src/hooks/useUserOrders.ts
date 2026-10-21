import { useState, useEffect, useCallback } from 'react';
import { ordersService } from '../service/ordersService';
import type { OrderResponseDto } from '../types/orders.types';

/**
 * Hook para consultar las órdenes propias del usuario autenticado y cancelar órdenes abiertas
 * (023-cancel-order). Las páginas y componentes nunca importan `service/` directamente (Principio I).
 */
export function useUserOrders() {
  const [orders, setOrders] = useState<OrderResponseDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await ordersService.getUserOrders();
      setOrders(data);
    } catch (err: unknown) {
      if (err instanceof Error && err.message !== 'No autorizado.') {
        setError(err.message || 'Error al cargar las órdenes.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const cancelOrder = useCallback(
    async (orderId: string): Promise<boolean> => {
      setCancellingOrderId(orderId);
      setError(null);
      try {
        const cancelled = await ordersService.cancelOrder(orderId);
        setOrders((prev) =>
          prev.map((order) => (order.id === orderId ? { ...order, status: cancelled.status } : order)),
        );
        return true;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error inesperado al cancelar la orden.');
        return false;
      } finally {
        setCancellingOrderId(null);
      }
    },
    [],
  );

  useEffect(() => {
    const load = async () => {
      await fetchOrders();
    };
    void load();
  }, [fetchOrders]);

  return {
    orders,
    isLoading,
    cancellingOrderId,
    error,
    refetch: fetchOrders,
    cancelOrder,
  };
}

