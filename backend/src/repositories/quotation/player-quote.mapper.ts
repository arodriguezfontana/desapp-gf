import { Injectable } from '@nestjs/common';
import { PlayerQuote } from '../../domain/quotation/player-quote';
import { Position } from '../../domain/player/enums/position';
import { parseValuationMethod, ValuationMethod } from '../../domain/quotation/valuation-method';
import { PlayerQuoteEntity } from './entities/player-quote.entity';

/** Conversión dominio ↔ persistencia. Sin lógica de negocio. */
@Injectable()
export class PlayerQuoteMapper {
  toDomain(entity: PlayerQuoteEntity): PlayerQuote {
    return PlayerQuote.restore({
      id: entity.id,
      userId: entity.userId,
      playerId: entity.playerId,
      strategyId: entity.strategyId,
      weightSnapshot: entity.weightSnapshot,
      factorEscalaSnapshot: Number.parseFloat(entity.factorEscalaSnapshot),
      score: Number.parseFloat(entity.score),
      value: Number.parseFloat(entity.value),
      calculatedAt: entity.calculatedAt,
      appliedPosition: entity.appliedPosition as Position | null,
      valuationMethod: parseValuationMethod(entity.valuationMethod ?? ValuationMethod.WEIGHTED),
    });
  }

  toPersistence(domain: PlayerQuote): Partial<PlayerQuoteEntity> {
    return {
      id: domain.id,
      userId: domain.userId,
      playerId: domain.playerId,
      strategyId: domain.strategyId,
      weightSnapshot: domain.weightSnapshot,
      factorEscalaSnapshot: domain.factorEscalaSnapshot.toString(),
      score: domain.score.toString(),
      value: domain.value.toString(),
      calculatedAt: domain.calculatedAt,
      appliedPosition: domain.appliedPosition,
      valuationMethod: domain.valuationMethod,
    };
  }
}
