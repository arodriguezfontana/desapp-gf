import { ApiProperty } from '@nestjs/swagger';
import { PlayerQuote } from '../../../domain/quotation/player-quote';
import { Position } from '../../../domain/player/enums/position';

export class PlayerQuoteDetailResponseDto {
  @ApiProperty({
    example: 'b3f1c2a4-1234-4a4a-8a8a-abcdef123456',
    description: 'Identificador único del jugador',
  })
  playerId: string;

  @ApiProperty({
    example: 71.52,
    description: 'Valor del token en créditos (DECIMAL 10,2)',
  })
  valor: number;

  @ApiProperty({
    example: 0.712345,
    description: 'Score normalizado (DECIMAL 8,6)',
  })
  score: number;

  @ApiProperty({
    example: 'Performance General',
    description: 'Nombre de la estrategia aplicada al momento del cálculo',
  })
  strategyName: string;

  @ApiProperty({
    example: { goals: 0.35, assists: 0.25 },
    description: 'Snapshot de los pesos utilizados en el cálculo',
  })
  weights: Record<string, number>;

  @ApiProperty({
    example: '2026-09-15T18:30:00.000Z',
    description: 'Timestamp ISO 8601 del momento del cálculo',
  })
  calculatedAt: string;

  @ApiProperty({
    example: 'FW',
    description:
      'Posición cuyo perfil de pesos se usó en el cálculo, o null si se usaron los pesos generales de la estrategia',
    nullable: true,
    enum: Position,
  })
  appliedPosition: Position | null;

  constructor(props: {
    playerId: string;
    valor: number;
    score: number;
    strategyName: string;
    weights: Record<string, number>;
    calculatedAt: string;
    appliedPosition: Position | null;
  }) {
    this.playerId = props.playerId;
    this.valor = props.valor;
    this.score = props.score;
    this.strategyName = props.strategyName;
    this.weights = props.weights;
    this.calculatedAt = props.calculatedAt;
    this.appliedPosition = props.appliedPosition;
  }

  static fromDomain(quote: PlayerQuote, strategyName: string): PlayerQuoteDetailResponseDto {
    return new PlayerQuoteDetailResponseDto({
      playerId: quote.playerId,
      valor: quote.value,
      score: quote.score,
      strategyName,
      weights: quote.weightSnapshot,
      calculatedAt: quote.calculatedAt.toISOString(),
      appliedPosition: quote.appliedPosition,
    });
  }
}

