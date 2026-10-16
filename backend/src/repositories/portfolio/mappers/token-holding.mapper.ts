import { Injectable } from '@nestjs/common';
import { TokenHolding } from '../../../domain/portfolio/token-holding';
import { TokenHoldingEntity } from '../entities/token-holding.entity';

/** Conversion dominio <-> persistencia. Sin logica de negocio. */
@Injectable()
export class TokenHoldingMapper {
  toDomain(entity: TokenHoldingEntity): TokenHolding {
    return TokenHolding.restore({
      id: entity.id,
      userId: entity.userId,
      playerId: entity.playerId,
      quantity: entity.quantity,
      updatedAt: entity.updatedAt,
    });
  }

  toEntity(holding: TokenHolding): TokenHoldingEntity {
    const entity = new TokenHoldingEntity();
    entity.id = holding.id;
    entity.userId = holding.userId;
    entity.playerId = holding.playerId;
    entity.quantity = holding.quantity;
    entity.updatedAt = holding.updatedAt;
    return entity;
  }
}
