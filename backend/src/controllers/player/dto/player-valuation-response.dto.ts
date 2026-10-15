import { ApiProperty } from '@nestjs/swagger';
import { Position } from '../../../domain/player/enums/position';
import { ValuationResult } from '../../../services/quotation/quotation.service';

export class PlayerValuationResponseDto {
  @ApiProperty() playerId!: string;
  @ApiProperty() strategyId!: string;
  @ApiProperty({ description: 'Score normalizado (suma ponderada de métricas)' }) score!: number;
  @ApiProperty({ description: 'Valor del token en créditos (1 + score × factorEscala)' }) value!: number;

  @ApiProperty({
    nullable: true,
    enum: Position,
    description: 'Posición cuyo perfil de pesos se usó, o null si se usaron los pesos generales',
  })
  appliedPosition!: Position | null;

  static fromResult(result: ValuationResult): PlayerValuationResponseDto {
    const dto = new PlayerValuationResponseDto();
    dto.playerId = result.playerId;
    dto.strategyId = result.strategyId;
    dto.score = result.score;
    dto.value = result.value;
    dto.appliedPosition = result.appliedPosition;
    return dto;
  }
}
