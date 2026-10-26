import { Injectable } from '@nestjs/common';
import { ValuationStrategy } from '../../domain/quotation/valuation-strategy';
import { ValuationStrategyEntity } from './entities/valuation-strategy.entity';

/** Conversión dominio ↔ persistencia. Sin lógica de negocio. */
@Injectable()
export class ValuationStrategyMapper {
  toDomain(entity: ValuationStrategyEntity): ValuationStrategy {
    return ValuationStrategy.restore({
      id: entity.id,
      userId: entity.userId,
      name: entity.name,
      weights: entity.weights,
      factorEscala: Number.parseFloat(entity.factorEscala),
      isSelected: entity.isSelected,
      positionWeights: entity.positionWeights ?? {},
    });
  }

  toPersistence(domain: ValuationStrategy): Partial<ValuationStrategyEntity> {
    const positionWeights = domain.positionWeights;
    return {
      id: domain.id,
      userId: domain.userId,
      name: domain.name,
      weights: domain.weights,
      factorEscala: domain.factorEscala.toString(),
      isSelected: domain.isSelected,
      positionWeights: Object.keys(positionWeights).length > 0 ? positionWeights : null,
    };
  }
}
