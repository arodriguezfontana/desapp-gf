export type OrderSide = 'BUY' | 'SELL';
export type TokenTransactionType = 'CREDIT' | 'DEBIT';

export interface TokenTransactionDto {
  id: string;
  type: TokenTransactionType;
  playerId: string;
  playerName: string;
  quantity: number;
  price: string;
  orderId: string;
  counterpartOrderId: string;
  createdAt: string;
}
export type OrderStatus = 'PENDING' | 'PARTIALLY_FILLED' | 'COMPLETED' | 'CANCELLED';

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
