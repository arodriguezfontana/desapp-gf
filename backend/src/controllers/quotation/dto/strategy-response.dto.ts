import { ApiProperty } from '@nestjs/swagger';
import { ValuationStrategy } from '../../../domain/quotation/valuation-strategy';
import { Position } from '../../../domain/player/enums/position';

export class StrategyResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() weights!: Record<string, number>;
  @ApiProperty() factorEscala!: number;
  @ApiProperty() isActive!: boolean;

  @ApiProperty({
    description:
      'Perfiles de pesos por posición (FW/MF/DF/GK), si la estrategia los define. Solo lectura: se cargan por seed (014-position-weight-profiles, FR-008).',
    example: { FW: { goals: 0.45, shots: 0.25, assists: 0.15, rating: 0.15 } },
  })
  positionWeights!: Partial<Record<Position, Record<string, number>>>;

  static fromDomain(strategy: ValuationStrategy): StrategyResponseDto {
    const dto = new StrategyResponseDto();
    dto.id = strategy.id;
    dto.name = strategy.name;
    dto.weights = strategy.weights;
    dto.factorEscala = strategy.factorEscala;
    dto.isActive = strategy.isActive;
    dto.positionWeights = strategy.positionWeights;
    return dto;
  }
}
