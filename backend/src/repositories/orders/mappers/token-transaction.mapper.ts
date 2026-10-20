import { Injectable } from '@nestjs/common';
import { TokenTransaction } from '../../../domain/orders/token-transaction';
import { TokenTransactionType } from '../../../domain/orders/token-transaction-type';
import { TokenTransactionEntity } from '../entities/token-transaction.entity';

/** Conversion dominio <-> persistencia. Sin logica de negocio. */
@Injectable()
export class TokenTransactionMapper {
  toDomain(entity: TokenTransactionEntity): TokenTransaction {
    return TokenTransaction.create({
      id: entity.id,
      userId: entity.userId,
      type: entity.type as TokenTransactionType,
      playerId: entity.playerId,
      quantity: entity.quantity,
      price: Number.parseFloat(entity.price),
      orderId: entity.orderId,
      counterpartOrderId: entity.counterpartOrderId,
      createdAt: entity.createdAt,
    });
  }

  toEntity(transaction: TokenTransaction): TokenTransactionEntity {
    const entity = new TokenTransactionEntity();
    entity.id = transaction.id;
    entity.userId = transaction.userId;
    entity.type = transaction.type;
    entity.playerId = transaction.playerId;
    entity.quantity = transaction.quantity;
    entity.price = transaction.price.toFixed(2);
    entity.orderId = transaction.orderId;
    entity.counterpartOrderId = transaction.counterpartOrderId;
    entity.createdAt = transaction.createdAt;
    return entity;
  }
}
