import { ApiProperty } from '@nestjs/swagger';
import { PlayerQuote } from '../../../domain/quotation/player-quote';

export class PlayerQuoteResponseDto {
  @ApiProperty({ example: 'b3f1c2a4-1234-4a4a-8a8a-abcdef123456' })
  id: string;

  @ApiProperty({ example: 'b3f1c2a4-1234-4a4a-8a8a-abcdef123456' })
  playerId: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  strategyId: string;

  @ApiProperty({ example: 0.712345, description: 'Score normalizado (suma ponderada de métricas)' })
  score: number;

  @ApiProperty({ example: 71.52, description: 'Valor del token en créditos (1 + score × factorEscala)' })
  value: number;

  @ApiProperty({ example: '2026-10-08T03:00:00.000Z' })
  calculatedAt: string;

  private constructor(props: {
    id: string;
    playerId: string;
    strategyId: string;
    score: number;
    value: number;
    calculatedAt: Date;
  }) {
    this.id = props.id;
    this.playerId = props.playerId;
    this.strategyId = props.strategyId;
    this.score = props.score;
    this.value = props.value;
    this.calculatedAt = props.calculatedAt.toISOString();
  }

  static fromDomain(quote: PlayerQuote): PlayerQuoteResponseDto {
    return new PlayerQuoteResponseDto({
      id: quote.id,
      playerId: quote.playerId,
      strategyId: quote.strategyId,
      score: quote.score,
      value: quote.value,
      calculatedAt: quote.calculatedAt,
    });
  }
}
