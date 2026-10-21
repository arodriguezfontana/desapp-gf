import { ApiProperty } from '@nestjs/swagger';
import { RecalculateResult } from '../../../services/quotation/quotation.service';

class RecalculatedEntryDto {
  @ApiProperty() userId!: string;
  @ApiProperty() playerId!: string;
  @ApiProperty() value!: number;
  @ApiProperty() score!: number;
}

class SkippedEntryDto {
  @ApiProperty() userId!: string;
  @ApiProperty() playerId!: string;
  @ApiProperty() reason!: string;
}

export class RecalculateResponseDto {
  @ApiProperty({ type: [RecalculatedEntryDto], description: 'Combinaciones recalculadas y persistidas' })
  recalculated!: RecalculatedEntryDto[];

  @ApiProperty({
    type: [SkippedEntryDto],
    description: 'Combinaciones salteadas por fallo en el cálculo',
  })
  skipped!: SkippedEntryDto[];

  static fromDomain(result: RecalculateResult): RecalculateResponseDto {
    const dto = new RecalculateResponseDto();
    dto.recalculated = result.recalculated;
    dto.skipped = result.skipped;
    return dto;
  }
}
