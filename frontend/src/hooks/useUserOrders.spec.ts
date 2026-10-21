import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useUserOrders } from './useUserOrders';
import { ordersService } from '../service/ordersService';
import type { OrderResponseDto } from '../types/orders.types';

describe('useUserOrders', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockOrders: OrderResponseDto[] = [
    {
      id: 'order-1',
      side: 'SELL',
      playerId: 'player-1',
      quantity: 10,
      remainingQuantity: 6,
      price: '25.00',
      status: 'PARTIALLY_FILLED',
      createdAt: '2026-10-21T10:00:00.000Z',
      fills: [],
    },
    {
      id: 'order-2',
      side: 'BUY',
      playerId: 'player-2',
      quantity: 5,
      remainingQuantity: 5,
      price: '15.00',
      status: 'PENDING',
      createdAt: '2026-10-21T09:00:00.000Z',
      fills: [],
    },
  ];

  it('carga las órdenes al inicializarse', async () => {
    vi.spyOn(ordersService, 'getUserOrders').mockResolvedValueOnce(mockOrders);

    const { result } = renderHook(() => useUserOrders());

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.orders).toEqual(mockOrders);
    expect(result.current.error).toBeNull();
  });

  it('maneja errores de carga inicial', async () => {
    vi.spyOn(ordersService, 'getUserOrders').mockRejectedValueOnce(new Error('Fallo de red'));

    const { result } = renderHook(() => useUserOrders());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('Fallo de red');
    expect(result.current.orders).toEqual([]);
  });

  it('ignora error "No autorizado."', async () => {
    vi.spyOn(ordersService, 'getUserOrders').mockRejectedValueOnce(new Error('No autorizado.'));

    const { result } = renderHook(() => useUserOrders());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
  });

  it('cancelOrder actualiza el estado de la orden a CANCELLED', async () => {
    vi.spyOn(ordersService, 'getUserOrders').mockResolvedValueOnce(mockOrders);
    vi.spyOn(ordersService, 'cancelOrder').mockResolvedValueOnce({
      ...mockOrders[0],
      status: 'CANCELLED',
    });

    const { result } = renderHook(() => useUserOrders());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let success = false;
    await act(async () => {
      success = await result.current.cancelOrder('order-1');
    });

    expect(success).toBe(true);
    expect(result.current.cancellingOrderId).toBeNull();
    expect(result.current.orders.find((o) => o.id === 'order-1')?.status).toBe('CANCELLED');
    expect(result.current.orders.find((o) => o.id === 'order-2')?.status).toBe('PENDING');
  });

  it('cancelOrder captura el error si falla la cancelación', async () => {
    vi.spyOn(ordersService, 'getUserOrders').mockResolvedValueOnce(mockOrders);
    vi.spyOn(ordersService, 'cancelOrder').mockRejectedValueOnce(
      new Error('La orden no se puede cancelar porque ya fue completada o cancelada previamente.'),
    );

    const { result } = renderHook(() => useUserOrders());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let success = true;
    await act(async () => {
      success = await result.current.cancelOrder('order-1');
    });

    expect(success).toBe(false);
    expect(result.current.cancellingOrderId).toBeNull();
    expect(result.current.error).toBe(
      'La orden no se puede cancelar porque ya fue completada o cancelada previamente.',
    );
  });
});

