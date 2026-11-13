import { randomUUID } from 'node:crypto';
import { AlertCondition } from '../../domain/alerts/alert-condition';
import { QuoteRecalculatedEvent } from '../../domain/alerts/events/quote-recalculated.event';
import { PriceAlert } from '../../domain/alerts/price-alert';
import { PriceAlertRepository } from '../../repositories/alerts/price-alert.repository';
import {
  BusinessMetricsDouble,
  createBusinessMetricsDouble,
  makeBusinessMetricsDoubleThrow,
} from '../../shared/observability/metrics/business-metrics.double';
import { QuoteRecalculatedListener } from './quote-recalculated.listener';

/** 031-US4: `alerts_triggered_total` cuenta una vez por cada alerta que cumple su condición. */
describe('QuoteRecalculatedListener — métricas de negocio', () => {
  const userId = randomUUID();
  const playerId = randomUUID();
  let alertsRepo: { findActiveByUserIdAndPlayerId: jest.Mock };
  let eventEmitter: { emitAsync: jest.Mock };
  let metrics: BusinessMetricsDouble;
  let listener: QuoteRecalculatedListener;

  const alert = (targetValue: number) =>
    PriceAlert.create({
      id: randomUUID(),
      userId,
      playerId,
      condition: AlertCondition.PRICE_BELOW,
      targetValue,
      createdAt: new Date(),
    });
  const quote = (value: number) => new QuoteRecalculatedEvent(userId, playerId, value, new Date('2026-01-01T00:00:00.000Z'));

  beforeEach(() => {
    alertsRepo = { findActiveByUserIdAndPlayerId: jest.fn() };
    eventEmitter = { emitAsync: jest.fn().mockResolvedValue([]) };
    metrics = createBusinessMetricsDouble();
    listener = new QuoteRecalculatedListener(
      alertsRepo as unknown as PriceAlertRepository,
      eventEmitter as never,
      metrics,
    );
  });

  it('suma una alerta disparada por cada alerta que cumple la condición', async () => {
    alertsRepo.findActiveByUserIdAndPlayerId.mockResolvedValue([alert(10), alert(20), alert(1)]);

    await listener.handle(quote(5)); // cumplen las de 10 y 20; no la de 1

    expect(metrics.recordAlertTriggered).toHaveBeenCalledTimes(2);
    expect(eventEmitter.emitAsync).toHaveBeenCalledTimes(2);
  });

  it('si ninguna alerta cumple, no suma', async () => {
    alertsRepo.findActiveByUserIdAndPlayerId.mockResolvedValue([alert(1)]);

    await listener.handle(quote(5));

    expect(metrics.recordAlertTriggered).not.toHaveBeenCalled();
  });

  it('un BusinessMetrics que lanza no impide emitir alert.triggered', async () => {
    makeBusinessMetricsDoubleThrow(metrics);
    alertsRepo.findActiveByUserIdAndPlayerId.mockResolvedValue([alert(10)]);

    await expect(listener.handle(quote(5))).resolves.toBeUndefined();

    expect(eventEmitter.emitAsync).toHaveBeenCalledTimes(1);
  });
});
