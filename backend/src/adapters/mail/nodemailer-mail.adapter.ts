import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { AlertTriggeredMailPayload, MailAdapter } from './mail.adapter';
import { alertConditionLabel } from '../../domain/alerts/alert-condition-label';

/**
 * Implementación real de MailAdapter sobre @nestjs-modules/mailer/Nodemailer
 * (025-player-price-alerts, research.md §3). El transporte SMTP se configura
 * por variables de entorno MAIL_* (MailModule), nunca hardcodeado.
 */
@Injectable()
export class NodemailerMailAdapter implements MailAdapter {
  constructor(private readonly mailer: MailerService) {}

  async sendAlertTriggeredMail(to: string, payload: AlertTriggeredMailPayload): Promise<void> {
    await this.mailer.sendMail({
      to,
      subject: 'Tu alerta de precio se disparó',
      text: this.buildText(payload),
    });
  }

  private buildText(payload: AlertTriggeredMailPayload): string {
    return [
      'Una de tus alertas de precio se disparó.',
      `Jugador: ${payload.playerId}`,
      `Condición cumplida: ${alertConditionLabel(payload.condition)}`,
      `Valor que la disparó: ${payload.triggeredValue}`,
      `Fecha: ${payload.occurredAt.toISOString()}`,
    ].join('\n');
  }
}
