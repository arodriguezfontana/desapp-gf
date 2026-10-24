import type { AlertCondition } from './alerts.types';

export interface NotificationResponseDto {
  id: string;
  alertId: string;
  playerId: string;
  playerName: string;
  condition: AlertCondition;
  triggeredValue: number;
  createdAt: string;
  read: boolean;
}
