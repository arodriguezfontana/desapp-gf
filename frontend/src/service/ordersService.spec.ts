import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ordersService } from './ordersService';
import { httpClient } from './httpClient';
import type { OrderResponseDto } from '../types/orders.types';

describe('ordersService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('createOrder llama a POST /orders con side/playerId/quantity, sin price', async () => {
    const mockResponse: OrderResponseDto = {
      id: 'order-1',
      side: 'BUY',
      playerId: 'player-1',
      quantity: 10,
      remainingQuantity: 0,
      price: '12.50',
      status: 'COMPLETED',
      createdAt: '2026-10-16T12:00:00.000Z',
      fills: [{ counterpartOrderId: 'order-2', quantity: 10, price: '12.50' }],
    };

    const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce(mockResponse);

    const result = await ordersService.createOrder('BUY', 'player-1', 10);

    expect(postSpy).toHaveBeenCalledWith('/orders', {
      side: 'BUY',
      playerId: 'player-1',
      quantity: 10,
    });
    expect(result).toEqual(mockResponse);
  });

  it('createOrder con side SELL', async () => {
    const mockResponse: OrderResponseDto = {
      id: 'order-3',
      side: 'SELL',
      playerId: 'player-2',
      quantity: 5,
      remainingQuantity: 5,
      price: '20.00',
      status: 'PENDING',
      createdAt: '2026-10-16T12:00:00.000Z',
      fills: [],
    };

    const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce(mockResponse);

    const result = await ordersService.createOrder('SELL', 'player-2', 5);

    expect(postSpy).toHaveBeenCalledWith('/orders', {
      side: 'SELL',
      playerId: 'player-2',
      quantity: 5,
    });
    expect(result).toEqual(mockResponse);
  });

  it('propaga errores lanzados por httpClient (p. ej. holding insuficiente, 400)', async () => {
    vi.spyOn(httpClient, 'post').mockRejectedValueOnce(
      new Error('No tenés suficientes tokens de este jugador para esta operación.'),
    );

    await expect(ordersService.createOrder('SELL', 'player-1', 999)).rejects.toThrow(
      'No tenés suficientes tokens de este jugador para esta operación.',
    );
  });

  it('getUserOrders llama a GET /orders y devuelve el array de órdenes', async () => {
    const mockOrders: OrderResponseDto[] = [
      {
        id: 'order-1',
        side: 'BUY',
        playerId: 'player-1',
        quantity: 10,
        remainingQuantity: 10,
        price: '15.00',
        status: 'PENDING',
        createdAt: '2026-10-21T10:00:00.000Z',
        fills: [],
      },
      {
        id: 'order-2',
        side: 'SELL',
        playerId: 'player-2',
        quantity: 5,
        remainingQuantity: 0,
        price: '20.00',
        status: 'COMPLETED',
        createdAt: '2026-10-20T10:00:00.000Z',
        fills: [],
      },
    ];

    const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce(mockOrders);

    const result = await ordersService.getUserOrders();

    expect(getSpy).toHaveBeenCalledWith('/orders');
    expect(result).toEqual(mockOrders);
  });

  it('cancelOrder llama a DELETE /orders/:id y devuelve la orden cancelada', async () => {
    const mockResponse: OrderResponseDto = {
      id: 'order-1',
      side: 'SELL',
      playerId: 'player-1',
      quantity: 10,
      remainingQuantity: 4,
      price: '25.00',
      status: 'CANCELLED',
      createdAt: '2026-10-21T10:00:00.000Z',
      fills: [],
    };

    const deleteSpy = vi.spyOn(httpClient, 'delete').mockResolvedValueOnce(mockResponse);

    const result = await ordersService.cancelOrder('order-1');

    expect(deleteSpy).toHaveBeenCalledWith('/orders/order-1');
    expect(result).toEqual(mockResponse);
  });

  it('cancelOrder propaga errores si la orden no existe (404) o está en conflicto (409)', async () => {
    vi.spyOn(httpClient, 'delete').mockRejectedValueOnce(
      new Error('La orden no se puede cancelar porque ya fue completada o cancelada previamente.'),
    );

    await expect(ordersService.cancelOrder('order-1')).rejects.toThrow(
      'La orden no se puede cancelar porque ya fue completada o cancelada previamente.',
    );
  });
});
