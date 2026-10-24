import { ApiProperty } from '@nestjs/swagger';
import { Order } from '../../../domain/orders/order';
import { OrderSide } from '../../../domain/orders/order-side';
import { OrderStatus } from '../../../domain/orders/order-status';

export class OrderFillDto {
  @ApiProperty({ example: 'b3f1c2a4-1234-4a4a-8a8a-abcdef123456' })
  counterpartOrderId: string;

  @ApiProperty({ example: 7 })
  quantity: number;

  @ApiProperty({ example: '12.50' })
  price: string;

  constructor(counterpartOrderId: string, quantity: number, price: number) {
    this.counterpartOrderId = counterpartOrderId;
    this.quantity = quantity;
    this.price = price.toFixed(2);
  }
}

/** Respuesta de POST /orders, DELETE /orders/:id y GET /orders (020-order-matching-engine, 023-cancel-order). */
export class OrderResponseDto {
  @ApiProperty({ example: 'b3f1c2a4-1234-4a4a-8a8a-abcdef123456' })
  id: string;

  @ApiProperty({ enum: OrderSide })
  side: OrderSide;

  @ApiProperty({ example: 'b3f1c2a4-1234-4a4a-8a8a-abcdef123456' })
  playerId: string;

  @ApiProperty({ example: 10 })
  quantity: number;

  @ApiProperty({ example: 0 })
  remainingQuantity: number;

  @ApiProperty({ example: '12.50' })
  price: string;

  @ApiProperty({ enum: OrderStatus })
  status: OrderStatus;

  @ApiProperty({ example: '2026-10-16T12:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ type: [OrderFillDto] })
  fills: OrderFillDto[];

  @ApiProperty({ example: 'Lionel Messi' })
  playerName: string;

  private constructor(order: Order, fills: OrderFillDto[], playerName: string) {
    this.id = order.id;
    this.side = order.side;
    this.playerId = order.playerId;
    this.quantity = order.quantity;
    this.remainingQuantity = order.remainingQuantity;
    this.price = order.price.toFixed(2);
    this.status = order.status;
    this.createdAt = order.createdAt.toISOString();
    this.fills = fills;
    this.playerName = playerName;
  }

  static fromDomain(
    order: Order,
    fills: Array<{ counterpartOrderId: string; quantity: number; price: number }> = [],
    playerName = '',
  ): OrderResponseDto {
    return new OrderResponseDto(
      order,
      fills.map((f) => new OrderFillDto(f.counterpartOrderId, f.quantity, f.price)),
      playerName,
    );
  }
}
