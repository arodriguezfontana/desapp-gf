import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCreateOrder } from './useCreateOrder';
import { ordersService } from '../service/ordersService';
import type { OrderResponseDto } from '../types/orders.types';

describe('useCreateOrder', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockOrder: OrderResponseDto = {
    id: 'order-1',
    side: 'BUY',
    playerId: 'player-1',
    quantity: 5,
    remainingQuantity: 0,
    price: 100,
    status: 'COMPLETED',
    fills: [],
  };

  it('comienza con estado inactivo: isSubmitting false, error null', () => {
    const { result } = renderHook(() => useCreateOrder());
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('retorna la orden y limpia error ante una creación exitosa', async () => {
    vi.spyOn(ordersService, 'createOrder').mockResolvedValueOnce(mockOrder);

    const { result } = renderHook(() => useCreateOrder());

    let order: OrderResponseDto | null = null;
    await act(async () => {
      order = await result.current.createOrder('BUY', 'player-1', 5);
    });

    expect(order).toEqual(mockOrder);
    expect(result.current.error).toBeNull();
    expect(result.current.isSubmitting).toBe(false);
  });

  it('activa isSubmitting durante la llamada y lo desactiva al terminar', async () => {
    let resolveOrder!: (value: OrderResponseDto) => void;
    const promise = new Promise<OrderResponseDto>((res) => { resolveOrder = res; });
    vi.spyOn(ordersService, 'createOrder').mockReturnValueOnce(promise);

    const { result } = renderHook(() => useCreateOrder());

    act(() => {
      void result.current.createOrder('BUY', 'player-1', 5);
    });

    expect(result.current.isSubmitting).toBe(true);

    await act(async () => { resolveOrder(mockOrder); });

    expect(result.current.isSubmitting).toBe(false);
  });

  it('captura el mensaje de error cuando el servicio lanza un Error', async () => {
    vi.spyOn(ordersService, 'createOrder').mockRejectedValueOnce(new Error('Sin fondos suficientes.'));

    const { result } = renderHook(() => useCreateOrder());

    let order: OrderResponseDto | null = null;
    await act(async () => {
      order = await result.current.createOrder('SELL', 'player-1', 10);
    });

    expect(order).toBeNull();
    expect(result.current.error).toBe('Sin fondos suficientes.');
    expect(result.current.isSubmitting).toBe(false);
  });

  it('usa mensaje genérico cuando el error lanzado no es una instancia de Error', async () => {
    vi.spyOn(ordersService, 'createOrder').mockRejectedValueOnce('fallo raro');

    const { result } = renderHook(() => useCreateOrder());

    await act(async () => {
      await result.current.createOrder('BUY', 'player-1', 3);
    });

    expect(result.current.error).toBe('Error inesperado al publicar la orden.');
  });

  it('un nuevo llamado a createOrder limpia el error previo', async () => {
    vi.spyOn(ordersService, 'createOrder')
      .mockRejectedValueOnce(new Error('Error inicial'))
      .mockResolvedValueOnce(mockOrder);

    const { result } = renderHook(() => useCreateOrder());

    await act(async () => { await result.current.createOrder('BUY', 'player-1', 5); });
    expect(result.current.error).toBe('Error inicial');

    await act(async () => { await result.current.createOrder('BUY', 'player-1', 5); });

    await waitFor(() => expect(result.current.error).toBeNull());
  });
});
