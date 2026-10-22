import { Injectable } from '@nestjs/common';
import { AlertCondition } from '../../domain/alerts/alert-condition';
import { AlertStatus, PriceAlert } from '../../domain/alerts/price-alert';
import { PriceAlertEntity } from './entities/price-alert.entity';

/** Conversión dominio ↔ persistencia. Sin lógica de negocio. */
@Injectable()
export class PriceAlertMapper {
  toDomain(entity: PriceAlertEntity): PriceAlert {
    return PriceAlert.restore({
      id: entity.id,
      userId: entity.userId,
      playerId: entity.playerId,
      condition: entity.condition as AlertCondition,
      targetValue: Number.parseFloat(entity.targetValue),
      status: entity.status as AlertStatus,
      createdAt: entity.createdAt,
      cancelledAt: entity.cancelledAt,
    });
  }

  toPersistence(domain: PriceAlert): PriceAlertEntity {
    const entity = new PriceAlertEntity();
    entity.id = domain.id;
    entity.userId = domain.userId;
    entity.playerId = domain.playerId;
    entity.condition = domain.condition;
    entity.targetValue = domain.targetValue.toString();
    entity.status = domain.status;
    entity.createdAt = domain.createdAt;
    entity.cancelledAt = domain.cancelledAt;
    return entity;
  }
}
