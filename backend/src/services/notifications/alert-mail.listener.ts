import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MailAdapter } from '../../adapters/mail/mail.adapter';
import { ALERT_TRIGGERED_EVENT, AlertTriggeredEvent } from '../../domain/alerts/events/alert-triggered.event';
import { UserRepository } from '../../repositories/auth/user.repository';
import { MAIL_ADAPTER } from '../../modules/mail/mail.constants';
import { USER_REPOSITORY } from '../../modules/auth/auth.constants';

/**
 * Escucha alert.triggered y envía el mail correspondiente
 * (025-player-price-alerts, spec FR-019, FR-020, FR-021). Independiente de
 * AlertNotificationListener: un fallo acá se loguea y nunca se relanza, para
 * no afectar a la notificación ya persistida por el otro listener ni al
 * resto del procesamiento del recálculo.
 */
@Injectable()
export class AlertMailListener {
  private readonly logger = new Logger(AlertMailListener.name);

  constructor(
    @Inject(MAIL_ADAPTER) private readonly mail: MailAdapter,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  @OnEvent(ALERT_TRIGGERED_EVENT)
  async handle(event: AlertTriggeredEvent): Promise<void> {
    try {
      const user = await this.users.findById(event.userId);
      if (!user) {
        this.logger.warn(`alert.triggered para un usuario inexistente (userId=${event.userId}), se omite el mail.`);
        return;
      }

      await this.mail.sendAlertTriggeredMail(user.email.toString(), {
        playerId: event.playerId,
        condition: event.condition,
        triggeredValue: event.triggeredValue,
        occurredAt: event.occurredAt,
      });
    } catch (err) {
      this.logger.error(
        `Falló el envío del mail de alerta disparada (alertId=${event.alertId})`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
