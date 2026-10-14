import { Injectable } from '@nestjs/common';
import { ValuationStrategy } from '../../domain/quotation/valuation-strategy';
import { ValuationStrategyEntity } from './entities/valuation-strategy.entity';

/** Conversión dominio ↔ persistencia. Sin lógica de negocio. */
@Injectable()
export class ValuationStrategyMapper {
  toDomain(entity: ValuationStrategyEntity): ValuationStrategy {
    return ValuationStrategy.restore({
      id: entity.id,
      name: entity.name,
      weights: entity.weights,
      factorEscala: Number.parseFloat(entity.factorEscala),
      isActive: entity.isActive,
      positionWeights: entity.positionWeights ?? {},
    });
  }

  toPersistence(domain: ValuationStrategy): Partial<ValuationStrategyEntity> {
    const positionWeights = domain.positionWeights;
    return {
      id: domain.id,
      name: domain.name,
      weights: domain.weights,
      factorEscala: domain.factorEscala.toString(),
      isActive: domain.isActive,
      positionWeights: Object.keys(positionWeights).length > 0 ? positionWeights : null,
    };
  }
}
