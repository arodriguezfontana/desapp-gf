import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { PriceAlertRepository } from '../../repositories/alerts/price-alert.repository';
import { ALERT_TRIGGERED_EVENT, AlertTriggeredEvent } from '../../domain/alerts/events/alert-triggered.event';
import { QUOTE_RECALCULATED_EVENT, QuoteRecalculatedEvent } from '../../domain/alerts/events/quote-recalculated.event';

/**
 * Escucha quote.recalculated, evalúa las alertas activas del usuario+jugador
 * del evento y emite alert.triggered por cada una que cumple su condición
 * (025-player-price-alerts, spec FR-011, FR-012, FR-021). No conoce al
 * módulo de notificaciones: solo emite el evento de dominio.
 */
@Injectable()
export class QuoteRecalculatedListener {
  constructor(
    private readonly alerts: PriceAlertRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(QUOTE_RECALCULATED_EVENT)
  async handle(event: QuoteRecalculatedEvent): Promise<void> {
    const activeAlerts = await this.alerts.findActiveByUserIdAndPlayerId(event.userId, event.playerId);

    for (const alert of activeAlerts) {
      if (alert.matches(event.value)) {
        // emitAsync (no emit): espera a que los listeners de alert.triggered
        // (persistencia de Notification + envío de mail) terminen antes de
        // resolver, para que quote.recalculated solo se considere procesado
        // cuando la notificación ya quedó visible (spec SC-003).
        await this.eventEmitter.emitAsync(
          ALERT_TRIGGERED_EVENT,
          new AlertTriggeredEvent(
            alert.id,
            alert.userId,
            alert.playerId,
            alert.condition,
            event.value,
            event.occurredAt,
          ),
        );
      }
    }
  }
}
