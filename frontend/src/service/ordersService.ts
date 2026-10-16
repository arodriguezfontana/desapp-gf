import { httpClient } from './httpClient';
import type { CreateOrderRequest, OrderResponseDto, OrderSide, TokenTransactionDto } from '../types/orders.types';

/**
 * Cliente de API para órdenes (020-order-matching-engine). Única capa que
 * conoce la base URL/headers/manejo de errores de red para este recurso
 * (constitución: "Toda llamada HTTP al backend MUST pasar por un cliente de
 * API propio").
 */
export const ordersService = {
  async createOrder(side: OrderSide, playerId: string, quantity: number): Promise<OrderResponseDto> {
    const body: CreateOrderRequest = { side, playerId, quantity };
    return httpClient.post<OrderResponseDto>('/orders', body);
  },

  async getHistory(): Promise<TokenTransactionDto[]> {
    return httpClient.get<TokenTransactionDto[]>('/orders/history');
  },
};
