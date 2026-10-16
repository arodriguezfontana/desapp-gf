export type OrderSide = 'BUY' | 'SELL';
export type OrderStatus = 'PENDING' | 'PARTIALLY_FILLED' | 'COMPLETED';

export interface CreateOrderRequest {
  side: OrderSide;
  playerId: string;
  quantity: number;
}

export interface OrderFillDto {
  counterpartOrderId: string;
  quantity: number;
  price: string;
}

export interface OrderResponseDto {
  id: string;
  side: OrderSide;
  playerId: string;
  quantity: number;
  remainingQuantity: number;
  price: string;
  status: OrderStatus;
  createdAt: string;
  fills: OrderFillDto[];
}
