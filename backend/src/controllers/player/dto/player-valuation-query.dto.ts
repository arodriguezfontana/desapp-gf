import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class PlayerValuationQueryDto {
  @ApiPropertyOptional({
    description: 'Id de una de mis dos estrategias propias, para usar en este cálculo en lugar de la seleccionada',
  })
  @IsOptional()
  @IsUUID()
  strategyId?: string;
}
