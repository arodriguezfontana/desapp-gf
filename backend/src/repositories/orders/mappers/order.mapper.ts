import { Injectable } from '@nestjs/common';
import { Order } from '../../../domain/orders/order';
import { OrderSide } from '../../../domain/orders/order-side';
import { OrderStatus } from '../../../domain/orders/order-status';
import { OrderEntity } from '../entities/order.entity';

/** Conversion dominio <-> persistencia. Sin logica de negocio. */
@Injectable()
export class OrderMapper {
  toDomain(entity: OrderEntity): Order {
    return Order.restore({
      id: entity.id,
      userId: entity.userId,
      playerId: entity.playerId,
      side: entity.side as OrderSide,
      quantity: entity.quantity,
      remainingQuantity: entity.remainingQuantity,
      price: Number.parseFloat(entity.price),
      createdAt: entity.createdAt,
      status: entity.status as OrderStatus,
    });
  }

  toEntity(order: Order): OrderEntity {
    const entity = new OrderEntity();
    entity.id = order.id;
    entity.userId = order.userId;
    entity.playerId = order.playerId;
    entity.side = order.side;
    entity.quantity = order.quantity;
    entity.remainingQuantity = order.remainingQuantity;
    entity.price = order.price.toFixed(2);
    entity.status = order.status;
    entity.createdAt = order.createdAt;
    return entity;
  }
}
