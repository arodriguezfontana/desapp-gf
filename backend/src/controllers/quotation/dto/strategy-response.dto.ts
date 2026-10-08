import { ApiProperty } from '@nestjs/swagger';
import { ValuationStrategy } from '../../../domain/quotation/valuation-strategy';

export class StrategyResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() weights!: Record<string, number>;
  @ApiProperty() factorEscala!: number;
  @ApiProperty() isActive!: boolean;

  static fromDomain(strategy: ValuationStrategy): StrategyResponseDto {
    const dto = new StrategyResponseDto();
    dto.id = strategy.id;
    dto.name = strategy.name;
    dto.weights = strategy.weights;
    dto.factorEscala = strategy.factorEscala;
    dto.isActive = strategy.isActive;
    return dto;
  }
}
