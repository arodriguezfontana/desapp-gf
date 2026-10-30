import { randomUUID } from 'node:crypto';
import { AlertCondition } from '../../../domain/alerts/alert-condition';
import { PriceAlert } from '../../../domain/alerts/price-alert';
import { QuoteRecalculatedEvent } from '../../../domain/alerts/events/quote-recalculated.event';
import { ALERT_TRIGGERED_EVENT, AlertTriggeredEvent } from '../../../domain/alerts/events/alert-triggered.event';
import { PriceAlertRepository } from '../../../repositories/alerts/price-alert.repository';
import { QuoteRecalculatedListener } from '../quote-recalculated.listener';

describe('QuoteRecalculatedListener (unit, con dobles, sin Nest ni DB)', () => {
  const userId = randomUUID();
  const playerId = randomUUID();

  let alertsRepo: jest.Mocked<PriceAlertRepository>;
  let eventEmitter: { emit: jest.Mock; emitAsync: jest.Mock };
  let listener: QuoteRecalculatedListener;

  beforeEach(() => {
    alertsRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findActiveByUserIdAndPlayerId: jest.fn(),
      findAllByUserId: jest.fn(),
    } as unknown as typeof alertsRepo;
    eventEmitter = { emit: jest.fn(), emitAsync: jest.fn() };
    listener = new QuoteRecalculatedListener(alertsRepo, eventEmitter as never);
  });

  const makeAlert = (overrides: Partial<Parameters<typeof PriceAlert.create>[0]> = {}) =>
    PriceAlert.create({
      id: randomUUID(),
      userId,
      playerId,
      condition: AlertCondition.PRICE_BELOW,
      targetValue: 10,
      createdAt: new Date(),
      ...overrides,
    });

  const makeQuoteEvent = (value: number) =>
    new QuoteRecalculatedEvent(userId, playerId, value, new Date('2026-01-01T00:00:00.000Z'));

  it('emite alert.triggered si la alerta activa cumple la condición', async () => {
    const alert = makeAlert();
    alertsRepo.findActiveByUserIdAndPlayerId.mockResolvedValue([alert]);

    await listener.handle(makeQuoteEvent(5));

    expect(eventEmitter.emitAsync).toHaveBeenCalledTimes(1);
    const [eventName, payload] = eventEmitter.emitAsync.mock.calls[0] as [string, AlertTriggeredEvent];
    expect(eventName).toBe(ALERT_TRIGGERED_EVENT);
    expect(payload.alertId).toBe(alert.id);
    expect(payload.userId).toBe(userId);
    expect(payload.playerId).toBe(playerId);
    expect(payload.triggeredValue).toBe(5);
  });

  it('no emite nada si ninguna alerta cumple la condición', async () => {
    alertsRepo.findActiveByUserIdAndPlayerId.mockResolvedValue([makeAlert()]);

    await listener.handle(makeQuoteEvent(20));

    expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
  });

  it('emite una vez por cada alerta distinta que cumple, si hay varias sobre el mismo jugador', async () => {
    const alertA = makeAlert({ condition: AlertCondition.PRICE_BELOW, targetValue: 10 });
    const alertB = makeAlert({ condition: AlertCondition.PRICE_BELOW, targetValue: 8 });
    alertsRepo.findActiveByUserIdAndPlayerId.mockResolvedValue([alertA, alertB]);

    await listener.handle(makeQuoteEvent(5));

    expect(eventEmitter.emitAsync).toHaveBeenCalledTimes(2);
  });

  it('una alerta sigue activa y vuelve a emitir alert.triggered en una segunda invocación posterior que todavía cumple (FR-009)', async () => {
    const alert = makeAlert();
    alertsRepo.findActiveByUserIdAndPlayerId.mockResolvedValue([alert]);

    await listener.handle(makeQuoteEvent(5));
    await listener.handle(makeQuoteEvent(4));

    expect(eventEmitter.emitAsync).toHaveBeenCalledTimes(2);
  });

  it('una alerta CANCELLED no emite alert.triggered aunque matches devolvería true (FR-008)', async () => {
    const cancelled = makeAlert().cancel();
    alertsRepo.findActiveByUserIdAndPlayerId.mockResolvedValue([cancelled]);

    await listener.handle(makeQuoteEvent(1));

    expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
  });
});
