import { randomUUID } from 'node:crypto';
import { AlertCondition } from './alert-condition';
import { InvalidAlertConditionError } from './errors/invalid-alert-condition.error';
import { InvalidAlertThresholdError } from './errors/invalid-alert-threshold.error';
import { AlertStatus, PriceAlert } from './price-alert';

describe('PriceAlert (dominio, sin Nest ni DB)', () => {
  const baseProps = () => ({
    id: randomUUID(),
    userId: randomUUID(),
    playerId: randomUUID(),
    condition: AlertCondition.PRICE_BELOW,
    targetValue: 10,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  });

  it('se crea en estado ACTIVE', () => {
    const alert = PriceAlert.create(baseProps());
    expect(alert.status).toBe(AlertStatus.ACTIVE);
  });

  it('rechaza un umbral negativo', () => {
    expect(() => PriceAlert.create({ ...baseProps(), targetValue: -5 })).toThrow(
      InvalidAlertThresholdError,
    );
  });

  it('rechaza un umbral cero', () => {
    expect(() => PriceAlert.create({ ...baseProps(), targetValue: 0 })).toThrow(
      InvalidAlertThresholdError,
    );
  });

  it('rechaza una condición fuera del enum', () => {
    expect(() =>
      PriceAlert.create({ ...baseProps(), condition: 'NOT_A_CONDITION' as AlertCondition }),
    ).toThrow(InvalidAlertConditionError);
  });

  describe('matches', () => {
    it('PRICE_BELOW: true si el valor nuevo es menor al umbral', () => {
      const alert = PriceAlert.create({ ...baseProps(), condition: AlertCondition.PRICE_BELOW, targetValue: 10 });
      expect(alert.matches(9.99)).toBe(true);
      expect(alert.matches(10)).toBe(false);
      expect(alert.matches(10.01)).toBe(false);
    });

    it('PRICE_ABOVE: true si el valor nuevo es mayor al umbral', () => {
      const alert = PriceAlert.create({ ...baseProps(), condition: AlertCondition.PRICE_ABOVE, targetValue: 10 });
      expect(alert.matches(10.01)).toBe(true);
      expect(alert.matches(10)).toBe(false);
      expect(alert.matches(9.99)).toBe(false);
    });

    it('una alerta cancelada nunca matchea, aunque el valor cumpliría la condición (FR-008)', () => {
      const alert = PriceAlert.create({ ...baseProps(), condition: AlertCondition.PRICE_BELOW, targetValue: 10 }).cancel();
      expect(alert.matches(1)).toBe(false);
    });
  });

  describe('cancel', () => {
    it('pasa de ACTIVE a CANCELLED', () => {
      const alert = PriceAlert.create(baseProps());
      expect(alert.cancel().status).toBe(AlertStatus.CANCELLED);
    });

    it('es idempotente: cancelar una ya cancelada no cambia nada', () => {
      const cancelled = PriceAlert.create(baseProps()).cancel(new Date('2026-01-02T00:00:00.000Z'));
      const cancelledAgain = cancelled.cancel(new Date('2026-01-03T00:00:00.000Z'));
      expect(cancelledAgain.status).toBe(AlertStatus.CANCELLED);
      expect(cancelledAgain.cancelledAt).toEqual(cancelled.cancelledAt);
    });
  });

  describe('isOwnedBy', () => {
    it('true solo para el userId propietario', () => {
      const props = baseProps();
      const alert = PriceAlert.create(props);
      expect(alert.isOwnedBy(props.userId)).toBe(true);
      expect(alert.isOwnedBy(randomUUID())).toBe(false);
    });
  });
});
