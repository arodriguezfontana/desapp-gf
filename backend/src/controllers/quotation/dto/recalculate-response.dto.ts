import { ApiProperty } from '@nestjs/swagger';
import { RecalculateResult } from '../../../services/quotation/quotation.service';

class RecalculatedEntryDto {
  @ApiProperty() playerId!: string;
  @ApiProperty() value!: number;
  @ApiProperty() score!: number;
}

class SkippedEntryDto {
  @ApiProperty() playerId!: string;
  @ApiProperty() reason!: string;
}

export class RecalculateResponseDto {
  @ApiProperty({ type: [RecalculatedEntryDto], description: 'Jugadores recalculados y persistidos' })
  recalculated!: RecalculatedEntryDto[];

  @ApiProperty({
    type: [SkippedEntryDto],
    description: 'Jugadores salteados durante un recálculo masivo por fallar su cálculo',
  })
  skipped!: SkippedEntryDto[];

  static fromDomain(result: RecalculateResult): RecalculateResponseDto {
    const dto = new RecalculateResponseDto();
    dto.recalculated = result.recalculated;
    dto.skipped = result.skipped;
    return dto;
  }
}
