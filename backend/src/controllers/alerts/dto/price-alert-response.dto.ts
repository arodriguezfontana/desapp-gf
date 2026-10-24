import { ApiProperty } from '@nestjs/swagger';
import { AlertCondition } from '../../../domain/alerts/alert-condition';
import { AlertStatus, PriceAlert } from '../../../domain/alerts/price-alert';

/** Respuesta de POST /alerts, GET /alerts y DELETE /alerts/:id (contracts/alerts-api.md). */
export class PriceAlertResponseDto {
  @ApiProperty({ example: 'b3f1c2a4-1234-4a4a-8a8a-abcdef123456' })
  id!: string;

  @ApiProperty({ example: 'b3f1c2a4-1234-4a4a-8a8a-abcdef123456' })
  playerId!: string;

  @ApiProperty({ enum: AlertCondition })
  condition!: AlertCondition;

  @ApiProperty({ example: '12.50' })
  targetValue!: number;

  @ApiProperty({ enum: AlertStatus })
  status!: AlertStatus;

  @ApiProperty({ example: '2026-10-22T00:00:00.000Z' })
  createdAt!: string;

  static fromDomain(alert: PriceAlert): PriceAlertResponseDto {
    const dto = new PriceAlertResponseDto();
    dto.id = alert.id;
    dto.playerId = alert.playerId;
    dto.condition = alert.condition;
    dto.targetValue = alert.targetValue;
    dto.status = alert.status;
    dto.createdAt = alert.createdAt.toISOString();
    return dto;
  }
}
