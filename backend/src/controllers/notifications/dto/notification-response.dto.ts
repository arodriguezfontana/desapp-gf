import { ApiProperty } from '@nestjs/swagger';
import { AlertCondition } from '../../../domain/alerts/alert-condition';
import { NotificationWithPlayerName } from '../../../services/notifications/notifications.service';

/** Respuesta de GET /notifications y del stream SSE (contracts/notifications-api.md). */
export class NotificationResponseDto {
  @ApiProperty({ example: 'b3f1c2a4-1234-4a4a-8a8a-abcdef123456' })
  id!: string;

  @ApiProperty({ example: 'b3f1c2a4-1234-4a4a-8a8a-abcdef123456' })
  alertId!: string;

  @ApiProperty({ example: 'b3f1c2a4-1234-4a4a-8a8a-abcdef123456' })
  playerId!: string;

  @ApiProperty({ example: 'Lionel Messi' })
  playerName!: string;

  @ApiProperty({ enum: AlertCondition })
  condition!: AlertCondition;

  @ApiProperty({ example: 9.8 })
  triggeredValue!: number;

  @ApiProperty({ example: '2026-10-22T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: false })
  read!: boolean;

  static fromDomain(notification: NotificationWithPlayerName): NotificationResponseDto {
    const dto = new NotificationResponseDto();
    dto.id = notification.id;
    dto.alertId = notification.alertId;
    dto.playerId = notification.playerId;
    dto.playerName = notification.playerName;
    dto.condition = notification.condition;
    dto.triggeredValue = notification.triggeredValue;
    dto.createdAt = notification.createdAt.toISOString();
    dto.read = notification.read;
    return dto;
  }
}
