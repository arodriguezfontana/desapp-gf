import { ApiProperty } from '@nestjs/swagger';
import { ValuationStrategy } from '../../../domain/quotation/valuation-strategy';
import { Position } from '../../../domain/player/enums/position';

export class UserStrategyResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() weights!: Record<string, number>;
  @ApiProperty() factorEscala!: number;
  @ApiProperty() isSelected!: boolean;

  @ApiProperty({
    description: 'Perfiles de pesos por posición (FW/MF/DF/GK), si la estrategia los define.',
    example: { FW: { goals: 0.45, shots: 0.25, assists: 0.15, rating: 0.15 } },
  })
  positionWeights!: Partial<Record<Position, Record<string, number>>>;

  static fromDomain(strategy: ValuationStrategy): UserStrategyResponseDto {
    const dto = new UserStrategyResponseDto();
    dto.id = strategy.id;
    dto.name = strategy.name;
    dto.weights = strategy.weights;
    dto.factorEscala = strategy.factorEscala;
    dto.isSelected = strategy.isSelected;
    dto.positionWeights = strategy.positionWeights;
    return dto;
  }
}

export class UserStrategyListResponseDto {
  @ApiProperty({ type: [UserStrategyResponseDto] })
  strategies!: UserStrategyResponseDto[];

  static fromDomain(strategies: ValuationStrategy[]): UserStrategyListResponseDto {
    const dto = new UserStrategyListResponseDto();
    dto.strategies = strategies.map((s) => UserStrategyResponseDto.fromDomain(s));
    return dto;
  }
}
