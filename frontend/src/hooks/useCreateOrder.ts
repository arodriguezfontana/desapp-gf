import { useCallback, useState } from 'react';
import { ordersService } from '../service/ordersService';
import type { OrderResponseDto, OrderSide } from '../types/orders.types';

/**
 * Encapsula la creación de órdenes (020-order-matching-engine) para que las
 * páginas nunca importen `service/` directamente (constitución: "hooks/ y
 * contexts/ — únicas capas que MUST invocar service/").
 */
export function useCreateOrder() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createOrder = useCallback(
    async (side: OrderSide, playerId: string, quantity: number): Promise<OrderResponseDto | null> => {
      setIsSubmitting(true);
      setError(null);
      try {
        const order = await ordersService.createOrder(side, playerId, quantity);
        return order;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error inesperado al publicar la orden.');
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [],
  );

  return { createOrder, isSubmitting, error };
}
