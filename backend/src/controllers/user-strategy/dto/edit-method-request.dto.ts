import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ValuationMethod } from '../../../domain/quotation/valuation-method';

export class EditMethodRequestDto {
  @ApiProperty({
    enum: ValuationMethod,
    description: 'Método de cálculo de la estrategia: WEIGHTED (techos de temporada) o PER_MATCH (métricas acumuladas por partido).',
    example: ValuationMethod.PER_MATCH,
  })
  @IsEnum(ValuationMethod)
  method!: ValuationMethod;
}
