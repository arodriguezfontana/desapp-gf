import { httpClient } from './httpClient';
import type { CreateOrderRequest, OrderResponseDto, OrderSide, TokenTransactionDto } from '../types/orders.types';

/**
 * Cliente de API para órdenes (020-order-matching-engine, 023-cancel-order). Única capa que
 * conoce la base URL/headers/manejo de errores de red para este recurso
 * (constitución: "Toda llamada HTTP al backend MUST pasar por un cliente de
 * API propio").
 */
export const ordersService = {
  async createOrder(side: OrderSide, playerId: string, quantity: number): Promise<OrderResponseDto> {
    const body: CreateOrderRequest = { side, playerId, quantity };
    return httpClient.post<OrderResponseDto>('/orders', body);
  },

  async getUserOrders(): Promise<OrderResponseDto[]> {
    return httpClient.get<OrderResponseDto[]>('/orders');
  },

  async cancelOrder(orderId: string): Promise<OrderResponseDto> {
    return httpClient.delete<OrderResponseDto>(`/orders/${orderId}`);
  },

  async getHistory(): Promise<TokenTransactionDto[]> {
    return httpClient.get<TokenTransactionDto[]>('/orders/history');
  },
};
