import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsPositive, IsUUID } from 'class-validator';
import { AlertCondition } from '../../../domain/alerts/alert-condition';

/** Body de POST /alerts (025-player-price-alerts, contracts/alerts-api.md). */
export class CreatePriceAlertRequestDto {
  @ApiProperty({ example: 'b3f1c2a4-1234-4a4a-8a8a-abcdef123456' })
  @IsUUID()
  playerId!: string;

  @ApiProperty({ enum: AlertCondition, example: AlertCondition.PRICE_BELOW })
  @IsEnum(AlertCondition)
  condition!: AlertCondition;

  @ApiProperty({ example: 12.5, description: 'Valor umbral, número positivo' })
  @IsNumber()
  @IsPositive()
  targetValue!: number;
}
