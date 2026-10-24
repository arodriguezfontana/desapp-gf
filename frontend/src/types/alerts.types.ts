export type AlertCondition = 'PRICE_ABOVE' | 'PRICE_BELOW';
export type AlertStatus = 'ACTIVE' | 'CANCELLED';

export interface CreatePriceAlertRequest {
  playerId: string;
  condition: AlertCondition;
  targetValue: number;
}

export interface PriceAlertResponseDto {
  id: string;
  playerId: string;
  condition: AlertCondition;
  targetValue: number;
  status: AlertStatus;
  createdAt: string;
}
