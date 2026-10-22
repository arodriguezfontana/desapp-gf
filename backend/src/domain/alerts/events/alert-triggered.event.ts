import { AlertCondition } from '../alert-condition';

export const ALERT_TRIGGERED_EVENT = 'alert.triggered';

/**
 * Emitido cuando una PriceAlert activa cumple su condición
 * (025-player-price-alerts, spec FR-012, FR-021). Dos listeners
 * independientes entre sí reaccionan: uno persiste la Notification (+ push
 * SSE), otro envía el mail. Ninguno conoce al otro.
 */
export class AlertTriggeredEvent {
  constructor(
    public readonly alertId: string,
    public readonly userId: string,
    public readonly playerId: string,
    public readonly condition: AlertCondition,
    public readonly triggeredValue: number,
    public readonly occurredAt: Date,
  ) {}
}
