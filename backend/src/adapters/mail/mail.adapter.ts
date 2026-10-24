import { AlertCondition } from '../../domain/alerts/alert-condition';

export interface AlertTriggeredMailPayload {
  playerId: string;
  condition: AlertCondition;
  triggeredValue: number;
  occurredAt: Date;
}

/**
 * Puerto de dominio hacia el envío de mails (025-player-price-alerts,
 * constitución Principio I): única puerta de entrada a Nodemailer. El
 * Service de notificaciones nunca importa Nodemailer directamente.
 */
export interface MailAdapter {
  sendAlertTriggeredMail(to: string, payload: AlertTriggeredMailPayload): Promise<void>;
}
