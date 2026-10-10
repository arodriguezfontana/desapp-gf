import { Injectable } from '@nestjs/common';
import { PlayerQuote } from '../../domain/quotation/player-quote';
import { PlayerQuoteEntity } from './entities/player-quote.entity';

/** Conversión dominio ↔ persistencia. Sin lógica de negocio. */
@Injectable()
export class PlayerQuoteMapper {
  toDomain(entity: PlayerQuoteEntity): PlayerQuote {
    return PlayerQuote.restore({
      id: entity.id,
      playerId: entity.playerId,
      strategyId: entity.strategyId,
      weightSnapshot: entity.weightSnapshot,
      factorEscalaSnapshot: Number.parseFloat(entity.factorEscalaSnapshot),
      score: Number.parseFloat(entity.score),
      value: Number.parseFloat(entity.value),
      calculatedAt: entity.calculatedAt,
    });
  }

  toPersistence(domain: PlayerQuote): Partial<PlayerQuoteEntity> {
    return {
      id: domain.id,
      playerId: domain.playerId,
      strategyId: domain.strategyId,
      weightSnapshot: domain.weightSnapshot,
      factorEscalaSnapshot: domain.factorEscalaSnapshot.toString(),
      score: domain.score.toString(),
      value: domain.value.toString(),
    };
  }
}
