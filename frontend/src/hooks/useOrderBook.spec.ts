import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOrderBook } from './useOrderBook';
import { catalogService } from '../service/catalogService';
import type { OrderBookResponseDto } from '../types/orders.types';

describe('useOrderBook', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockOrderBook: OrderBookResponseDto = {
    playerId: 'player-1',
    bids: [
      { price: '24.50', totalQuantity: 15 },
      { price: '23.00', totalQuantity: 30 },
    ],
    asks: [
      { price: '25.00', totalQuantity: 10 },
      { price: '26.50', totalQuantity: 25 },
    ],
  };

  it('carga el libro de órdenes al inicializarse', async () => {
    vi.spyOn(catalogService, 'getOrderBook').mockResolvedValueOnce(mockOrderBook);

    const { result } = renderHook(() => useOrderBook('player-1'));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.orderBook).toEqual(mockOrderBook);
    expect(result.current.error).toBeNull();
    expect(catalogService.getOrderBook).toHaveBeenCalledWith('player-1');
  });

  it('maneja errores de carga', async () => {
    vi.spyOn(catalogService, 'getOrderBook').mockRejectedValueOnce(new Error('Fallo al obtener libro'));

    const { result } = renderHook(() => useOrderBook('player-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.orderBook).toBeNull();
    expect(result.current.error).toBe('Fallo al obtener libro');
  });

  it('permite recargar manualmente el libro mediante reload', async () => {
    vi.spyOn(catalogService, 'getOrderBook')
      .mockResolvedValueOnce(mockOrderBook)
      .mockResolvedValueOnce({
        ...mockOrderBook,
        bids: [{ price: '25.00', totalQuantity: 20 }],
      });

    const { result } = renderHook(() => useOrderBook('player-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.orderBook?.bids[0].totalQuantity).toBe(15);

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.orderBook?.bids[0].totalQuantity).toBe(20);
    expect(catalogService.getOrderBook).toHaveBeenCalledTimes(2);
  });

  it('maneja playerId undefined sin ejecutar llamada a la red', async () => {
    const spy = vi.spyOn(catalogService, 'getOrderBook');

    const { result } = renderHook(() => useOrderBook(undefined));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.orderBook).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });
});

